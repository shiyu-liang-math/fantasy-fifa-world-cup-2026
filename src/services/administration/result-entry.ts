import "server-only";

import { randomUUID } from "node:crypto";

import type { MatchRecord, TournamentDataSnapshot } from "@/data/types";
import {
  prepareAdministrationUpdate,
  type AdministrationAffectedData,
  type AdministrationCommand,
} from "@/domain/admin";
import type { MatchStage, MatchStatus } from "@/domain/types";
import { AdministrationRepositoryError } from "@/repositories/supabase-administration-repository";
import { applyReviewedAdministrationChange } from "./apply-reviewed-change";
import {
  getAuthorizedAdministrationContext,
  validateAuthenticatedAdministrator,
  type AuthenticatedAdministrationClient,
} from "./admin-access";
import {
  AdministrationReviewError,
  createAdministrationReviewEnvelope,
  MAXIMUM_REVIEW_LIFETIME_MS,
  parseAdministrationReviewEnvelope,
  serializeAdministrationReviewEnvelope,
} from "./review-envelope";
import { MAXIMUM_CORRECTION_REASON_BYTES } from "./result-entry-constraints";

export type ResultEntryFields = Readonly<{
  matchId: string;
  homeGoals: string;
  awayGoals: string;
  wentToExtraTime: boolean;
  homeShootoutGoals: string;
  awayShootoutGoals: string;
  advancingCountryId: string;
  correctionReason: string;
}>;

export type ResultEntryField = Exclude<keyof ResultEntryFields, "matchId">;

export type ResultEntryFieldErrors = Partial<
  Readonly<Record<ResultEntryField, string>>
>;

export type ParsedResultEntry = Readonly<{
  homeGoals: number;
  awayGoals: number;
  wentToExtraTime: boolean;
  homeShootoutGoals: number | null;
  awayShootoutGoals: number | null;
  advancingCountryId: string | null;
  correctionReason: string;
}>;

export type AdminMatchSummary = Readonly<{
  id: string;
  matchNumber: number;
  stage: MatchStage;
  status: MatchStatus;
  scheduledAt: string | null;
  homeCountryId: string;
  homeCountryName: string;
  awayCountryId: string;
  awayCountryName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  wentToExtraTime: boolean;
  homeShootoutGoals: number | null;
  awayShootoutGoals: number | null;
  advancingCountryId: string | null;
}>;

export type ResultReview = Readonly<{
  reviewId: string;
  expiresAt: string;
  commandType: "record_result" | "replace_result";
  correctionReason: string | null;
  before: AdminMatchSummary;
  after: AdminMatchSummary;
  summary: readonly string[];
  affected: AdministrationAffectedData;
}>;

export type PreparedResultReview = ResultReview &
  Readonly<{ serializedReview: string }>;

export class ResultEntryValidationError extends Error {
  readonly fieldErrors: ResultEntryFieldErrors;
  readonly issues: readonly string[];

  constructor(
    fieldErrors: ResultEntryFieldErrors,
    issues: readonly string[] = [],
  ) {
    super("The result could not be prepared for review.");
    this.name = "ResultEntryValidationError";
    this.fieldErrors = fieldErrors;
    this.issues = issues;
  }
}

export function parseResultEntry(fields: ResultEntryFields): ParsedResultEntry {
  const fieldErrors: Record<string, string> = {};
  const homeGoals = requiredNonnegativeInteger(
    fields.homeGoals,
    "Enter the home score as a whole number.",
    fieldErrors,
    "homeGoals",
  );
  const awayGoals = requiredNonnegativeInteger(
    fields.awayGoals,
    "Enter the away score as a whole number.",
    fieldErrors,
    "awayGoals",
  );
  const homeShootoutGoals = optionalNonnegativeInteger(
    fields.homeShootoutGoals,
    "Enter the home shootout score as a whole number or leave it blank.",
    fieldErrors,
    "homeShootoutGoals",
  );
  const awayShootoutGoals = optionalNonnegativeInteger(
    fields.awayShootoutGoals,
    "Enter the away shootout score as a whole number or leave it blank.",
    fieldErrors,
    "awayShootoutGoals",
  );
  if ((homeShootoutGoals === null) !== (awayShootoutGoals === null)) {
    const message = "Enter both shootout scores or leave both blank.";
    fieldErrors.homeShootoutGoals = message;
    fieldErrors.awayShootoutGoals = message;
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw new ResultEntryValidationError(fieldErrors);
  }
  return {
    homeGoals: homeGoals!,
    awayGoals: awayGoals!,
    wentToExtraTime: fields.wentToExtraTime,
    homeShootoutGoals,
    awayShootoutGoals,
    advancingCountryId: fields.advancingCountryId.trim() || null,
    correctionReason: fields.correctionReason.trim(),
  };
}

