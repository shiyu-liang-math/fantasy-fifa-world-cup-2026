import type { TournamentDataSnapshot } from "../data/types";

export interface TournamentRepository {
  getSnapshot(): Promise<TournamentDataSnapshot>;
}
