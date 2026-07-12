import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  deriveCompetition,
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type { DashboardPageModel, PageModelResult } from "./types";

export async function getDashboardPageModel(
  repository: TournamentRepository,
): Promise<PageModelResult<DashboardPageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const { snapshot } = loaded.context;
  const projection = deriveCompetition(snapshot);
  const currentRoundName =
    snapshot.rounds.find(({ id }) => id === snapshot.tournament!.currentRoundId)
      ?.name ?? null;
  const data: DashboardPageModel = {
    tournamentName: snapshot.tournament!.name,
    currentRoundName,
    lastUpdatedAt: snapshot.tournament!.lastUpdatedAt,
    participants: projection.participants,
  };

  return resultForContext(data, loaded.context, data.participants.length === 0);
}
