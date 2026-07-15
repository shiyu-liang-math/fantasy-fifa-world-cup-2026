import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { TournamentDataSnapshot } from "../../data/types";
import { prepareAdministrationUpdate } from "../../domain/admin/workflow";
import type {
  AdministrationAffectedData,
  AdministrationCommand,
  AdministrationProposal,
} from "../../domain/admin/types";

export const ADMINISTRATION_REVIEW_SCHEMA = "administration-review/v1";
export const MAXIMUM_REVIEW_LIFETIME_MS = 15 * 60 * 1000;
export const MAXIMUM_REVIEW_FUTURE_SKEW_MS = 60 * 1000;

export type UnsignedAdministrationReviewEnvelope = Readonly<{
  schema: typeof ADMINISTRATION_REVIEW_SCHEMA;
  tournamentId: string;
  baseRevision: string;
  changeSetId: string;
  issuedAt: string;
  expiresAt: string;
  commands: readonly AdministrationCommand[];
  commandsRevision: string;
  resultRevision: string;
  proposalRevision: string;
  summary: readonly string[];
  affected: AdministrationAffectedData;
}>;

export type AdministrationReviewEnvelope =
  UnsignedAdministrationReviewEnvelope & Readonly<{ signature: string }>;

export type AdministrationReviewErrorCode =
  | "invalid_review"
  | "unsupported_review_version"
  | "expired_review"
  | "invalid_review_signature"
  | "stale_review"
  | "review_mismatch";

export class AdministrationReviewError extends Error {
  readonly code: AdministrationReviewErrorCode;

  constructor(code: AdministrationReviewErrorCode, message: string) {
    super(message);
    this.name = "AdministrationReviewError";
    this.code = code;
  }
}

export function createAdministrationReviewEnvelope(
  input: Readonly<{
    tournamentId: string;
    databaseRevision: string | number | bigint;
    changeSetId: string;
    issuedAt: string;
    expiresAt: string;
    proposal: AdministrationProposal;
    signingSecret: string;
  }>,
): AdministrationReviewEnvelope {
  const unsigned = createUnsignedAdministrationReviewEnvelope(input);
  return deepFreeze({
    ...unsigned,
    signature: signAdministrationReview(unsigned, input.signingSecret),
  });
}

export function createUnsignedAdministrationReviewEnvelope(
  input: Readonly<{
    tournamentId: string;
    databaseRevision: string | number | bigint;
    changeSetId: string;
    issuedAt: string;
    expiresAt: string;
    proposal: AdministrationProposal;
  }>,
): UnsignedAdministrationReviewEnvelope {
  if (!input.proposal.safeToApply || input.proposal.proposedSnapshot === null) {
    fail("invalid_review", "Only a valid prepared proposal can be reviewed.");
  }
  if (input.proposal.proposedSnapshot.tournament?.id !== input.tournamentId) {
    fail(
      "invalid_review",
      "The proposal tournament does not match the review.",
    );
  }
  const unsigned = parseUnsigned({
    schema: ADMINISTRATION_REVIEW_SCHEMA,
    tournamentId: input.tournamentId,
    baseRevision: normalizeRevision(input.databaseRevision),
    changeSetId: input.changeSetId,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    commands: input.proposal.commands,
    commandsRevision: input.proposal.commandsRevision,
    resultRevision: input.proposal.resultRevision,
    proposalRevision: input.proposal.proposalRevision,
    summary: input.proposal.summary,
    affected: input.proposal.affected,
  });
  if (Date.parse(unsigned.expiresAt) <= Date.parse(unsigned.issuedAt)) {
    fail("invalid_review", "The review expiration must follow its issue time.");
  }
  if (
    Date.parse(unsigned.expiresAt) - Date.parse(unsigned.issuedAt) >
    MAXIMUM_REVIEW_LIFETIME_MS
  ) {
    fail("invalid_review", "The review lifetime exceeds 15 minutes.");
  }
  return deepFreeze(unsigned);
}

