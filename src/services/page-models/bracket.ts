import type { MatchRecord, MatchSourceSlot } from "../../data/types";
import type { TournamentRepository } from "../../repositories/tournament-repository";
import {
  loadPageContext,
  passthroughContextFailure,
  resultForContext,
} from "./shared";
import type {
  BracketMatchModel,
  BracketPageModel,
  BracketSlotModel,
  MatchSummaryModel,
  PageModelResult,
} from "./types";

export async function getBracketPageModel(
  repository: TournamentRepository,
): Promise<PageModelResult<BracketPageModel>> {
  const loaded = await loadPageContext(repository);
  if (loaded.status !== "ok") return passthroughContextFailure(loaded);

  const { snapshot } = loaded.context;
  const countriesById = new Map(
    snapshot.countries.map((country) => [country.id, country]),
  );
  const knockoutRounds = snapshot.rounds.filter(
    ({ stage }) => stage !== "group",
  );
  const rounds = knockoutRounds.map((round) => ({
    roundId: round.id,
    name: round.name,
    matches: snapshot.matches
      .filter((match) => match.roundId === round.id)
      .sort((left, right) => left.matchNumber - right.matchNumber)
      .map((match): BracketMatchModel => ({
        ...matchSummary(match),
        homeSlot: bracketSlot(
          match.homeCountryId,
          match.homeSourceSlot,
          countriesById,
        ),
        awaySlot: bracketSlot(
          match.awayCountryId,
          match.awaySourceSlot,
          countriesById,
        ),
      })),
  }));

  return resultForContext(
    { rounds },
    loaded.context,
    rounds.every(({ matches }) => matches.length === 0),
  );
}

function bracketSlot(
  countryId: string | null,
  sourceSlot: MatchSourceSlot | null,
  countriesById: ReadonlyMap<string, { name: string }>,
): BracketSlotModel {
  if (countryId !== null) {
    return {
      kind: "country",
      countryId,
      name: countriesById.get(countryId)?.name ?? countryId,
    };
  }
  if (sourceSlot !== null) {
    return { kind: "source", ...sourceSlot };
  }
  return { kind: "unresolved" };
}

function matchSummary(match: MatchRecord): MatchSummaryModel {
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    status: match.status,
    homeCountryId: match.homeCountryId,
    awayCountryId: match.awayCountryId,
    homeGoals: match.homeGoals,
    awayGoals: match.awayGoals,
    homeShootoutGoals: match.homeShootoutGoals,
    awayShootoutGoals: match.awayShootoutGoals,
    advancingCountryId: match.advancingCountryId,
    scheduledAt: match.scheduledAt,
  };
}
