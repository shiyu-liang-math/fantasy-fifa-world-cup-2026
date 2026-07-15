import { deriveGroupQualifications } from "../domain/group-qualification";
import type {
  GroupQualificationOverrideRecord,
  MatchRecord,
  MatchSourceSlot,
  Participant,
  Country,
  DraftPickRecord,
  TournamentDataSnapshot,
  TournamentGroup,
  TournamentRound,
} from "../data/types";
import { validateCanonicalData } from "../data/validation";
import { InvalidTournamentSnapshotError } from "./repository-errors";

const GROUP_CODES = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
] as const;
const TOURNAMENT_STATUSES = ["planned", "active", "completed"] as const;
const MATCH_STAGES = [
  "group",
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
] as const;
const MATCH_STATUSES = [
  "scheduled",
  "live",
  "completed",
  "postponed",
  "cancelled",
] as const;
const ROUND_PHASES = ["group", "knockout", "placement"] as const;
const SOURCE_OUTCOMES = ["winner", "loser"] as const;
const DATASET_KINDS = ["official_reference", "fictional_development"] as const;

type Row = Record<string, unknown>;

export function mapSupabaseSnapshot(payload: unknown): TournamentDataSnapshot {
  const root = row(payload, "snapshot");
  const datasetKind = literal(
    root.dataset_kind,
    DATASET_KINDS,
    "snapshot.dataset_kind",
  );
  const tournamentValue = root.tournament;
  const collectionNames = [
    "participants",
    "countries",
    "rounds",
    "groups",
    "group_memberships",
    "draft_picks",
    "matches",
    "match_source_slots",
    "group_override_sets",
    "group_override_entries",
  ] as const;
  const collections = Object.fromEntries(
    collectionNames.map((name) => [name, rows(root[name], `snapshot.${name}`)]),
  ) as Record<(typeof collectionNames)[number], Row[]>;

  if (tournamentValue === null) {
    if (collectionNames.some((name) => collections[name].length > 0)) {
      invalid("A missing tournament snapshot must not contain canonical rows.");
    }
    return emptySnapshot(datasetKind);
  }

  const tournamentRow = row(tournamentValue, "snapshot.tournament");
  const tournamentId = text(tournamentRow.id, "tournament.id");
  const participants = collections.participants.map(mapParticipant);
  const countries = collections.countries.map(mapCountry);
  const rounds = collections.rounds.map(mapRound);
  const groupRows = collections.groups.map(mapGroup);
  const memberships = collections.group_memberships.map((value, index) => ({
    tournamentId: text(
      value.tournament_id,
      `group_memberships[${index}].tournament_id`,
    ),
    groupCode: literal(
      value.group_code,
      GROUP_CODES,
      `group_memberships[${index}].group_code`,
    ),
    countryId: text(value.country_id, `group_memberships[${index}].country_id`),
    displayOrder: integer(
      value.display_order,
      `group_memberships[${index}].display_order`,
    ),
  }));
  const draftPicks = collections.draft_picks.map(mapDraftPick);
  const matches = collections.matches.map(mapMatch);
  const sourceRows = collections.match_source_slots.map((value, index) => ({
    tournamentId: text(
      value.tournament_id,
      `match_source_slots[${index}].tournament_id`,
    ),
    matchId: text(value.match_id, `match_source_slots[${index}].match_id`),
    slot: literal(
      value.slot,
      ["home", "away"] as const,
      `match_source_slots[${index}].slot`,
    ),
    sourceMatchId: text(
      value.source_match_id,
      `match_source_slots[${index}].source_match_id`,
    ),
    outcome: literal(
      value.outcome,
      SOURCE_OUTCOMES,
      `match_source_slots[${index}].outcome`,
    ),
  }));
  const overrideSets = collections.group_override_sets.map((value, index) => ({
    id: text(value.id, `group_override_sets[${index}].id`),
    tournamentId: text(
      value.tournament_id,
      `group_override_sets[${index}].tournament_id`,
    ),
    groupCode: literal(
      value.group_code,
      GROUP_CODES,
      `group_override_sets[${index}].group_code`,
    ),
    reason: text(value.reason, `group_override_sets[${index}].reason`),
    source: text(value.source, `group_override_sets[${index}].source`),
  }));
  const overrideEntries = collections.group_override_entries.map(
    (value, index) => ({
      setId: text(
        value.override_set_id,
        `group_override_entries[${index}].override_set_id`,
      ),
      tournamentId: text(
        value.tournament_id,
        `group_override_entries[${index}].tournament_id`,
      ),
      groupCode: literal(
        value.group_code,
        GROUP_CODES,
        `group_override_entries[${index}].group_code`,
      ),
      countryId: text(
        value.country_id,
        `group_override_entries[${index}].country_id`,
      ),
      officialRank: nullableInteger(
        value.official_rank,
        `group_override_entries[${index}].official_rank`,
      ),
      qualified: nullableBoolean(
        value.qualified_for_round_of_32,
        `group_override_entries[${index}].qualified_for_round_of_32`,
      ),
    }),
  );

  unique(participants, (value) => value.id, "participant id");
  unique(participants, (value) => value.slug, "participant slug");
  unique(
    participants,
    (value) => value.abbreviation,
    "participant abbreviation",
  );
  unique(
    participants,
    (value) => String(value.displayOrder),
    "participant display order",
  );
  unique(countries, (value) => value.id, "country id");
  unique(countries, (value) => value.fifaCode, "country FIFA code");
  unique(rounds, (value) => value.id, "round id");
  unique(rounds, (value) => value.stage, "round stage");
  unique(rounds, (value) => String(value.displayOrder), "round display order");
  unique(groupRows, (value) => value.code, "group code");
  unique(
    groupRows,
    (value) => String(value.displayOrder),
    "group display order",
  );
  unique(draftPicks, (value) => value.id, "draft-pick id");
  unique(draftPicks, (value) => value.countryId, "drafted country");
  unique(matches, (value) => value.id, "match id");
  unique(matches, (value) => String(value.matchNumber), "match number");
  unique(memberships, (value) => value.countryId, "group membership country");
  unique(
    memberships,
    (value) => `${value.groupCode}:${value.displayOrder}`,
    "group membership display order",
  );
  unique(
    sourceRows,
    (value) => `${value.matchId}:${value.slot}`,
    "match source slot",
  );
  unique(
    overrideSets,
    (value) => `${value.tournamentId}:${value.groupCode}`,
    "group override set",
  );
  unique(
    overrideEntries,
    (value) => `${value.setId}:${value.countryId}`,
    "group override entry",
  );

  const participantIds = new Set(participants.map(({ id }) => id));
  const countryIds = new Set(countries.map(({ id }) => id));
  const roundById = new Map(rounds.map((value) => [value.id, value]));
  const groupCodes = new Set(groupRows.map(({ code }) => code));
  const matchIds = new Set(matches.map(({ id }) => id));
  const matchById = new Map(matches.map((value) => [value.id, value]));
  const membershipByCountryForValidation = new Map(
    memberships.map((value) => [value.countryId, value]),
  );
  for (const value of [
    ...rounds,
    ...groupRows,
    ...draftPicks,
    ...matches,
    ...memberships,
    ...sourceRows,
    ...overrideSets,
    ...overrideEntries,
  ]) {
    if (value.tournamentId !== tournamentId)
      invalid(
        `A canonical row belongs to unexpected tournament ${value.tournamentId}.`,
      );
  }
  for (const pick of draftPicks) {
    if (!participantIds.has(pick.participantId))
      invalid(`${pick.id} references a missing participant.`);
    if (!countryIds.has(pick.countryId))
      invalid(`${pick.id} references a missing country.`);
  }
  for (const membership of memberships) {
    if (!groupCodes.has(membership.groupCode))
      invalid(`Membership references missing group ${membership.groupCode}.`);
    if (!countryIds.has(membership.countryId))
      invalid(`Membership references missing country ${membership.countryId}.`);
  }
  for (const round of rounds) {
    const expectedPhase =
      round.stage === "group"
        ? "group"
        : round.stage === "third_place" || round.stage === "final"
          ? "placement"
          : "knockout";
    if (round.phase !== expectedPhase)
      invalid(`${round.id} phase contradicts its stage.`);
  }
  for (const match of matches) {
    const round = roundById.get(match.roundId);
    if (!round) invalid(`${match.id} references a missing round.`);
    if (round.stage !== match.stage)
      invalid(`${match.id} stage contradicts its round.`);
    for (const id of [
      match.homeCountryId,
      match.awayCountryId,
      match.advancingCountryId,
    ]) {
      if (id !== null && !countryIds.has(id))
        invalid(`${match.id} references missing country ${id}.`);
    }
    if (match.stage === "group") {
      const homeGroup =
        match.homeCountryId === null
          ? undefined
          : membershipByCountryForValidation.get(match.homeCountryId)
              ?.groupCode;
      const awayGroup =
        match.awayCountryId === null
          ? undefined
          : membershipByCountryForValidation.get(match.awayCountryId)
              ?.groupCode;
      if (
        homeGroup === undefined ||
        awayGroup === undefined ||
        homeGroup !== awayGroup
      )
        invalid(`${match.id} group countries contradict group membership.`);
    }
  }
  for (const source of sourceRows) {
    if (!matchIds.has(source.matchId) || !matchIds.has(source.sourceMatchId))
      invalid("A source slot references a missing match.");
    const targetMatch = matchById.get(source.matchId);
    const sourceMatch = matchById.get(source.sourceMatchId);
    if (targetMatch === undefined || sourceMatch === undefined)
      invalid("A source slot references a missing match.");
    if (targetMatch.stage === "group")
      invalid(`${targetMatch.id} is a group match with a source slot.`);
    const targetRound = roundById.get(targetMatch.roundId);
    const sourceRound = roundById.get(sourceMatch.roundId);
    if (
      targetRound === undefined ||
      sourceRound === undefined ||
      sourceRound.displayOrder >= targetRound.displayOrder
    )
      invalid(`${targetMatch.id} has a source slot from a non-earlier round.`);
    const targetCountryId =
      source.slot === "home"
        ? targetMatch.homeCountryId
        : targetMatch.awayCountryId;
    if (sourceMatch.status !== "completed") {
      if (targetCountryId !== null)
        invalid(`${targetMatch.id} resolves a slot from an incomplete match.`);
      continue;
    }
    if (
      sourceMatch.homeCountryId === null ||
      sourceMatch.awayCountryId === null ||
      sourceMatch.advancingCountryId === null
    )
      invalid(`${sourceMatch.id} cannot resolve a source outcome.`);
    const expectedCountryId =
      source.outcome === "winner"
        ? sourceMatch.advancingCountryId
        : sourceMatch.advancingCountryId === sourceMatch.homeCountryId
          ? sourceMatch.awayCountryId
          : sourceMatch.homeCountryId;
    if (targetCountryId !== null && targetCountryId !== expectedCountryId)
      invalid(`${targetMatch.id} contradicts its resolved source slot.`);
  }
  const setByIdentity = new Map(
    overrideSets.map((value) => [
      `${value.id}:${value.tournamentId}:${value.groupCode}`,
      value,
    ]),
  );
  const groupOverrides: GroupQualificationOverrideRecord[] =
    overrideEntries.map((entry) => {
      const set = setByIdentity.get(
        `${entry.setId}:${entry.tournamentId}:${entry.groupCode}`,
      );
      if (!set)
        invalid(`Override entry references missing set ${entry.setId}.`);
      if (!countryIds.has(entry.countryId))
        invalid(
          `Override entry references missing country ${entry.countryId}.`,
        );
      const membership = membershipByCountryForValidation.get(entry.countryId);
      if (membership?.groupCode !== entry.groupCode)
        invalid(
          `Override entry ${entry.setId} contradicts the country group membership.`,
        );
      const result: GroupQualificationOverrideRecord = {
        id: `${entry.setId}-${entry.countryId}`,
        setId: entry.setId,
        tournamentId: entry.tournamentId,
        groupCode: entry.groupCode,
        countryId: entry.countryId,
        reason: set.reason,
        source: set.source,
        ...(entry.officialRank === null
          ? {}
          : { officialRank: entry.officialRank }),
        ...(entry.qualified === null
          ? {}
          : { qualifiedForRoundOf32: entry.qualified }),
      };
      return result;
    });

  const membershipByCountry = membershipByCountryForValidation;
  const mappedCountries = countries.map((country) => ({
    ...country,
    groupCode: membershipByCountry.get(country.id)?.groupCode ?? null,
  }));
  const groups: TournamentGroup[] = groupRows.map((group) => ({
    ...group,
    countryIds: memberships
      .filter((membership) => membership.groupCode === group.code)
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          a.countryId.localeCompare(b.countryId),
      )
      .map(({ countryId }) => countryId),
  }));
  const sourcesByMatch = new Map<
    string,
    { home?: MatchSourceSlot; away?: MatchSourceSlot }
  >();
  for (const source of sourceRows) {
    const target = sourcesByMatch.get(source.matchId) ?? {};
    target[source.slot] = {
      sourceMatchId: source.sourceMatchId,
      outcome: source.outcome,
    };
    sourcesByMatch.set(source.matchId, target);
  }
  const mappedMatches = matches.map((match) => ({
    ...match,
    homeSourceSlot: sourcesByMatch.get(match.id)?.home ?? null,
    awaySourceSlot: sourcesByMatch.get(match.id)?.away ?? null,
  }));

  const snapshotWithoutQualifications: TournamentDataSnapshot = {
    tournament: {
      id: tournamentId,
      name: text(tournamentRow.name, "tournament.name"),
      year: integer(tournamentRow.year, "tournament.year"),
      status: literal(
        tournamentRow.status,
        TOURNAMENT_STATUSES,
        "tournament.status",
      ),
      currentRoundId: nullableText(
        tournamentRow.current_round_id,
        "tournament.current_round_id",
      ),
      lastUpdatedAt: timestamp(
        tournamentRow.last_updated_at,
        "tournament.last_updated_at",
      ),
      referenceDataComplete: boolean(
        tournamentRow.reference_data_complete,
        "tournament.reference_data_complete",
      ),
      missingOfficialData: stringArray(
        tournamentRow.missing_official_data,
        "tournament.missing_official_data",
      ),
    },
    participants: [...participants].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
    ),
    countries: [...mappedCountries].sort((a, b) => a.id.localeCompare(b.id)),
    draftPicks: [...draftPicks].sort((a, b) => a.id.localeCompare(b.id)),
    rounds: [...rounds].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
    ),
    groups: [...groups].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code),
    ),
    matches: [...mappedMatches].sort(
      (a, b) => a.matchNumber - b.matchNumber || a.id.localeCompare(b.id),
    ),
    groupQualifications: [],
    groupOverrides: [...groupOverrides].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    rules: {
      version: text(tournamentRow.rules_version, "tournament.rules_version"),
      updatedAt: date(
        tournamentRow.rules_updated_at,
        "tournament.rules_updated_at",
      ),
      goldenGoalIncludesGroupStage: exactTrue(
        tournamentRow.golden_goal_includes_group_stage,
        "tournament.golden_goal_includes_group_stage",
      ),
      shootoutKicksExcluded: exactTrue(
        tournamentRow.shootout_kicks_excluded,
        "tournament.shootout_kicks_excluded",
      ),
      rankingMethod: literal(
        tournamentRow.ranking_method,
        ["standard_competition"] as const,
        "tournament.ranking_method",
      ),
      starRankingTolerance: finiteNumber(
        tournamentRow.star_ranking_tolerance,
        "tournament.star_ranking_tolerance",
      ),
    },
    datasetKind,
  };
  if (snapshotWithoutQualifications.rules.starRankingTolerance <= 0) {
    invalid("The star-ranking tolerance must be positive.");
  }
  if (
    snapshotWithoutQualifications.tournament!.currentRoundId !== null &&
    !roundById.has(snapshotWithoutQualifications.tournament!.currentRoundId)
  ) {
    invalid("The tournament current round does not exist in the snapshot.");
  }
  const snapshot: TournamentDataSnapshot = {
    ...snapshotWithoutQualifications,
    groupQualifications: deriveGroupQualifications(
      snapshotWithoutQualifications,
    ),
  };
  const errors = validateCanonicalData(snapshot).filter(
    ({ severity }) => severity === "error",
  );
  if (errors.length > 0)
    throw new InvalidTournamentSnapshotError(
      errors.map(({ message }) => message),
    );
  return structuredClone(snapshot);
}

