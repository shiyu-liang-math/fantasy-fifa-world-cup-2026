import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  deriveCompetition,
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type { HomePageModel, PageModelResult } from "./types";

export async function getHomePageModel(
  repository: TournamentRepository,
): Promise<PageModelResult<HomePageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const { snapshot } = loaded.context;
  const projection = deriveCompetition(snapshot);
  const winner = projection.participants.find(
    ({ goldenCupStatus }) => goldenCupStatus === "winner",
  );
  const data: HomePageModel = {
    tournamentName: snapshot.tournament!.name,
    currentRoundName:
      snapshot.rounds.find(
        ({ id }) => id === snapshot.tournament!.currentRoundId,
      )?.name ?? null,
    lastUpdatedAt: snapshot.tournament!.lastUpdatedAt,
    goldenStarLeaders: projection.participants
      .filter(({ starRank }) => starRank === 1)
      .map(({ participantId, name, stars }) => ({
        participantId,
        name,
        stars,
      })),
    goldenGoalLeaders: projection.participants
      .filter(({ goalRank }) => goalRank === 1)
      .map(({ participantId, name, goals }) => ({
        participantId,
        name,
        goals,
      })),
    goldenCup: {
      status: winner === undefined ? "unresolved" : "resolved",
      winnerParticipantId: winner?.participantId ?? null,
      contenderCountryCount: projection.participants.reduce(
        (total, participant) =>
          total +
          participant.countries.filter(
            ({ goldenCupStatus }) => goldenCupStatus === "contender",
          ).length,
        0,
      ),
    },
  };

  return resultForContext(
    data,
    loaded.context,
    projection.participants.length === 0,
  );
}
