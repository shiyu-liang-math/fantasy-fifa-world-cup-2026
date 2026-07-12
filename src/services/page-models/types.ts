import type {
  CountryResult,
  GroupStanding,
  MatchStatus,
} from "../../domain/types";
import type { GroupCode, SourceOutcome } from "../../data/types";

export type PageModelResult<T> =
  | Readonly<{ status: "ready"; data: T }>
  | Readonly<{ status: "empty"; data: T }>
  | Readonly<{ status: "incomplete"; data: T; missing: readonly string[] }>
  | Readonly<{ status: "not_found"; entity: "participant"; identifier: string }>
  | Readonly<{ status: "missing_tournament" }>
  | Readonly<{ status: "invalid"; issues: readonly string[] }>;

export type GoldenCupStatus = "contender" | "eliminated" | "winner";

export type CountryContributionModel = Readonly<{
  countryId: string;
  name: string;
  fifaCode: string;
  draftValue: 1 | 2 | 3;
  result: CountryResult;
  stars: number;
  goals: number;
  isEliminated: boolean;
  goldenCupStatus: GoldenCupStatus;
}>;

export type ParticipantStandingModel = Readonly<{
  participantId: string;
  slug: string;
  name: string;
  abbreviation: string;
  displayOrder: number;
  stars: number;
  starRank: number;
  goals: number;
  goalRank: number;
  activeCountryCount: number;
  goldenCupStatus: GoldenCupStatus;
  countries: readonly CountryContributionModel[];
}>;

export type DashboardPageModel = Readonly<{
  tournamentName: string;
  currentRoundName: string | null;
  lastUpdatedAt: string;
  participants: readonly ParticipantStandingModel[];
}>;

export type HomePageModel = Readonly<{
  tournamentName: string;
  currentRoundName: string | null;
  lastUpdatedAt: string;
  goldenStarLeaders: readonly Readonly<{
    participantId: string;
    name: string;
    stars: number;
  }>[];
  goldenGoalLeaders: readonly Readonly<{
    participantId: string;
    name: string;
    goals: number;
  }>[];
  goldenCup: Readonly<{
    status: "unresolved" | "resolved";
    winnerParticipantId: string | null;
    contenderCountryCount: number;
  }>;
}>;

export type TournamentOverviewPageModel = Readonly<{
  tournamentName: string;
  year: number;
  status: "planned" | "active" | "completed";
  currentRoundName: string | null;
  representedCountryCount: number;
  expectedCountryCount: 48;
  groupCount: number;
  knockoutMatchCount: number;
  referenceDataComplete: boolean;
  missingOfficialData: readonly string[];
}>;

export type AwardRankingEntry = Readonly<{
  participantId: string;
  name: string;
  abbreviation: string;
  rank: number;
  value: number;
}>;

export type AwardsPageModel = Readonly<{
  goldenStar: readonly AwardRankingEntry[];
  goldenGoal: readonly AwardRankingEntry[];
  goldenCup: Readonly<{
    status: "unresolved" | "resolved";
    winnerParticipantId: string | null;
    winnerCountryId: string | null;
    contenders: readonly Readonly<{
      participantId: string;
      countryIds: readonly string[];
    }>[];
  }>;
}>;

export type ParticipantDetailPageModel = Readonly<{
  participant: Readonly<{
    id: string;
    slug: string;
    name: string;
    abbreviation: string;
  }>;
  stars: number;
  starRank: number;
  goals: number;
  goalRank: number;
  goldenCupStatus: GoldenCupStatus;
  countries: readonly CountryContributionModel[];
}>;

export type GroupCountryRowModel = Readonly<{
  countryId: string;
  name: string;
  fifaCode: string;
  owner: Readonly<{
    participantId: string;
    name: string;
    abbreviation: string;
  }> | null;
  standing: GroupStanding;
  calculatedRank: number;
  officialRank?: number;
  qualificationStatus: "qualified" | "not_qualified" | "unresolved";
  resolutionSource: "calculated" | "override";
  overrideReason?: string;
}>;

export type MatchSummaryModel = Readonly<{
  id: string;
  matchNumber: number;
  status: MatchStatus;
  homeCountryId: string | null;
  awayCountryId: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeShootoutGoals: number | null;
  awayShootoutGoals: number | null;
  advancingCountryId: string | null;
  scheduledAt: string | null;
}>;

export type GroupSectionModel = Readonly<{
  code: GroupCode;
  countries: readonly GroupCountryRowModel[];
  completedMatches: readonly MatchSummaryModel[];
  upcomingMatches: readonly MatchSummaryModel[];
}>;

export type GroupsPageModel = Readonly<{
  groups: readonly GroupSectionModel[];
}>;

export type BracketSlotModel =
  | Readonly<{ kind: "country"; countryId: string; name: string }>
  | Readonly<{
      kind: "source";
      sourceMatchId: string;
      outcome: SourceOutcome;
    }>
  | Readonly<{ kind: "unresolved" }>;

export type BracketMatchModel = MatchSummaryModel &
  Readonly<{
    homeSlot: BracketSlotModel;
    awaySlot: BracketSlotModel;
  }>;

export type BracketRoundModel = Readonly<{
  roundId: string;
  name: string;
  matches: readonly BracketMatchModel[];
}>;

export type BracketPageModel = Readonly<{
  rounds: readonly BracketRoundModel[];
}>;

export type RulesPageModel = Readonly<{
  version: string;
  updatedAt: string;
  draftValues: readonly number[];
  draftValueExplanation: string;
  starStages: readonly Readonly<{
    result: CountryResult;
    label: string;
    valueOneStars: number;
  }>[];
  goldenGoal: Readonly<{
    includesGroupStage: boolean;
    shootoutKicksExcluded: boolean;
    completedMatchesOnly: true;
  }>;
  goldenCupRule: string;
  rankingMethod: "standard_competition";
  starRankingTolerance: number;
}>;
