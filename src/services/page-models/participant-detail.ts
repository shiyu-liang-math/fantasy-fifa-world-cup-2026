import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  deriveCompetition,
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type { PageModelResult, ParticipantDetailPageModel } from "./types";

export async function getParticipantDetailPageModel(
  repository: TournamentRepository,
  participantSlug: string,
): Promise<PageModelResult<ParticipantDetailPageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const projection = deriveCompetition(loaded.context.snapshot);
  const standing = projection.participants.find(
    ({ slug }) => slug === participantSlug,
  );

  if (standing === undefined) {
    return {
      status: "not_found",
      entity: "participant",
      identifier: participantSlug,
    };
  }

  const data: ParticipantDetailPageModel = {
    participant: {
      id: standing.participantId,
      slug: standing.slug,
      name: standing.name,
      abbreviation: standing.abbreviation,
    },
    stars: standing.stars,
    starRank: standing.starRank,
    goals: standing.goals,
    goalRank: standing.goalRank,
    goldenCupStatus: standing.goldenCupStatus,
    countries: standing.countries,
  };

  return resultForContext(data, loaded.context);
}