export function serializeAdministrationReviewEnvelope(
  envelope: AdministrationReviewEnvelope,
): string {
  return canonicalSerialize(parseAdministrationReviewEnvelope(envelope));
}

export function parseAdministrationReviewEnvelope(
  serialized: unknown,
): AdministrationReviewEnvelope {
  let value = serialized;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      fail("invalid_review", "The administration review is not valid JSON.");
    }
  }
  const root = strictRecord(value, [
    "schema",
    "tournamentId",
    "baseRevision",
    "changeSetId",
    "issuedAt",
    "expiresAt",
    "commands",
    "commandsRevision",
    "resultRevision",
    "proposalRevision",
    "summary",
    "affected",
    "signature",
  ]);
  const { signature: signatureValue, ...unsignedValue } = root;
  const unsigned = parseUnsigned(unsignedValue);
  const signature = string(signatureValue, "signature");
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) {
    fail("invalid_review", "The administration review signature is malformed.");
  }
  decodeSignature(signature);
  return deepFreeze({ ...unsigned, signature });
}

export function verifyAdministrationReviewSignature(
  serialized: unknown,
  signingSecret: string,
  now: Date = new Date(),
): AdministrationReviewEnvelope {
  const envelope = parseAdministrationReviewEnvelope(serialized);
  const { signature, ...unsigned } = envelope;
  const actual = decodeSignature(signature);
  const expected = decodeSignature(
    signAdministrationReview(unsigned, signingSecret),
  );
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    fail(
      "invalid_review_signature",
      "The administration review signature is invalid.",
    );
  }
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) {
    fail("invalid_review", "The verification time is invalid.");
  }
  const issuedTime = Date.parse(envelope.issuedAt);
  const expiresTime = Date.parse(envelope.expiresAt);
  if (expiresTime <= issuedTime) {
    fail("invalid_review", "The review expiration must follow its issue time.");
  }
  if (expiresTime - issuedTime > MAXIMUM_REVIEW_LIFETIME_MS) {
    fail("invalid_review", "The review lifetime exceeds 15 minutes.");
  }
  if (issuedTime - nowTime > MAXIMUM_REVIEW_FUTURE_SKEW_MS) {
    fail("invalid_review", "The review issue time is too far in the future.");
  }
  if (expiresTime <= nowTime) {
    fail("expired_review", "The administration review has expired.");
  }
  return envelope;
}

export function verifyAdministrationReview(
  input: Readonly<{
    serialized: unknown;
    signingSecret: string;
    now?: Date;
    currentSnapshot: TournamentDataSnapshot;
    currentDatabaseRevision: string | number | bigint;
  }>,
): Readonly<{
  envelope: AdministrationReviewEnvelope;
  recomputedProposal: AdministrationProposal;
}> {
  const envelope = verifyAdministrationReviewSignature(
    input.serialized,
    input.signingSecret,
    input.now,
  );
  if (input.currentSnapshot.tournament?.id !== envelope.tournamentId) {
    fail(
      "review_mismatch",
      "The current tournament does not match the signed review.",
    );
  }
  if (
    envelope.baseRevision !== normalizeRevision(input.currentDatabaseRevision)
  ) {
    fail(
      "stale_review",
      "Tournament data changed after this review was created.",
    );
  }
  const recomputedProposal = prepareAdministrationUpdate(
    input.currentSnapshot,
    envelope.commands,
  );
  if (
    !recomputedProposal.safeToApply ||
    recomputedProposal.proposedSnapshot === null
  ) {
    fail("review_mismatch", "The reviewed commands are no longer valid.");
  }
  const recomputed = {
    commands: recomputedProposal.commands,
    commandsRevision: recomputedProposal.commandsRevision,
    resultRevision: recomputedProposal.resultRevision,
    proposalRevision: recomputedProposal.proposalRevision,
    summary: recomputedProposal.summary,
    affected: recomputedProposal.affected,
  };
  const reviewed = {
    commands: envelope.commands,
    commandsRevision: envelope.commandsRevision,
    resultRevision: envelope.resultRevision,
    proposalRevision: envelope.proposalRevision,
    summary: envelope.summary,
    affected: envelope.affected,
  };
  if (canonicalSerialize(recomputed) !== canonicalSerialize(reviewed)) {
    fail(
      "review_mismatch",
      "The recomputed proposal does not match the signed review.",
    );
  }
  return { envelope, recomputedProposal };
}

