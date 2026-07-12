import { isCompletedMatch } from "./match-validation";
import type {
  CountryId,
  DomainMatch,
  GroupQualification,
  GroupStanding,
} from "./types";

export type GroupStandingOverride = Readonly<{
  countryId: CountryId;
  officialRank?: number;
  qualifiedForRoundOf32?: boolean;
  reason: string;
  source: string;
}>;

export type RankedGroupStanding = Readonly<{
  standing: GroupStanding;
  calculatedRank: number;
  officialRank?: number;
  qualifiedForRoundOf32?: boolean;
  resolutionSource: "calculated" | "override";
  resolutionReason?: string;
  resolutionAuthority?: string;
}>;

export type BestThirdPlaceQualificationResult =
  | Readonly<{
      status: "resolved";
      qualifications: readonly GroupQualification[];
    }>
  | Readonly<{
      status: "requires_resolution";
      guaranteedQualifications: readonly GroupQualification[];
      tiedCountryIds: readonly CountryId[];
      availablePlaces: number;
    }>;

type MutableStanding = {
  countryId: CountryId;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export function calculateGroupStandings(
  countryIds: readonly CountryId[],
  matches: readonly DomainMatch[],
): GroupStanding[] {
  const uniqueCountryIds = [...new Set(countryIds)];
  const groupCountryIds = new Set(uniqueCountryIds);
  const standings = new Map(
    uniqueCountryIds.map((countryId) => [countryId, emptyStanding(countryId)]),
  );

  for (const match of matches) {
    if (
      match.stage !== "group" ||
      !isCompletedMatch(match) ||
      match.homeCountryId === null ||
      match.awayCountryId === null ||
      match.homeGoals === null ||
      match.awayGoals === null ||
      !groupCountryIds.has(match.homeCountryId) ||
      !groupCountryIds.has(match.awayCountryId)
    ) {
      continue;
    }

    const home = standings.get(match.homeCountryId);
    const away = standings.get(match.awayCountryId);

    if (home === undefined || away === undefined) {
      continue;
    }

    recordMatch(home, match.homeGoals, match.awayGoals);
    recordMatch(away, match.awayGoals, match.homeGoals);
  }

  return uniqueCountryIds.map((countryId) => ({
    ...standings.get(countryId)!,
  }));
}

export function rankGroupStandings(
  standings: readonly GroupStanding[],
  overrides: readonly GroupStandingOverride[] = [],
): RankedGroupStanding[] {
  const overridesByCountry = new Map<CountryId, GroupStandingOverride>();

  for (const override of overrides) {
    if (override.reason.trim() === "" || override.source.trim() === "") {
      throw new Error("A group override requires a reason and source.");
    }
    if (overridesByCountry.has(override.countryId)) {
      throw new Error(`Duplicate group override for ${override.countryId}.`);
    }
    overridesByCountry.set(override.countryId, override);
  }

  const sorted = sortStandings(standings);
  let calculatedRank = 0;
  let previous: GroupStanding | undefined;

  return sorted.map((standing, index) => {
    if (previous === undefined || !sameOrderingValues(standing, previous)) {
      calculatedRank = index + 1;
      previous = standing;
    }

    const override = overridesByCountry.get(standing.countryId);
    if (override === undefined) {
      return {
        standing: { ...standing },
        calculatedRank,
        resolutionSource: "calculated",
      };
    }

    return {
      standing: { ...standing },
      calculatedRank,
      officialRank: override.officialRank,
      qualifiedForRoundOf32: override.qualifiedForRoundOf32,
      resolutionSource: "override",
      resolutionReason: override.reason,
      resolutionAuthority: override.source,
    };
  });
}

export function resolveBestThirdPlaceQualifications(
  thirdPlaceStandings: readonly GroupStanding[],
  resolvedBoundaryQualifications: readonly GroupQualification[] = [],
): BestThirdPlaceQualificationResult {
  const qualificationPlaces = 8;
  const sorted = sortStandings(thirdPlaceStandings);

  if (sorted.length < qualificationPlaces) {
    throw new RangeError("At least eight third-place standings are required.");
  }

  assertUniqueCountries(sorted);
  const cutoff = sorted[qualificationPlaces - 1]!;
  const tiedCountryIds = sorted
    .filter((standing) => sameOrderingValues(standing, cutoff))
    .map((standing) => standing.countryId);
  const firstTiedIndex = sorted.findIndex((standing) =>
    sameOrderingValues(standing, cutoff),
  );
  const tieCrossesBoundary =
    firstTiedIndex < qualificationPlaces &&
    firstTiedIndex + tiedCountryIds.length > qualificationPlaces;

  if (!tieCrossesBoundary) {
    return {
      status: "resolved",
      qualifications: sorted.map((standing, index) => ({
        countryId: standing.countryId,
        qualifiedForRoundOf32: index < qualificationPlaces,
        source: "calculated",
      })),
    };
  }

  const availablePlaces = qualificationPlaces - firstTiedIndex;
  const boundaryResolution = new Map(
    resolvedBoundaryQualifications.map((qualification) => [
      qualification.countryId,
      qualification,
    ]),
  );
  const resolvedTiedCountries = tiedCountryIds.map((countryId) =>
    boundaryResolution.get(countryId),
  );
  const hasCompleteResolution = resolvedTiedCountries.every(
    (qualification) => qualification !== undefined,
  );
  const resolvedQualifiers = resolvedTiedCountries.filter(
    (qualification) => qualification?.qualifiedForRoundOf32,
  ).length;

  if (!hasCompleteResolution || resolvedQualifiers !== availablePlaces) {
    return {
      status: "requires_resolution",
      guaranteedQualifications: sorted
        .slice(0, firstTiedIndex)
        .map((standing) => ({
          countryId: standing.countryId,
          qualifiedForRoundOf32: true,
          source: "calculated",
        })),
      tiedCountryIds,
      availablePlaces,
    };
  }

  return {
    status: "resolved",
    qualifications: sorted.map((standing, index) => {
      const boundaryQualification = boundaryResolution.get(standing.countryId);
      if (boundaryQualification !== undefined) {
        return { ...boundaryQualification };
      }

      return {
        countryId: standing.countryId,
        qualifiedForRoundOf32: index < firstTiedIndex,
        source: "calculated",
      };
    }),
  };
}

function emptyStanding(countryId: CountryId): MutableStanding {
  return {
    countryId,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function recordMatch(
  standing: MutableStanding,
  goalsFor: number,
  goalsAgainst: number,
): void {
  standing.played += 1;
  standing.goalsFor += goalsFor;
  standing.goalsAgainst += goalsAgainst;
  standing.goalDifference = standing.goalsFor - standing.goalsAgainst;

  if (goalsFor > goalsAgainst) {
    standing.wins += 1;
    standing.points += 3;
  } else if (goalsFor < goalsAgainst) {
    standing.losses += 1;
  } else {
    standing.draws += 1;
    standing.points += 1;
  }
}

function sortStandings(standings: readonly GroupStanding[]): GroupStanding[] {
  return standings
    .map((standing, originalIndex) => ({ standing, originalIndex }))
    .sort((left, right) => {
      const comparison = compareStandings(left.standing, right.standing);
      return comparison === 0
        ? left.originalIndex - right.originalIndex
        : comparison;
    })
    .map(({ standing }) => ({ ...standing }));
}

function compareStandings(left: GroupStanding, right: GroupStanding): number {
  return (
    right.points - left.points ||
    right.goalDifference - left.goalDifference ||
    right.goalsFor - left.goalsFor
  );
}

function sameOrderingValues(
  left: GroupStanding,
  right: GroupStanding,
): boolean {
  return (
    left.points === right.points &&
    left.goalDifference === right.goalDifference &&
    left.goalsFor === right.goalsFor
  );
}

function assertUniqueCountries(standings: readonly GroupStanding[]): void {
  const countryIds = new Set<CountryId>();
  for (const standing of standings) {
    if (countryIds.has(standing.countryId)) {
      throw new Error(`Duplicate standing for ${standing.countryId}.`);
    }
    countryIds.add(standing.countryId);
  }
}
