import type { CountryId, MatchId, MatchStatus } from "../types";
import type {
  GroupCode,
  MatchSourceSlot,
  TournamentDataSnapshot,
} from "../../data/types";

export type OfficialFixture = Readonly<{
  id: MatchId;
  roundId: string;
  matchNumber: number;
  scheduledAt: string | null;
  status?: Exclude<MatchStatus, "completed">;
  homeCountryId: CountryId | null;
  awayCountryId: CountryId | null;
  homeSourceSlot?: MatchSourceSlot | null;
  awaySourceSlot?: MatchSourceSlot | null;
}>;

export type CompletedResult = Readonly<{
  matchId: MatchId;
  homeGoals: number;
  awayGoals: number;
  wentToExtraTime?: boolean;
  homeShootoutGoals?: number | null;
  awayShootoutGoals?: number | null;
  advancingCountryId?: CountryId | null;
}>;

export type GroupOverrideInput = Readonly<{
  id: string;
  groupCode: GroupCode;
  orderedCountryIds: readonly CountryId[];
  reason: string;
  source: string;
}>;

export type TournamentMetadataUpdate = Readonly<{
  status?: "planned" | "active" | "completed";
  currentRoundId?: string | null;
  referenceDataComplete?: boolean;
  missingOfficialData?: readonly string[];
}>;

export type AdministrationCommand =
  | Readonly<{ type: "upsert_fixture"; fixture: OfficialFixture }>
  | Readonly<{ type: "record_result"; result: CompletedResult }>
  | Readonly<{
      type: "replace_result";
      result: CompletedResult;
      reason: string;
    }>
  | Readonly<{ type: "set_group_override"; override: GroupOverrideInput }>
  | Readonly<{
      type: "replace_group_override";
      replacedOverrideId: string;
      override: GroupOverrideInput;
    }>
  | Readonly<{ type: "remove_group_override"; overrideId: string }>
  | Readonly<{
      type: "set_knockout_participants";
      matchId: MatchId;
      homeCountryId: CountryId | null;
      awayCountryId: CountryId | null;
    }>
  | Readonly<{
      type: "update_tournament_metadata";
      update: TournamentMetadataUpdate;
    }>;

export type AdministrationIssue = Readonly<{
  commandIndex: number;
  code: string;
  message: string;
}>;

export type AdministrationAffectedData = Readonly<{
  matchIds: readonly MatchId[];
  groupCodes: readonly GroupCode[];
  countryIds: readonly CountryId[];
  fixturesChanged: boolean;
  resultsChanged: boolean;
  standingsChanged: boolean;
  qualificationsChanged: boolean;
  knockoutParticipantsChanged: boolean;
  advancementChanged: boolean;
  leaderboardChanged: boolean;
  goldenStarChanged: boolean;
  goldenGoalChanged: boolean;
  goldenCupChanged: boolean;
  awardsChanged: boolean;
  tournamentMetadataChanged: boolean;
  publicPageModelsChanged: boolean;
}>;

export type AdministrationProposal = Readonly<{
  commands: readonly AdministrationCommand[];
  baseRevision: string;
  commandsRevision: string;
  resultRevision: string;
  proposalRevision: string;
  validation: "valid" | "invalid";
  errors: readonly AdministrationIssue[];
  warnings: readonly AdministrationIssue[];
  summary: readonly string[];
  affected: AdministrationAffectedData;
  safeToApply: boolean;
  proposedSnapshot: TournamentDataSnapshot | null;
}>;

export type ApplyProposalResult =
  | Readonly<{
      status: "applied";
      snapshot: TournamentDataSnapshot;
      revision: string;
    }>
  | Readonly<{
      status: "rejected";
      code:
        | "invalid_proposal"
        | "stale_proposal"
        | "invariant_violation"
        | "proposal_tampered";
      errors: readonly AdministrationIssue[];
    }>;
