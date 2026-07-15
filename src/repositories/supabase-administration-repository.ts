import "server-only";

import type { TournamentDataSnapshot } from "../data/types";
import type { AdministrationCommand } from "../domain/admin/types";
import { mapSupabaseSnapshot } from "./supabase-snapshot-mapper";

export type AdministrationRpcErrorKind =
  | "unauthorized"
  | "forbidden"
  | "stale"
  | "idempotency_conflict"
  | "validation"
  | "internal";

export class AdministrationRepositoryError extends Error {
  readonly kind: AdministrationRpcErrorKind;

  constructor(kind: AdministrationRpcErrorKind) {
    super(safeMessage(kind));
    this.name = "AdministrationRepositoryError";
    this.kind = kind;
  }
}

export type AdministrationContext = Readonly<{
  tournamentId: string;
  revision: string;
  snapshot: TournamentDataSnapshot;
}>;

export type AdministrationApplyResult = Readonly<{
  status: "applied" | "already_applied";
  tournamentId: string;
  revision: string;
  changeSetId: string;
}>;

export type AdministrationRpcClient = Readonly<{
  rpc(
    functionName: string,
    parameters: Readonly<Record<string, unknown>>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown }>>;
}>;

export class SupabaseAdministrationRepository {
  readonly #client: AdministrationRpcClient;

  constructor(client: AdministrationRpcClient) {
    this.#client = client;
  }

  async getContext(tournamentId: string): Promise<AdministrationContext> {
    const response = await invoke(this.#client, "read_administration_context", {
      p_tournament_id: tournamentId,
    });
    const root = strictRecord(response);
    exactKeys(root, ["tournament_id", "revision", "snapshot"]);
    const returnedTournamentId = nonEmptyString(root.tournament_id);
    if (returnedTournamentId !== tournamentId) {
      throw new AdministrationRepositoryError("internal");
    }
    let snapshot: TournamentDataSnapshot;
    try {
      snapshot = mapSupabaseSnapshot(root.snapshot);
    } catch {
      throw new AdministrationRepositoryError("internal");
    }
    if (snapshot.tournament?.id !== tournamentId) {
      throw new AdministrationRepositoryError("internal");
    }
    return {
      tournamentId,
      revision: revision(root.revision),
      snapshot,
    };
  }

  async apply(
    input: Readonly<{
      tournamentId: string;
      expectedRevision: string;
      changeSetId: string;
      commands: readonly AdministrationCommand[];
      reviewFingerprint: string;
    }>,
  ): Promise<AdministrationApplyResult> {
    const response = await invoke(this.#client, "apply_administration_change", {
      p_tournament_id: input.tournamentId,
      p_expected_revision: input.expectedRevision,
      p_change_set_id: input.changeSetId,
      p_commands: input.commands,
      p_review_fingerprint: input.reviewFingerprint,
    });
    const root = strictRecord(response);
    exactKeys(root, ["status", "tournament_id", "revision", "change_set_id"]);
    const status = root.status;
    if (status !== "applied" && status !== "already_applied") {
      throw new AdministrationRepositoryError("internal");
    }
    const tournamentId = nonEmptyString(root.tournament_id);
    const changeSetId = nonEmptyString(root.change_set_id);
    if (
      tournamentId !== input.tournamentId ||
      changeSetId !== input.changeSetId
    ) {
      throw new AdministrationRepositoryError("internal");
    }
    return {
      status,
      tournamentId,
      revision: revision(root.revision),
      changeSetId,
    };
  }
}

async function invoke(
  client: AdministrationRpcClient,
  functionName: string,
  parameters: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  let response: Readonly<{ data: unknown; error: unknown }>;
  try {
    response = await client.rpc(functionName, parameters);
  } catch {
    throw new AdministrationRepositoryError("internal");
  }
  if (response.error !== null) {
    throw new AdministrationRepositoryError(mapError(response.error));
  }
  return response.data;
}

function mapError(error: unknown): AdministrationRpcErrorKind {
  const code =
    error !== null && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  switch (code) {
    case "P7401":
      return "unauthorized";
    case "P7403":
      return "forbidden";
    case "P7S01":
      return "stale";
    case "P7I01":
      return "idempotency_conflict";
    case "P7V01":
      return "validation";
    default:
      return "internal";
  }
}

function safeMessage(kind: AdministrationRpcErrorKind): string {
  switch (kind) {
    case "unauthorized":
      return "Authentication is required.";
    case "forbidden":
      return "Administrator access is required.";
    case "stale":
      return "Tournament data changed after review.";
    case "idempotency_conflict":
      return "The submission identifier was already used for another change.";
    case "validation":
      return "The reviewed tournament change was rejected.";
    case "internal":
      return "The administration operation is temporarily unavailable.";
  }
}

function strictRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AdministrationRepositoryError("internal");
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): void {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(keys) !== JSON.stringify(wanted)) {
    throw new AdministrationRepositoryError("internal");
  }
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AdministrationRepositoryError("internal");
  }
  return value;
}

function revision(value: unknown): string {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(value)) {
    throw new AdministrationRepositoryError("internal");
  }
  return value;
}
