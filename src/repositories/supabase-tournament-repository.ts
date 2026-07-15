import "server-only";

import type { TournamentDataSnapshot } from "../data/types";
import type { TournamentRepository } from "./tournament-repository";
import {
  InvalidTournamentSnapshotError,
  TournamentRepositoryUnavailableError,
} from "./repository-errors";
import { mapSupabaseSnapshot } from "./supabase-snapshot-mapper";

export type SnapshotRpcClient = Readonly<{
  rpc(
    functionName: "read_tournament_snapshot",
    parameters: Readonly<{ p_tournament_id: string }>,
  ): PromiseLike<Readonly<{ data: unknown; error: unknown }>>;
}>;

export async function loadSupabaseTournamentSnapshot(
  client: SnapshotRpcClient,
  tournamentId: string,
): Promise<TournamentDataSnapshot> {
  let response: Readonly<{ data: unknown; error: unknown }>;
  try {
    response = await client.rpc("read_tournament_snapshot", {
      p_tournament_id: tournamentId,
    });
  } catch {
    throw new TournamentRepositoryUnavailableError();
  }
  if (response.error !== null) {
    throw new TournamentRepositoryUnavailableError();
  }
  const snapshot = mapSupabaseSnapshot(response.data);
  if (snapshot.tournament !== null && snapshot.tournament.id !== tournamentId) {
    throw new InvalidTournamentSnapshotError([
      "The snapshot returned a different tournament than requested.",
    ]);
  }
  return snapshot;
}

export class SupabaseTournamentRepository implements TournamentRepository {
  readonly #loadSnapshot: () => Promise<TournamentDataSnapshot>;
  #snapshotPromise: Promise<TournamentDataSnapshot> | undefined;

  constructor(loadSnapshot: () => Promise<TournamentDataSnapshot>) {
    this.#loadSnapshot = loadSnapshot;
  }

  async getSnapshot(): Promise<TournamentDataSnapshot> {
    this.#snapshotPromise ??= this.#loadSnapshot();
    try {
      return structuredClone(await this.#snapshotPromise);
    } catch (error) {
      this.#snapshotPromise = undefined;
      throw error;
    }
  }
}