function mapParticipant(value: Row, index: number): Participant {
  return {
    id: text(value.id, `participants[${index}].id`),
    slug: text(value.slug, `participants[${index}].slug`),
    name: text(value.name, `participants[${index}].name`),
    abbreviation: text(
      value.abbreviation,
      `participants[${index}].abbreviation`,
    ),
    displayOrder: integer(
      value.display_order,
      `participants[${index}].display_order`,
    ),
  };
}
function mapCountry(value: Row, index: number): Omit<Country, "groupCode"> {
  return {
    id: text(value.id, `countries[${index}].id`),
    name: text(value.name, `countries[${index}].name`),
    fifaCode: text(value.fifa_code, `countries[${index}].fifa_code`),
  };
}
function mapRound(value: Row, index: number): TournamentRound {
  return {
    id: text(value.id, `rounds[${index}].id`),
    tournamentId: text(value.tournament_id, `rounds[${index}].tournament_id`),
    stage: literal(value.stage, MATCH_STAGES, `rounds[${index}].stage`),
    name: text(value.name, `rounds[${index}].name`),
    phase: literal(value.phase, ROUND_PHASES, `rounds[${index}].phase`),
    displayOrder: integer(
      value.display_order,
      `rounds[${index}].display_order`,
    ),
  };
}
function mapGroup(
  value: Row,
  index: number,
): Omit<TournamentGroup, "countryIds"> {
  return {
    code: literal(value.code, GROUP_CODES, `groups[${index}].code`),
    tournamentId: text(value.tournament_id, `groups[${index}].tournament_id`),
    displayOrder: integer(
      value.display_order,
      `groups[${index}].display_order`,
    ),
  };
}
function mapDraftPick(value: Row, index: number): DraftPickRecord {
  const draftValue = integer(
    value.draft_value,
    `draft_picks[${index}].draft_value`,
  );
  if (draftValue !== 1 && draftValue !== 2 && draftValue !== 3)
    invalid(`draft_picks[${index}].draft_value is unsupported.`);
  return {
    id: text(value.id, `draft_picks[${index}].id`),
    tournamentId: text(
      value.tournament_id,
      `draft_picks[${index}].tournament_id`,
    ),
    participantId: text(
      value.participant_id,
      `draft_picks[${index}].participant_id`,
    ),
    countryId: text(value.country_id, `draft_picks[${index}].country_id`),
    draftValue,
  };
}
function mapMatch(
  value: Row,
  index: number,
): Omit<MatchRecord, "homeSourceSlot" | "awaySourceSlot"> {
  const path = `matches[${index}]`;
  return {
    id: text(value.id, `${path}.id`),
    tournamentId: text(value.tournament_id, `${path}.tournament_id`),
    roundId: text(value.round_id, `${path}.round_id`),
    stage: literal(value.stage, MATCH_STAGES, `${path}.stage`),
    matchNumber: integer(value.match_number, `${path}.match_number`),
    status: literal(value.status, MATCH_STATUSES, `${path}.status`),
    scheduledAt: nullableTimestamp(value.scheduled_at, `${path}.scheduled_at`),
    homeCountryId: nullableText(
      value.home_country_id,
      `${path}.home_country_id`,
    ),
    awayCountryId: nullableText(
      value.away_country_id,
      `${path}.away_country_id`,
    ),
    homeGoals: nullableInteger(value.home_goals, `${path}.home_goals`),
    awayGoals: nullableInteger(value.away_goals, `${path}.away_goals`),
    wentToExtraTime: boolean(
      value.went_to_extra_time,
      `${path}.went_to_extra_time`,
    ),
    homeShootoutGoals: nullableInteger(
      value.home_shootout_goals,
      `${path}.home_shootout_goals`,
    ),
    awayShootoutGoals: nullableInteger(
      value.away_shootout_goals,
      `${path}.away_shootout_goals`,
    ),
    advancingCountryId: nullableText(
      value.advancing_country_id,
      `${path}.advancing_country_id`,
    ),
    dataClassification: literal(
      value.data_classification,
      DATASET_KINDS,
      `${path}.data_classification`,
    ),
  };
}

