import type { RulesMetadata, Tournament } from "../types";

export const REFERENCE_TOURNAMENT: Tournament = {
  id: "fifa-world-cup-2026",
  name: "2026 FIFA World Cup",
  year: 2026,
  status: "planned",
  currentRoundId: "group",
  lastUpdatedAt: "2026-07-12T00:00:00.000Z",
  referenceDataComplete: false,
  missingOfficialData: [
    "Complete authoritative list of all 48 tournament countries",
    "Official group assignments",
    "Official fixture schedule and match numbers",
    "Official knockout bracket mapping",
  ],
};

export const REFERENCE_RULES: RulesMetadata = {
  version: "2026-07-12",
  updatedAt: "2026-07-12",
  goldenGoalIncludesGroupStage: true,
  shootoutKicksExcluded: true,
  rankingMethod: "standard_competition",
  starRankingTolerance: 1e-2,
};
