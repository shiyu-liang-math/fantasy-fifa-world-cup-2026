import {
  calculateCountryGoals,
  calculateParticipantGoals,
} from "../../domain/goals";
import { rankWithTies, STAR_RANKING_TOLERANCE } from "../../domain/ranking";
import {
  calculateCountryStars,
  calculateParticipantStars,
} from "../../domain/scoring";
import { deriveProgression } from "../../domain/progression";
import type { DraftPick, ProgressionState } from "../../domain/types";
import type { TournamentDataSnapshot } from "../../data/types";
import { validateCanonicalData } from "../../data/validation";
import type { TournamentRepository } from "../../repositories/tournament-repository";
import type {
  CountryContributionModel,
  GoldenCupStatus,
  PageModelResult,
  ParticipantStandingModel,
} from "./types";

type PageContext = Readonly<{
  snapshot: TournamentDataSnapshot;
  incompleteReasons: readonly string[];
}>;

type CompetitionProjection = Readonly<{
  participants: readonly ParticipantStandingModel[];
}>;

export async function loadPageContext(
  repository: TournamentRepository,
): Promise<
  | Readonly<{ status: "ok"; context: PageContext }>
  | Readonly<{ status: "missing_tournament" }>
  | Readonly<{ status: "invalid"; issues: readonly string[] }>
> {
  const snapshot = await repository.getSnapshot();
  const { tournament } = snapshot;

  if (tournament === null) {
    return { status: "missing_tournament" };
  }

  const issues = validateCanonicalData(snapshot);
  const errors = issues.filter(({ severity }) => severity === "error");

  if (errors.length > 0) {
    return { status: "invalid", issues: errors.map(({ message }) => message) };
  }

  return {
    status: "ok",
    context: {
      snapshot,
      incompleteReasons: [
        ...new Set([
          ...issues
            .filter(({ severity }) => severity === "incomplete")
            .map(({ message }) => message),
          ...tournament.missingOfficialData,
        ]),
      ],
    },
  };
}

export function deriveCompetition(
  snapshot: TournamentDataSnapshot,
): CompetitionProjection {
  const progression = deriveProgression({
    countryIds: snapshot.countries.map(({ id }) => id),
    matches: snapshot.matches,
    groupQualifications: snapshot.groupQualifications,
  });
  const progressionByCountry = new Map(
    progression.map((state) => [state.countryId, state]),
  );
  const resultsByCountry = new Map(
    progression.map(({ countryId, result }) => [countryId, result]),
  );
  const participantTotals = snapshot.participants.map((participant) => {
    const picks = snapshot.draftPicks.filter(
      (pick) => pick.participantId === participant.id,
    );
    return {
      participant,
      picks,
      stars: calculateParticipantStars(picks, resultsByCountry),
      goals: calculateParticipantGoals(picks, snapshot.matches),
    };
  });
  const starRankings = rankWithTies(participantTotals, ({ stars }) => stars, {
    tolerance: STAR_RANKING_TOLERANCE,
  });
  const goalRankings = rankWithTies(participantTotals, ({ goals }) => goals);
  const starRankByParticipant = new Map(
    starRankings.map(({ entry, rank }) => [entry.participant.id, rank]),
  );
  const goalRankByParticipant = new Map(
    goalRankings.map(({ entry, rank }) => [entry.participant.id, rank]),
  );
  const countriesById = new Map(
    snapshot.countries.map((country) => [country.id, country]),
  );

  const participants = participantTotals
    .map(({ participant, picks, stars, goals }): ParticipantStandingModel => {
      const countries = picks.flatMap((pick) => {
        const country = countriesById.get(pick.countryId);
        const progressionState = progressionByCountry.get(pick.countryId);
        if (country === undefined || progressionState === undefined) return [];

        return [
          countryContribution(
            country,
            pick,
            progressionState,
            snapshot.matches,
          ),
        ];
      });

      return {
        participantId: participant.id,
        slug: participant.slug,
        name: participant.name,
        abbreviation: participant.abbreviation,
        displayOrder: participant.displayOrder,
        stars,
        starRank: starRankByParticipant.get(participant.id) ?? 0,
        goals,
        goalRank: goalRankByParticipant.get(participant.id) ?? 0,
        activeCountryCount: countries.filter(
          ({ isEliminated }) => !isEliminated,
        ).length,
        goldenCupStatus: participantGoldenCupStatus(countries),
        countries,
      };
    })
    .sort((left, right) => left.displayOrder - right.displayOrder);

  return { participants };
}

export function resultForContext<T>(
  data: T,
  context: PageContext,
  isEmpty = false,
): PageModelResult<T> {
  if (context.incompleteReasons.length > 0) {
    return { status: "incomplete", data, missing: context.incompleteReasons };
  }
  return isEmpty ? { status: "empty", data } : { status: "ready", data };
}

export function passthroughContextFailure<T>(
  result:
    | Readonly<{ status: "missing_tournament" }>
    | Readonly<{ status: "invalid"; issues: readonly string[] }>,
): PageModelResult<T> {
  return result;
}

function countryContribution(
  country: TournamentDataSnapshot["countries"][number],
  pick: DraftPick,
  progression: ProgressionState,
  matches: TournamentDataSnapshot["matches"],
): CountryContributionModel {
  return {
    countryId: country.id,
    name: country.name,
    fifaCode: country.fifaCode,
    draftValue: pick.draftValue,
    result: progression.result,
    stars: calculateCountryStars(pick.draftValue, progression.result),
    goals: calculateCountryGoals(matches, country.id),
    isEliminated: progression.isEliminated,
    goldenCupStatus:
      progression.result === "champion"
        ? "winner"
        : progression.isEliminated
          ? "eliminated"
          : "contender",
  };
}

function participantGoldenCupStatus(
  countries: readonly CountryContributionModel[],
): GoldenCupStatus {
  if (countries.some(({ goldenCupStatus }) => goldenCupStatus === "winner")) {
    return "winner";
  }
  return countries.some(
    ({ goldenCupStatus }) => goldenCupStatus === "contender",
  )
    ? "contender"
    : "eliminated";
}
