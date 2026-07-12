export type CountryId = string;
export type MatchId = string;
export type ParticipantId = string;

export type DraftValue = 1 | 2 | 3;

export type MatchStatus =
  "scheduled" | "live" | "completed" | "postponed" | "cancelled";

export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "final";

export type CountryResult =
  | "before_round_of_32"
  | "round_of_32"
  | "round_of_16"
  | "quarterfinal"
  | "semifinal"
  | "third_place"
  | "fourth_place"
  | "runner_up"
  | "champion";

export type DomainMatch = Readonly<{
  id: MatchId;
  stage: MatchStage;
  status: MatchStatus;
  homeCountryId: CountryId | null;
  awayCountryId: CountryId | null;
  homeGoals: number | null;
  awayGoals: number | null;
  wentToExtraTime: boolean;
  homeShootoutGoals: number | null;
  awayShootoutGoals: number | null;
  advancingCountryId: CountryId | null;
}>;

export type DraftPick = Readonly<{
  participantId: ParticipantId;
  countryId: CountryId;
  draftValue: DraftValue;
}>;

export type GroupStanding = Readonly<{
  countryId: CountryId;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}>;

export type GroupQualification = Readonly<{
  countryId: CountryId;
  qualifiedForRoundOf32: boolean;
  source: "calculated" | "override";
}>;

export type ProgressionState = Readonly<{
  countryId: CountryId;
  result: CountryResult;
  isEliminated: boolean;
}>;

export type ValidationIssue = Readonly<{
  code: string;
  field?: keyof DomainMatch;
  message: string;
}>;

export type RankedEntry<T> = Readonly<{
  rank: number;
  value: number;
  entry: T;
}>;
