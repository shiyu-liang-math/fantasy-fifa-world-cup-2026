import type { GroupQualification } from "../../domain/types";
import { REFERENCE_COUNTRIES } from "../reference/countries";
import { REFERENCE_DRAFT_PICKS } from "../reference/draft-picks";
import { REFERENCE_PARTICIPANTS } from "../reference/participants";
import { REFERENCE_GROUPS, REFERENCE_ROUNDS } from "../reference/rounds";
import { REFERENCE_RULES, REFERENCE_TOURNAMENT } from "../reference/tournament";
import type {
  Country,
  GroupCode,
  MatchRecord,
  TournamentDataSnapshot,
  TournamentGroup,
} from "../types";

const DEVELOPMENT_MATCHES: readonly MatchRecord[] = [
  developmentMatch({
    id: "dev-group-win",
    matchNumber: 1001,
    roundId: "group",
    stage: "group",
    homeCountryId: "france",
    awayCountryId: "spain",
    homeGoals: 2,
    awayGoals: 1,
    advancingCountryId: null,
  }),
  developmentMatch({
    id: "dev-group-draw",
    matchNumber: 1002,
    roundId: "group",
    stage: "group",
    homeCountryId: "portugal",
    awayCountryId: "argentina",
    homeGoals: 1,
    awayGoals: 1,
    advancingCountryId: null,
  }),
  developmentMatch({
    id: "dev-r32-shootout",
    matchNumber: 1033,
    roundId: "round-of-32",
    stage: "round_of_32",
    homeCountryId: "brazil",
    awayCountryId: "germany",
    homeGoals: 1,
    awayGoals: 1,
    wentToExtraTime: true,
    homeShootoutGoals: 5,
    awayShootoutGoals: 4,
    advancingCountryId: "brazil",
  }),
  developmentMatch({
    id: "dev-r32-scheduled",
    matchNumber: 1034,
    roundId: "round-of-32",
    stage: "round_of_32",
    status: "scheduled",
    homeCountryId: "mexico",
    awayCountryId: "japan",
    homeGoals: null,
    awayGoals: null,
    advancingCountryId: null,
    scheduledAt: "2026-07-01T18:00:00.000Z",
  }),
  developmentMatch({
    id: "dev-qf-unresolved",
    matchNumber: 1060,
    roundId: "quarterfinal",
    stage: "quarterfinal",
    status: "scheduled",
    homeCountryId: null,
    awayCountryId: null,
    homeGoals: null,
    awayGoals: null,
    advancingCountryId: null,
    homeSourceSlot: { sourceMatchId: "dev-r32-shootout", outcome: "winner" },
    awaySourceSlot: { sourceMatchId: "dev-r32-scheduled", outcome: "winner" },
    scheduledAt: "2026-07-05T18:00:00.000Z",
  }),
  developmentMatch({
    id: "dev-semifinal-one",
    matchNumber: 1069,
    roundId: "semifinal",
    stage: "semifinal",
    homeCountryId: "france",
    awayCountryId: "argentina",
    homeGoals: 2,
    awayGoals: 0,
    advancingCountryId: "france",
  }),
  developmentMatch({
    id: "dev-semifinal-two",
    matchNumber: 1070,
    roundId: "semifinal",
    stage: "semifinal",
    homeCountryId: "spain",
    awayCountryId: "portugal",
    homeGoals: 1,
    awayGoals: 0,
    advancingCountryId: "spain",
  }),
  developmentMatch({
    id: "dev-third-place",
    matchNumber: 1071,
    roundId: "third-place",
    stage: "third_place",
    homeCountryId: "argentina",
    awayCountryId: "portugal",
    homeGoals: 1,
    awayGoals: 2,
    advancingCountryId: "portugal",
  }),
  developmentMatch({
    id: "dev-final",
    matchNumber: 1072,
    roundId: "final",
    stage: "final",
    homeCountryId: "france",
    awayCountryId: "spain",
    homeGoals: 3,
    awayGoals: 2,
    advancingCountryId: "france",
  }),
];

function developmentMatch(
  input: Pick<
    MatchRecord,
    | "id"
    | "matchNumber"
    | "roundId"
    | "stage"
    | "homeCountryId"
    | "awayCountryId"
    | "homeGoals"
    | "awayGoals"
    | "advancingCountryId"
  > &
    Partial<MatchRecord>,
): MatchRecord {
  return {
    tournamentId: "fifa-world-cup-2026",
    status: "completed",
    wentToExtraTime: false,
    homeShootoutGoals: null,
    awayShootoutGoals: null,
    scheduledAt: null,
    homeSourceSlot: null,
    awaySourceSlot: null,
    dataClassification: "fictional_development",
    ...input,
  };
}

function developmentCountries(): readonly Country[] {
  const assignments: Readonly<Record<string, GroupCode>> = {
    france: "A",
    spain: "A",
    portugal: "A",
    argentina: "A",
    brazil: "B",
    germany: "B",
    england: "B",
    mexico: "B",
    japan: "C",
  };

  return REFERENCE_COUNTRIES.map((country) => ({
    ...country,
    groupCode: assignments[country.id] ?? null,
  }));
}

function developmentGroups(): readonly TournamentGroup[] {
  const countries = developmentCountries();
  return REFERENCE_GROUPS.map((group) => ({
    ...group,
    countryIds: countries
      .filter((country) => country.groupCode === group.code)
      .map((country) => country.id),
  }));
}

function developmentQualifications(): readonly GroupQualification[] {
  const qualified = new Set([
    "france",
    "spain",
    "portugal",
    "argentina",
    "brazil",
    "germany",
    "mexico",
    "japan",
  ]);

  return REFERENCE_COUNTRIES.map((country) => ({
    countryId: country.id,
    qualifiedForRoundOf32: qualified.has(country.id),
    source: "calculated",
  }));
}

/**
 * Fictional, deterministic data for tests and development previews only.
 * It is deliberately isolated from REFERENCE_SNAPSHOT and must never be used
 * as an official production seed.
 */
export const FICTIONAL_DEVELOPMENT_SNAPSHOT: TournamentDataSnapshot = {
  tournament: {
    ...REFERENCE_TOURNAMENT,
    status: "completed",
    currentRoundId: "final",
    lastUpdatedAt: "2026-07-19T22:00:00.000Z",
    referenceDataComplete: false,
    missingOfficialData: [
      ...REFERENCE_TOURNAMENT.missingOfficialData,
      "This entire match scenario is fictional development data",
    ],
  },
  participants: REFERENCE_PARTICIPANTS,
  countries: developmentCountries(),
  draftPicks: REFERENCE_DRAFT_PICKS,
  rounds: REFERENCE_ROUNDS,
  groups: developmentGroups(),
  matches: DEVELOPMENT_MATCHES,
  groupQualifications: developmentQualifications(),
  groupOverrides: [],
  rules: REFERENCE_RULES,
  datasetKind: "fictional_development",
};
