import structureArtifact from "../../../data/official/fifa-world-cup-2026.structure.json";
import resultsArtifact from "../../../data/official/fifa-world-cup-2026.results.2026-07-15T05-56-29Z.json";
import { deriveGroupQualifications } from "../../domain/group-qualification";
import { REFERENCE_DRAFT_PICKS } from "../reference/draft-picks";
import { REFERENCE_PARTICIPANTS } from "../reference/participants";
import type {
  Country,
  GroupCode,
  MatchRecord,
  TournamentDataSnapshot,
  TournamentGroup,
  TournamentRound,
} from "../types";
import { validateOfficialTournamentData } from "./validation";

export const OFFICIAL_STRUCTURE_ARTIFACT = structureArtifact;
export const OFFICIAL_RESULTS_ARTIFACT = resultsArtifact;

const tournamentId = structureArtifact.tournament.id;
const resultByMatch = new Map(
  resultsArtifact.completedResults.map((result) => [result.matchId, result]),
);
const groupByCountry = new Map(
  structureArtifact.groups.flatMap((group) =>
    group.countryIds.map((countryId) => [countryId, group.code] as const),
  ),
);

const countries: readonly Country[] = structureArtifact.countries.map(
  (country) => ({
    id: country.id,
    name: country.displayName,
    fifaCode: country.fifaCode,
    groupCode: (groupByCountry.get(country.id) ?? null) as GroupCode | null,
  }),
);

const groups: readonly TournamentGroup[] = structureArtifact.groups.map(
  (group, index) => ({
    code: group.code as GroupCode,
    tournamentId,
    displayOrder: index + 1,
    countryIds: group.countryIds,
  }),
);

const rounds: readonly TournamentRound[] = [
  round("group", "group", "Group stage", "group", 1),
  round("round-of-32", "round_of_32", "Round of 32", "knockout", 2),
  round("round-of-16", "round_of_16", "Round of 16", "knockout", 3),
  round("quarterfinal", "quarterfinal", "Quarterfinals", "knockout", 4),
  round("semifinal", "semifinal", "Semifinals", "knockout", 5),
  round("third-place", "third_place", "Third-place match", "placement", 6),
  round("final", "final", "Final", "placement", 7),
];

const matches: readonly MatchRecord[] = structureArtifact.fixtures.map(
  (fixture) => {
    const result = resultByMatch.get(fixture.id);
    return {
      id: fixture.id,
      tournamentId,
      roundId: fixture.roundId,
      stage: fixture.stage as MatchRecord["stage"],
      matchNumber: fixture.matchNumber,
      status: result === undefined ? "scheduled" : "completed",
      scheduledAt: fixture.scheduledAt,
      homeCountryId: fixture.homeCountryId,
      awayCountryId: fixture.awayCountryId,
      homeGoals: result?.homeGoals ?? null,
      awayGoals: result?.awayGoals ?? null,
      wentToExtraTime: result?.wentToExtraTime ?? false,
      homeShootoutGoals: result?.homeShootoutGoals ?? null,
      awayShootoutGoals: result?.awayShootoutGoals ?? null,
      advancingCountryId: result?.advancingCountryId ?? null,
      homeSourceSlot: fixture.homeSourceSlot as MatchRecord["homeSourceSlot"],
      awaySourceSlot: fixture.awaySourceSlot as MatchRecord["awaySourceSlot"],
      dataClassification: "official_reference",
    };
  },
);

const withoutQualifications: TournamentDataSnapshot = {
  tournament: {
    id: tournamentId,
    name: structureArtifact.tournament.name,
    year: structureArtifact.tournament.year,
    status: "active",
    currentRoundId: "semifinal",
    lastUpdatedAt: new Date(resultsArtifact.officialAsOf).toISOString(),
    referenceDataComplete: true,
    missingOfficialData: [],
  },
  participants: REFERENCE_PARTICIPANTS,
  countries,
  draftPicks: REFERENCE_DRAFT_PICKS,
  rounds,
  groups,
  matches,
  groupQualifications: [],
  groupOverrides: resultsArtifact.groupOverrides,
  rules: {
    version: "2026-07-12",
    updatedAt: "2026-07-12",
    goldenGoalIncludesGroupStage: true,
    shootoutKicksExcluded: true,
    rankingMethod: "standard_competition",
    starRankingTolerance: 0.01,
  },
  datasetKind: "official_reference",
};

export const OFFICIAL_TOURNAMENT_SNAPSHOT: TournamentDataSnapshot = {
  ...withoutQualifications,
  groupQualifications: deriveGroupQualifications(withoutQualifications),
};

validateOfficialTournamentData(
  OFFICIAL_STRUCTURE_ARTIFACT,
  OFFICIAL_RESULTS_ARTIFACT,
  OFFICIAL_TOURNAMENT_SNAPSHOT,
);

function round(
  id: string,
  stage: TournamentRound["stage"],
  name: string,
  phase: TournamentRound["phase"],
  displayOrder: number,
): TournamentRound {
  return { id, tournamentId, stage, name, phase, displayOrder };
}
