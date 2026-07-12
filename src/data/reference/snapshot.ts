import { REFERENCE_COUNTRIES } from "./countries";
import { REFERENCE_DRAFT_PICKS } from "./draft-picks";
import { REFERENCE_PARTICIPANTS } from "./participants";
import { REFERENCE_GROUPS, REFERENCE_ROUNDS } from "./rounds";
import { REFERENCE_RULES, REFERENCE_TOURNAMENT } from "./tournament";
import type { TournamentDataSnapshot } from "../types";

export const REFERENCE_SNAPSHOT: TournamentDataSnapshot = {
  tournament: REFERENCE_TOURNAMENT,
  participants: REFERENCE_PARTICIPANTS,
  countries: REFERENCE_COUNTRIES,
  draftPicks: REFERENCE_DRAFT_PICKS,
  rounds: REFERENCE_ROUNDS,
  groups: REFERENCE_GROUPS,
  matches: [],
  groupQualifications: [],
  groupOverrides: [],
  rules: REFERENCE_RULES,
  datasetKind: "official_reference",
};
