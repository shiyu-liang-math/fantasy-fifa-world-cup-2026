import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type { PageModelResult, TournamentOverviewPageModel } from "./types";

export async function getTournamentOverviewPageModel(
  repository: TournamentRepository,
): Promise<PageModelResult<TournamentOverviewPageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const { snapshot } = loaded.context;
  const tournament = snapshot.tournament!;
  const data: TournamentOverviewPageModel = {
    tournamentName: tournament.name,
    year: tournament.year,
    status: tournament.status,
    currentRoundName:
      snapshot.rounds.find(({ id }) => id === tournament.currentRoundId)
        ?.name ?? null,
    representedCountryCount: snapshot.countries.length,
    expectedCountryCount: 48,
    groupCount: snapshot.groups.length,
    knockoutMatchCount: snapshot.matches.filter(
      ({ stage }) => stage !== "group",
    ).length,
    referenceDataComplete: tournament.referenceDataComplete,
    missingOfficialData: [...tournament.missingOfficialData],
  };

  return resultForContext(data, loaded.context);
}