export function canonicalSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      fail("invalid_review", "Non-finite numbers are unsupported.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalSerialize).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail("invalid_review", "Only JSON-safe records can be serialized.");
    }
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(
        ([key, child]) => `${JSON.stringify(key)}:${canonicalSerialize(child)}`,
      )
      .join(",")}}`;
  }
  fail("invalid_review", "Unsupported review value.");
}

function signAdministrationReview(
  unsigned: UnsignedAdministrationReviewEnvelope,
  signingSecret: string,
): string {
  if (Buffer.byteLength(signingSecret, "utf8") < 32) {
    fail("invalid_review", "The administration signing secret is too short.");
  }
  return createHmac("sha256", signingSecret)
    .update(canonicalSerialize(unsigned), "utf8")
    .digest("base64url");
}

function parseUnsigned(value: unknown): UnsignedAdministrationReviewEnvelope {
  const root = strictRecord(value, [
    "schema",
    "tournamentId",
    "baseRevision",
    "changeSetId",
    "issuedAt",
    "expiresAt",
    "commands",
    "commandsRevision",
    "resultRevision",
    "proposalRevision",
    "summary",
    "affected",
  ]);
  if (root.schema !== ADMINISTRATION_REVIEW_SCHEMA) {
    fail(
      "unsupported_review_version",
      "The administration review version is unsupported.",
    );
  }
  const tournamentId = string(root.tournamentId, "tournamentId");
  const baseRevision = string(root.baseRevision, "baseRevision");
  if (!/^(0|[1-9]\d*)$/.test(baseRevision))
    fail("invalid_review", "baseRevision is malformed.");
  const changeSetId = string(root.changeSetId, "changeSetId");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      changeSetId,
    )
  ) {
    fail("invalid_review", "changeSetId is malformed.");
  }
  const issuedAt = isoTimestamp(root.issuedAt, "issuedAt");
  const expiresAt = isoTimestamp(root.expiresAt, "expiresAt");
  const commands = parseCommands(root.commands);
  const commandsRevision = fingerprint(
    root.commandsRevision,
    "commandsRevision",
  );
  const resultRevision = fingerprint(root.resultRevision, "resultRevision");
  const proposalRevision = fingerprint(
    root.proposalRevision,
    "proposalRevision",
  );
  const summary = stringArray(root.summary, "summary");
  const affected = parseAffected(root.affected);
  return {
    schema: ADMINISTRATION_REVIEW_SCHEMA,
    tournamentId,
    baseRevision,
    changeSetId,
    issuedAt,
    expiresAt,
    commands,
    commandsRevision,
    resultRevision,
    proposalRevision,
    summary,
    affected,
  };
}

function parseCommands(value: unknown): AdministrationCommand[] {
  if (!Array.isArray(value) || value.length === 0) {
    fail("invalid_review", "commands must be a non-empty array.");
  }
  return value.map((candidate, index) => parseCommand(candidate, index));
}

function parseCommand(value: unknown, index: number): AdministrationCommand {
  const candidate = record(value, `commands[${index}]`);
  const type = string(candidate.type, `commands[${index}].type`);
  switch (type) {
    case "upsert_fixture": {
      exactKeys(candidate, ["type", "fixture"]);
      const fixture = strictRecord(
        candidate.fixture,
        [
          "id",
          "roundId",
          "matchNumber",
          "scheduledAt",
          "status",
          "homeCountryId",
          "awayCountryId",
          "homeSourceSlot",
          "awaySourceSlot",
        ],
        true,
      );
      const status = optionalString(fixture.status);
      if (
        status !== undefined &&
        !["scheduled", "live", "postponed", "cancelled"].includes(status)
      ) {
        fail("invalid_review", "Fixture status is unsupported.");
      }
      return {
        type,
        fixture: {
          id: string(fixture.id, "fixture.id"),
          roundId: string(fixture.roundId, "fixture.roundId"),
          matchNumber: integer(fixture.matchNumber, "fixture.matchNumber"),
          scheduledAt: nullableString(
            fixture.scheduledAt,
            "fixture.scheduledAt",
          ),
          ...(status === undefined
            ? {}
            : {
                status: status as
                  "scheduled" | "live" | "postponed" | "cancelled",
              }),
          homeCountryId: nullableString(
            fixture.homeCountryId,
            "fixture.homeCountryId",
          ),
          awayCountryId: nullableString(
            fixture.awayCountryId,
            "fixture.awayCountryId",
          ),
          ...(fixture.homeSourceSlot === undefined
            ? {}
            : { homeSourceSlot: parseSourceSlot(fixture.homeSourceSlot) }),
          ...(fixture.awaySourceSlot === undefined
            ? {}
            : { awaySourceSlot: parseSourceSlot(fixture.awaySourceSlot) }),
        },
      };
    }
    case "record_result":
    case "replace_result": {
      exactKeys(
        candidate,
        type === "replace_result"
          ? ["type", "result", "reason"]
          : ["type", "result"],
      );
      const result = parseResult(candidate.result);
      return type === "replace_result"
        ? { type, result, reason: string(candidate.reason, "reason") }
        : { type, result };
    }
    case "set_group_override": {
      exactKeys(candidate, ["type", "override"]);
      return { type, override: parseOverride(candidate.override) };
    }
    case "replace_group_override": {
      exactKeys(candidate, ["type", "replacedOverrideId", "override"]);
      return {
        type,
        replacedOverrideId: string(
          candidate.replacedOverrideId,
          "replacedOverrideId",
        ),
        override: parseOverride(candidate.override),
      };
    }
    case "remove_group_override":
      exactKeys(candidate, ["type", "overrideId"]);
      return { type, overrideId: string(candidate.overrideId, "overrideId") };
    case "set_knockout_participants":
      exactKeys(candidate, [
        "type",
        "matchId",
        "homeCountryId",
        "awayCountryId",
      ]);
      return {
        type,
        matchId: string(candidate.matchId, "matchId"),
        homeCountryId: nullableString(candidate.homeCountryId, "homeCountryId"),
        awayCountryId: nullableString(candidate.awayCountryId, "awayCountryId"),
      };
    case "update_tournament_metadata": {
      exactKeys(candidate, ["type", "update"]);
      const update = record(candidate.update, "update");
      exactKeys(
        update,
        [
          "status",
          "currentRoundId",
          "referenceDataComplete",
          "missingOfficialData",
        ],
        true,
      );
      const status = optionalString(update.status);
      if (
        status !== undefined &&
        !["planned", "active", "completed"].includes(status)
      )
        fail("invalid_review", "Tournament status is unsupported.");
      return {
        type,
        update: {
          ...(status === undefined
            ? {}
            : { status: status as "planned" | "active" | "completed" }),
          ...(update.currentRoundId === undefined
            ? {}
            : {
                currentRoundId: nullableString(
                  update.currentRoundId,
                  "currentRoundId",
                ),
              }),
          ...(update.referenceDataComplete === undefined
            ? {}
            : {
                referenceDataComplete: boolean(
                  update.referenceDataComplete,
                  "referenceDataComplete",
                ),
              }),
          ...(update.missingOfficialData === undefined
            ? {}
            : {
                missingOfficialData: stringArray(
                  update.missingOfficialData,
                  "missingOfficialData",
                ),
              }),
        },
      };
    }
    default:
      fail("invalid_review", `commands[${index}].type is unsupported.`);
  }
}

function parseResult(value: unknown) {
  const result = strictRecord(
    value,
    [
      "matchId",
      "homeGoals",
      "awayGoals",
      "wentToExtraTime",
      "homeShootoutGoals",
      "awayShootoutGoals",
      "advancingCountryId",
    ],
    true,
  );
  return {
    matchId: string(result.matchId, "result.matchId"),
    homeGoals: integer(result.homeGoals, "result.homeGoals"),
    awayGoals: integer(result.awayGoals, "result.awayGoals"),
    ...(result.wentToExtraTime === undefined
      ? {}
      : {
          wentToExtraTime: boolean(
            result.wentToExtraTime,
            "result.wentToExtraTime",
          ),
        }),
    ...(result.homeShootoutGoals === undefined
      ? {}
      : {
          homeShootoutGoals: nullableInteger(
            result.homeShootoutGoals,
            "result.homeShootoutGoals",
          ),
        }),
    ...(result.awayShootoutGoals === undefined
      ? {}
      : {
          awayShootoutGoals: nullableInteger(
            result.awayShootoutGoals,
            "result.awayShootoutGoals",
          ),
        }),
    ...(result.advancingCountryId === undefined
      ? {}
      : {
          advancingCountryId: nullableString(
            result.advancingCountryId,
            "result.advancingCountryId",
          ),
        }),
  };
}

function parseOverride(value: unknown) {
  const override = strictRecord(value, [
    "id",
    "groupCode",
    "orderedCountryIds",
    "reason",
    "source",
  ]);
  const groupCode = string(override.groupCode, "override.groupCode");
  if (!/^[A-L]$/.test(groupCode))
    fail("invalid_review", "Override group code is malformed.");
  return {
    id: string(override.id, "override.id"),
    groupCode: groupCode as
      "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L",
    orderedCountryIds: stringArray(
      override.orderedCountryIds,
      "override.orderedCountryIds",
    ),
    reason: string(override.reason, "override.reason"),
    source: string(override.source, "override.source"),
  };
}

function parseSourceSlot(value: unknown) {
  if (value === null) return null;
  const slot = strictRecord(value, ["sourceMatchId", "outcome"]);
  const outcome = string(slot.outcome, "sourceSlot.outcome");
  if (outcome !== "winner" && outcome !== "loser")
    fail("invalid_review", "Source outcome is unsupported.");
  return {
    sourceMatchId: string(slot.sourceMatchId, "sourceSlot.sourceMatchId"),
    outcome: outcome as "winner" | "loser",
  };
}

const AFFECTED_KEYS = [
  "matchIds",
  "groupCodes",
  "countryIds",
  "fixturesChanged",
  "resultsChanged",
  "standingsChanged",
  "qualificationsChanged",
  "knockoutParticipantsChanged",
  "advancementChanged",
  "leaderboardChanged",
  "goldenStarChanged",
  "goldenGoalChanged",
  "goldenCupChanged",
  "awardsChanged",
  "tournamentMetadataChanged",
  "publicPageModelsChanged",
] as const;

function parseAffected(value: unknown): AdministrationAffectedData {
  const affected = strictRecord(value, [...AFFECTED_KEYS]);
  return {
    matchIds: stringArray(affected.matchIds, "affected.matchIds"),
    groupCodes: stringArray(
      affected.groupCodes,
      "affected.groupCodes",
    ) as AdministrationAffectedData["groupCodes"],
    countryIds: stringArray(affected.countryIds, "affected.countryIds"),
    fixturesChanged: boolean(
      affected.fixturesChanged,
      "affected.fixturesChanged",
    ),
    resultsChanged: boolean(affected.resultsChanged, "affected.resultsChanged"),
    standingsChanged: boolean(
      affected.standingsChanged,
      "affected.standingsChanged",
    ),
    qualificationsChanged: boolean(
      affected.qualificationsChanged,
      "affected.qualificationsChanged",
    ),
    knockoutParticipantsChanged: boolean(
      affected.knockoutParticipantsChanged,
      "affected.knockoutParticipantsChanged",
    ),
    advancementChanged: boolean(
      affected.advancementChanged,
      "affected.advancementChanged",
    ),
    leaderboardChanged: boolean(
      affected.leaderboardChanged,
      "affected.leaderboardChanged",
    ),
    goldenStarChanged: boolean(
      affected.goldenStarChanged,
      "affected.goldenStarChanged",
    ),
    goldenGoalChanged: boolean(
      affected.goldenGoalChanged,
      "affected.goldenGoalChanged",
    ),
    goldenCupChanged: boolean(
      affected.goldenCupChanged,
      "affected.goldenCupChanged",
    ),
    awardsChanged: boolean(affected.awardsChanged, "affected.awardsChanged"),
    tournamentMetadataChanged: boolean(
      affected.tournamentMetadataChanged,
      "affected.tournamentMetadataChanged",
    ),
    publicPageModelsChanged: boolean(
      affected.publicPageModelsChanged,
      "affected.publicPageModelsChanged",
    ),
  };
}

function normalizeRevision(value: string | number | bigint): string {
  if (typeof value === "number" && !Number.isSafeInteger(value)) {
    fail("invalid_review", "Database revision is malformed.");
  }
  const normalized =
    typeof value === "bigint" ? value.toString() : String(value);
  if (!/^(0|[1-9]\d*)$/.test(normalized))
    fail("invalid_review", "Database revision is malformed.");
  return normalized;
}

function fingerprint(value: unknown, path: string): string {
  const result = string(value, path);
  if (!/^fnv1a-[0-9a-f]{8}$/.test(result))
    fail("invalid_review", `${path} is malformed.`);
  return result;
}

function isoTimestamp(value: unknown, path: string): string {
  const result = string(value, path);
  if (
    Number.isNaN(Date.parse(result)) ||
    new Date(result).toISOString() !== result
  )
    fail("invalid_review", `${path} is malformed.`);
  return result;
}

function strictRecord(
  value: unknown,
  keys: readonly string[],
  optional = false,
): Record<string, unknown> {
  const result = record(value, "review");
  exactKeys(result, keys, optional);
  return result;
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("invalid_review", `${path} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  optional = false,
): void {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key)))
    fail(
      "invalid_review",
      "The administration review contains unknown fields.",
    );
  if (!optional && keys.some((key) => !(key in value)))
    fail(
      "invalid_review",
      "The administration review is missing required fields.",
    );
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "")
    fail("invalid_review", `${path} must be a non-empty string.`);
  return value;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : string(value, "value");
}

function nullableString(value: unknown, path: string): string | null {
  return value === null ? null : string(value, path);
}

function integer(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    fail("invalid_review", `${path} must be a safe integer.`);
  return value;
}

function nullableInteger(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean")
    fail("invalid_review", `${path} must be a boolean.`);
  return value;
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value))
    fail("invalid_review", `${path} must be an array.`);
  return value.map((item, index) => string(item, `${path}[${index}]`));
}

function decodeSignature(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) {
    fail("invalid_review", "The administration review signature is malformed.");
  }
  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
      fail(
        "invalid_review",
        "The administration review signature is malformed.",
      );
    }
    return decoded;
  } catch {
    fail("invalid_review", "The administration review signature is malformed.");
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
  }
  return value;
}

function fail(code: AdministrationReviewErrorCode, message: string): never {
  throw new AdministrationReviewError(code, message);
}
