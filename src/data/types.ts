import type {
  CountryId,
  DomainMatch,
  DraftValue,
  GroupQualification,
  MatchId,
  MatchStage,
  ParticipantId,
} from "../domain/types";

export type TournamentId = string;
export type RoundId = string;
export type GroupCode =
  "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L";

export type Tournament = Readonly<{
  id: TournamentId;
  name: string;
  year: number;
  status: "planned" | "active" | "completed";
  currentRoundId: RoundId | null;
  lastUpdatedAt: string;
  referenceDataComplete: boolean;
  missingOfficialData: readonly string[];
}>;

export type Participant = Readonly<{
  id: ParticipantId;
  slug: string;
  name: string;
  abbreviation: string;
  displayOrder: number;
}>;

export type Country = Readonly<{
  id: CountryId;
  name: string;
  fifaCode: string;
  groupCode: GroupCode | null;
}>;

export type DraftPickRecord = Readonly<{
  id: string;
  tournamentId: TournamentId;
  participantId: ParticipantId;
  countryId: CountryId;
  draftValue: DraftValue;
}>;

export type TournamentRound = Readonly<{
  id: RoundId;
  tournamentId: TournamentId;
  stage: MatchStage;
  name: string;
  phase: "group" | "knockout" | "placement";
  displayOrder: number;
}>;

export type TournamentGroup = Readonly<{
  code: GroupCode;
  tournamentId: TournamentId;
  displayOrder: number;
  countryIds: readonly CountryId[];
}>;

export type SourceOutcome = "winner" | "loser";

export type MatchSourceSlot = Readonly<{
  sourceMatchId: MatchId;
  outcome: SourceOutcome;
}>;

export type MatchRecord = DomainMatch &
  Readonly<{
    tournamentId: TournamentId;
    roundId: RoundId;
    matchNumber: number;
    scheduledAt: string | null;
    homeSourceSlot: MatchSourceSlot | null;
    awaySourceSlot: MatchSourceSlot | null;
    dataClassification: "official_reference" | "fictional_development";
  }>;

export type GroupQualificationOverrideRecord = Readonly<{
  id: string;
  setId?: string;
  tournamentId: TournamentId;
  groupCode: GroupCode;
  countryId: CountryId;
  officialRank?: number;
  qualifiedForRoundOf32?: boolean;
  reason: string;
  source: string;
}>;

export type RulesMetadata = Readonly<{
  version: string;
  updatedAt: string;
  goldenGoalIncludesGroupStage: true;
  shootoutKicksExcluded: true;
  rankingMethod: "standard_competition";
  starRankingTolerance: number;
}>;

export type TournamentDataSnapshot = Readonly<{
  tournament: Tournament | null;
  participants: readonly Participant[];
  countries: readonly Country[];
  draftPicks: readonly DraftPickRecord[];
  rounds: readonly TournamentRound[];
  groups: readonly TournamentGroup[];
  matches: readonly MatchRecord[];
  groupQualifications: readonly GroupQualification[];
  groupOverrides: readonly GroupQualificationOverrideRecord[];
  rules: RulesMetadata;
  datasetKind: "official_reference" | "fictional_development";
}>;
