import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "../data/development/scenario";
import { LocalTournamentRepository } from "./local-tournament-repository";
import type { TournamentRepository } from "./tournament-repository";

export function createFictionalDevelopmentRepository(): TournamentRepository {
  return new LocalTournamentRepository(FICTIONAL_DEVELOPMENT_SNAPSHOT);
}
