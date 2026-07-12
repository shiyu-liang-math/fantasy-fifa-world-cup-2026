import { REFERENCE_SNAPSHOT } from "../data/reference/snapshot";
import type { TournamentDataSnapshot } from "../data/types";
import type { TournamentRepository } from "./tournament-repository";

export class LocalTournamentRepository implements TournamentRepository {
  readonly #snapshot: TournamentDataSnapshot;

  constructor(snapshot: TournamentDataSnapshot) {
    this.#snapshot = structuredClone(snapshot);
  }

  async getSnapshot() {
    return clone(this.#snapshot);
  }
}

export function createReferenceTournamentRepository(): TournamentRepository {
  return new LocalTournamentRepository(REFERENCE_SNAPSHOT);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