function emptySnapshot(
  datasetKind: TournamentDataSnapshot["datasetKind"],
): TournamentDataSnapshot {
  return {
    tournament: null,
    participants: [],
    countries: [],
    draftPicks: [],
    rounds: [],
    groups: [],
    matches: [],
    groupQualifications: [],
    groupOverrides: [],
    rules: {
      version: "unavailable",
      updatedAt: "1970-01-01",
      goldenGoalIncludesGroupStage: true,
      shootoutKicksExcluded: true,
      rankingMethod: "standard_competition",
      starRankingTolerance: 0.01,
    },
    datasetKind,
  };
}
function row(value: unknown, path: string): Row {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    invalid(`${path} must be an object.`);
  return value as Row;
}
function rows(value: unknown, path: string): Row[] {
  if (!Array.isArray(value)) invalid(`${path} must be an array.`);
  return value.map((item, index) => row(item, `${path}[${index}]`));
}
function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "")
    invalid(`${path} must be a non-empty string.`);
  return value;
}
function nullableText(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path);
}
function integer(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    invalid(`${path} must be an integer.`);
  return value;
}
function nullableInteger(value: unknown, path: string): number | null {
  return value === null ? null : integer(value, path);
}
function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    invalid(`${path} must be finite.`);
  return value;
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") invalid(`${path} must be a boolean.`);
  return value;
}
function nullableBoolean(value: unknown, path: string): boolean | null {
  return value === null ? null : boolean(value, path);
}
function exactTrue(value: unknown, path: string): true {
  if (value !== true) invalid(`${path} must be true.`);
  return true;
}
function literal<const T extends readonly string[]>(
  value: unknown,
  choices: T,
  path: string,
): T[number] {
  if (typeof value !== "string" || !choices.includes(value))
    invalid(`${path} has unsupported value ${String(value)}.`);
  return value as T[number];
}
function timestamp(value: unknown, path: string): string {
  const raw = text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(raw))
    invalid(`${path} must include a timestamp and timezone.`);
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds))
    invalid(`${path} must be a valid timestamp.`);
  return new Date(milliseconds).toISOString();
}
function nullableTimestamp(value: unknown, path: string): string | null {
  return value === null ? null : timestamp(value, path);
}
function date(value: unknown, path: string): string {
  const raw = text(value, path);
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(raw) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
  )
    invalid(`${path} must be a valid date.`);
  return raw;
}
function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) invalid(`${path} must be an array.`);
  return value.map((item, index) => text(item, `${path}[${index}]`));
}
function unique<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string,
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const identity = key(value);
    if (seen.has(identity)) invalid(`Duplicate ${label}: ${identity}.`);
    seen.add(identity);
  }
}
function invalid(message: string): never {
  throw new InvalidTournamentSnapshotError([message]);
}