export async function prepareResultReview(
  input: Readonly<{
    client: AuthenticatedAdministrationClient;
    tournamentId: string;
    fields: ResultEntryFields;
    signingSecret: string;
    now?: Date;
    changeSetId?: string;
  }>,
): Promise<PreparedResultReview> {
  const context = await getAuthorizedAdministrationContext(
    input.client,
    input.tournamentId,
  );
  const match = context.snapshot.matches.find(
    ({ id }) => id === input.fields.matchId,
  );
  if (
    match === undefined ||
    match.homeCountryId === null ||
    match.awayCountryId === null
  ) {
    throw new ResultEntryValidationError({}, [
      "The selected fixture is unavailable or does not have two resolved teams.",
    ]);
  }
  const parsed = parseResultEntry(input.fields);
  const correction = match.status === "completed";
  if (correction && parsed.correctionReason === "") {
    throw new ResultEntryValidationError({
      correctionReason: "Explain why the completed result is being corrected.",
    });
  }
  if (
    correction &&
    Buffer.byteLength(parsed.correctionReason, "utf8") >
      MAXIMUM_CORRECTION_REASON_BYTES
  ) {
    throw new ResultEntryValidationError({
      correctionReason:
        "Keep the correction reason at 500 UTF-8 bytes or fewer.",
    });
  }
  if (match.stage !== "group" && parsed.advancingCountryId === null) {
    throw new ResultEntryValidationError({
      advancingCountryId: "Select the country that advanced.",
    });
  }

  const result = {
    matchId: match.id,
    homeGoals: parsed.homeGoals,
    awayGoals: parsed.awayGoals,
    wentToExtraTime: parsed.wentToExtraTime,
    homeShootoutGoals: parsed.homeShootoutGoals,
    awayShootoutGoals: parsed.awayShootoutGoals,
    advancingCountryId:
      match.stage === "group" ? null : parsed.advancingCountryId,
  };
  const command: AdministrationCommand = correction
    ? {
        type: "replace_result",
        result,
        reason: parsed.correctionReason,
      }
    : { type: "record_result", result };
  const proposal = prepareAdministrationUpdate(context.snapshot, command);
  if (!proposal.safeToApply || proposal.proposedSnapshot === null) {
    throw new ResultEntryValidationError(
      {},
      proposal.errors.map(({ message }) => message),
    );
  }
  const afterMatch = proposal.proposedSnapshot.matches.find(
    ({ id }) => id === match.id,
  );
  if (afterMatch === undefined) {
    throw new ResultEntryValidationError({}, [
      "The reviewed fixture could not be reconstructed.",
    ]);
  }

  const issuedAt = input.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + MAXIMUM_REVIEW_LIFETIME_MS);
  const envelope = createAdministrationReviewEnvelope({
    tournamentId: input.tournamentId,
    databaseRevision: context.revision,
    changeSetId: input.changeSetId ?? randomUUID(),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    proposal,
    signingSecret: input.signingSecret,
  });
  return {
    serializedReview: serializeAdministrationReviewEnvelope(envelope),
    reviewId: envelope.changeSetId,
    expiresAt: envelope.expiresAt,
    commandType: correction ? "replace_result" : "record_result",
    correctionReason: correction ? parsed.correctionReason : null,
    before: summarizeMatch(context.snapshot, match),
    after: summarizeMatch(proposal.proposedSnapshot, afterMatch),
    summary: proposal.summary,
    affected: proposal.affected,
  };
}

export async function applyResultReview(
  input: Readonly<{
    client: AuthenticatedAdministrationClient;
    tournamentId: string;
    serializedReview: unknown;
  }>,
) {
  await validateAuthenticatedAdministrator(input.client);
  const parsed = parseAdministrationReviewEnvelope(input.serializedReview);
  if (parsed.tournamentId !== input.tournamentId) {
    throw new AdministrationReviewError(
      "review_mismatch",
      "The reviewed tournament does not match this administration workflow.",
    );
  }
  return applyReviewedAdministrationChange(input.client, parsed);
}

export function listAdminMatches(
  snapshot: TournamentDataSnapshot,
): AdminMatchSummary[] {
  return [...snapshot.matches]
    .sort((left, right) => {
      const leftCompleted = left.status === "completed" ? 1 : 0;
      const rightCompleted = right.status === "completed" ? 1 : 0;
      return (
        leftCompleted - rightCompleted || right.matchNumber - left.matchNumber
      );
    })
    .flatMap((match) =>
      match.homeCountryId === null || match.awayCountryId === null
        ? []
        : [summarizeMatch(snapshot, match)],
    );
}

function summarizeMatch(
  snapshot: TournamentDataSnapshot,
  match: MatchRecord,
): AdminMatchSummary {
  const homeCountryId = match.homeCountryId;
  const awayCountryId = match.awayCountryId;
  if (homeCountryId === null || awayCountryId === null) {
    throw new Error("Administration requires resolved fixture teams.");
  }
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    stage: match.stage,
    status: match.status,
    scheduledAt: match.scheduledAt,
    homeCountryId,
    homeCountryName:
      snapshot.countries.find(({ id }) => id === homeCountryId)?.name ??
      homeCountryId,
    awayCountryId,
    awayCountryName:
      snapshot.countries.find(({ id }) => id === awayCountryId)?.name ??
      awayCountryId,
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    wentToExtraTime: match.wentToExtraTime,
    homeShootoutGoals: match.homeShootoutGoals,
    awayShootoutGoals: match.awayShootoutGoals,
    advancingCountryId: match.advancingCountryId,
  };
}

function requiredNonnegativeInteger(
  value: string,
  message: string,
  errors: Record<string, string>,
  field: string,
): number | null {
  const parsed = parseNonnegativeInteger(value);
  if (parsed === null) errors[field] = message;
  return parsed;
}

function optionalNonnegativeInteger(
  value: string,
  message: string,
  errors: Record<string, string>,
  field: string,
): number | null {
  if (value.trim() === "") return null;
  const parsed = parseNonnegativeInteger(value);
  if (parsed === null) errors[field] = message;
  return parsed;
}

function parseNonnegativeInteger(value: string): number | null {
  const normalized = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isConcurrentResultRejection(error: unknown): boolean {
  return (
    (error instanceof AdministrationRepositoryError &&
      error.kind === "stale") ||
    (error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "stale_review")
  );
}
