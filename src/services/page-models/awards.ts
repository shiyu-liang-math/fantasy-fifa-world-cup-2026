import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  deriveCompetition,
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type {
  AwardRankingEntry,
  AwardsPageModel,
  PageModelResult,
} from "./types";

export async function getAwardsPageModel(
  repository: TournamentRepository,
): Promise<PageModelResult<AwardsPageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const projection = deriveCompetition(loaded.context.snapshot);
  const winner = projection.participants.find(
    ({ goldenCupStatus }) => goldenCupStatus === "winner",
  );
  const winningCountry = winner?.countries.find(
    ({ goldenCupStatus }) => goldenCupStatus === "winner",
  );
  const data: AwardsPageModel = {
    goldenStar: rankingEntries(projection.participants, "stars", "starRank"),
    goldenGoal: rankingEntries(projection.participants, "goals", "goalRank"),
    goldenCup: {
      status: winner === undefined ? "unresolved" : "resolved",
      winnerParticipantId: winner?.participantId ?? null,
      winnerCountryId: winningCountry?.countryId ?? null,
      contenders: projection.participants
        .map((participant) => ({
          participantId: participant.participantId,
          countryIds: participant.countries
            .filter(({ goldenCupStatus }) => goldenCupStatus === "contender")
            .map(({ countryId }) => countryId),
        }))
        .filter(({ countryIds }) => countryIds.length > 0),
    },
  };

  return resultForContext(
    data,
    loaded.context,
    projection.participants.length === 0,
  );
}

function rankingEntries(
  participants: Awaited<ReturnType<typeof deriveCompetition>>["participants"],
  valueKey: "stars" | "goals",
  rankKey: "starRank" | "goalRank",
): AwardRankingEntry[] {
  return participants
    .map((participant) => ({
      participantId: participant.participantId,
      name: participant.name,
      abbreviation: participant.abbreviation,
      rank: participant[rankKey],
      value: participant[valueKey],
    }))
    .sort((left, right) => left.rank - right.rank);
}
