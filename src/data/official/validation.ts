import {
  calculateGroupStandings,
  rankGroupStandings,
} from "../../domain/group-standings";
import { deriveProgression } from "../../domain/progression";
import { validateCanonicalData } from "../validation";
import type { TournamentDataSnapshot } from "../types";

const EXPECTED_STAGE_COUNTS = {
  group: 72,
  round_of_32: 16,
  round_of_16: 8,
  quarterfinal: 4,
  semifinal: 2,
  third_place: 1,
  final: 1,
} as const;

type StructureArtifact = Readonly<{
  schemaVersion: string;
  tournament: Readonly<{
    id: string;
    name: string;
    officialName: string;
    year: number;
  }>;
  sources: readonly Source[];
  interpretations: readonly string[];
  sourceDiscrepancies: readonly string[];
  countries: readonly Readonly<{
    id: string;
    displayName: string;
    officialName: string;
    fifaCode: string;
    aliases: readonly string[];
  }>[];
  groups: readonly Readonly<{ code: string; countryIds: readonly string[] }>[];
  fixtures: readonly Readonly<{
    id: string;
    officialMatchId: string;
    matchNumber: number;
    roundId: string;
    stage: string;
    scheduledAt: string;
    officialHomeSlot: string;
    officialAwaySlot: string;
    homeCountryId: string | null;
    awayCountryId: string | null;
    homeSourceSlot: SourceSlot | null;
    awaySourceSlot: SourceSlot | null;
  }>[];
}>;

type Source = Readonly<{
  url: string;
  description: string;
  retrievedAt: string;
}>;
type SourceSlot = Readonly<{ sourceMatchId: string; outcome: string }>;
type ResultsArtifact = Readonly<{
  schemaVersion: string;
  tournamentId: string;
  structureSha256: string;
  sources: readonly Source[];
  retrievedAt: string;
  officialAsOf: string;
  cutoffExplanation: string;
  omittedResultMeaning: string;
  completedResults: readonly Readonly<{
    matchId: string;
    homeGoals: number;
    awayGoals: number;
    wentToExtraTime: boolean;
    homeShootoutGoals: number | null;
    awayShootoutGoals: number | null;
    advancingCountryId: string | null;
  }>[];
  officialGroupOrders: readonly Readonly<{
    groupCode: string;
    orderedCountryIds: readonly string[];
  }>[];
  groupOverrides: readonly unknown[];
  roundOf32QualifiedCountryIds: readonly string[];
  bestThirdPlaceQualifiedCountryIds: readonly string[];
}>;

export function validateOfficialTournamentData(
  structure: StructureArtifact,
  results: ResultsArtifact,
  snapshot: TournamentDataSnapshot,
): void {
  const errors: string[] = [];
  const check = (condition: unknown, message: string) => {
    if (!condition) errors.push(message);
  };
  const validTimestamp = (value: string) =>
    /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value));

  check(
    structure.schemaVersion === "official-tournament-structure/v1",
    "Unsupported structure schema.",
  );
  check(
    results.schemaVersion === "official-tournament-results/v1",
    "Unsupported results schema.",
  );
  check(
    structure.tournament.id === "fifa-world-cup-2026",
    "Unexpected tournament ID.",
  );
  check(
    results.tournamentId === structure.tournament.id,
    "Artifact tournament IDs differ.",
  );
  check(structure.tournament.year === 2026, "Unexpected tournament year.");
  check(
    structure.interpretations.length > 0,
    "Normalization interpretations are missing.",
  );
  check(
    structure.sourceDiscrepancies.length > 0,
    "Source discrepancy review is missing.",
  );
  check(
    /^[a-f0-9]{64}$/.test(results.structureSha256),
    "Invalid structure SHA-256.",
  );
  check(
    validTimestamp(results.retrievedAt),
    "Results retrieval time must be UTC.",
  );
  check(validTimestamp(results.officialAsOf), "Official cutoff must be UTC.");
  check(
    Date.parse(results.officialAsOf) <= Date.parse(results.retrievedAt),
    "Cutoff follows retrieval.",
  );
  for (const source of [...structure.sources, ...results.sources]) {
    check(
      source.url.startsWith("https://"),
      "Every source requires an HTTPS URL.",
    );
    check(
      source.description.trim() !== "",
      "Every source requires a description.",
    );
    check(
      validTimestamp(source.retrievedAt),
      "Every source retrieval time must be UTC.",
    );
  }

  check(structure.countries.length === 48, "Expected exactly 48 countries.");
  unique(
    structure.countries.map(({ id }) => id),
    "country ID",
    errors,
  );
  unique(
    structure.countries.map(({ fifaCode }) => fifaCode),
    "FIFA code",
    errors,
  );
  for (const country of structure.countries) {
    check(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(country.id),
      `Invalid country ID ${country.id}.`,
    );
    check(
      /^[A-Z]{3}$/.test(country.fifaCode),
      `Invalid FIFA code ${country.fifaCode}.`,
    );
    check(
      country.displayName.trim() !== "" && country.officialName.trim() !== "",
      `Country ${country.id} is unnamed.`,
    );
    check(
      country.aliases.includes(country.officialName),
      `Country ${country.id} omits its official alias.`,
    );
  }

  check(structure.groups.length === 12, "Expected exactly 12 groups.");
  check(
    structure.groups.map(({ code }) => code).join("") === "ABCDEFGHIJKL",
    "Groups must be A-L.",
  );
  const memberships = structure.groups.flatMap(({ countryIds }) => countryIds);
  for (const group of structure.groups)
    check(
      group.countryIds.length === 4,
      `Group ${group.code} must have four countries.`,
    );
  check(memberships.length === 48, "Expected 48 group memberships.");
  unique(memberships, "group membership", errors);
  const countryIds = new Set(structure.countries.map(({ id }) => id));
  for (const id of memberships)
    check(countryIds.has(id), `Unknown group country ${id}.`);

  check(structure.fixtures.length === 104, "Expected exactly 104 fixtures.");
  unique(
    structure.fixtures.map(({ id }) => id),
    "match ID",
    errors,
  );
  unique(
    structure.fixtures.map(({ officialMatchId }) => officialMatchId),
    "official match ID",
    errors,
  );
  unique(
    structure.fixtures.map(({ matchNumber }) => matchNumber),
    "match number",
    errors,
  );
  const matchIds = new Set(structure.fixtures.map(({ id }) => id));
  const roundOrder = new Map([
    ["group", 1],
    ["round-of-32", 2],
    ["round-of-16", 3],
    ["quarterfinal", 4],
    ["semifinal", 5],
    ["third-place", 6],
    ["final", 7],
  ]);
  for (const [stage, expected] of Object.entries(EXPECTED_STAGE_COUNTS)) {
    check(
      structure.fixtures.filter((fixture) => fixture.stage === stage).length ===
        expected,
      `Wrong ${stage} match count.`,
    );
  }
  const groupPairs = new Set<string>();
  for (const fixture of structure.fixtures) {
    check(
      fixture.matchNumber >= 1 && fixture.matchNumber <= 104,
      `Invalid match number ${fixture.matchNumber}.`,
    );
    check(roundOrder.has(fixture.roundId), `Unknown round ${fixture.roundId}.`);
    check(
      validTimestamp(fixture.scheduledAt),
      `Match ${fixture.id} kickoff is not normalized UTC.`,
    );
    for (const id of [fixture.homeCountryId, fixture.awayCountryId]) {
      check(
        id === null || countryIds.has(id),
        `Match ${fixture.id} references unknown country ${id}.`,
      );
    }
    if (fixture.stage === "group") {
      check(
        fixture.homeCountryId !== null && fixture.awayCountryId !== null,
        `Group match ${fixture.id} is unresolved.`,
      );
      const pair = [fixture.homeCountryId, fixture.awayCountryId]
        .sort()
        .join("|");
      check(!groupPairs.has(pair), `Duplicate group pairing ${pair}.`);
      groupPairs.add(pair);
      check(
        fixture.homeSourceSlot === null && fixture.awaySourceSlot === null,
        `Group match ${fixture.id} has a source slot.`,
      );
    }
    for (const slot of [fixture.homeSourceSlot, fixture.awaySourceSlot]) {
      if (slot === null) continue;
      check(
        slot.outcome === "winner" || slot.outcome === "loser",
        `Match ${fixture.id} has invalid source outcome.`,
      );
      check(
        matchIds.has(slot.sourceMatchId),
        `Match ${fixture.id} has unknown source ${slot.sourceMatchId}.`,
      );
      const source = structure.fixtures.find(
        ({ id }) => id === slot.sourceMatchId,
      );
      check(
        (roundOrder.get(source?.roundId ?? "") ?? 99) <
          (roundOrder.get(fixture.roundId) ?? 0),
        `Match ${fixture.id} source is not earlier.`,
      );
    }
  }

  const completedIds = new Set(
    results.completedResults.map(({ matchId }) => matchId),
  );
  unique([...completedIds], "completed result", errors);
  check(
    results.completedResults.length === 101,
    "Expected 101 completed results at the cutoff.",
  );
  for (const result of results.completedResults) {
    const fixture = structure.fixtures.find(({ id }) => id === result.matchId);
    check(fixture !== undefined, `Unknown completed match ${result.matchId}.`);
    check(
      Number.isInteger(result.homeGoals) && result.homeGoals >= 0,
      `Invalid home score for ${result.matchId}.`,
    );
    check(
      Number.isInteger(result.awayGoals) && result.awayGoals >= 0,
      `Invalid away score for ${result.matchId}.`,
    );
    check(
      fixture?.homeCountryId !== null && fixture?.awayCountryId !== null,
      `Completed match ${result.matchId} lacks teams.`,
    );
    const hasShootout =
      result.homeShootoutGoals !== null || result.awayShootoutGoals !== null;
    check(
      (result.homeShootoutGoals === null) ===
        (result.awayShootoutGoals === null),
      `Incomplete shootout for ${result.matchId}.`,
    );
    if (hasShootout) {
      check(
        result.wentToExtraTime,
        `Shootout ${result.matchId} lacks extra time.`,
      );
      check(
        result.homeGoals === result.awayGoals,
        `Shootout ${result.matchId} has a non-drawn match score.`,
      );
      check(
        result.homeShootoutGoals !== result.awayShootoutGoals,
        `Shootout ${result.matchId} is tied.`,
      );
    }
    if (fixture?.stage === "group") {
      check(
        !result.wentToExtraTime &&
          !hasShootout &&
          result.advancingCountryId === null,
        `Invalid group result ${result.matchId}.`,
      );
    } else {
      check(
        result.advancingCountryId === fixture?.homeCountryId ||
          result.advancingCountryId === fixture?.awayCountryId,
        `Invalid advancing country for ${result.matchId}.`,
      );
    }
  }
  for (const fixture of structure.fixtures) {
    const match = snapshot.matches.find(({ id }) => id === fixture.id)!;
    if (!completedIds.has(fixture.id)) {
      check(
        match.status === "scheduled",
        `Future match ${fixture.id} is not scheduled.`,
      );
      check(
        match.homeGoals === null &&
          match.awayGoals === null &&
          match.advancingCountryId === null,
        `Future match ${fixture.id} contains fabricated result data.`,
      );
    }
  }

  const canonicalErrors = validateCanonicalData(snapshot).filter(
    ({ severity }) => severity === "error",
  );
  errors.push(...canonicalErrors.map(({ message }) => message));
  check(
    snapshot.participants.length === 5,
    "Expected five fantasy participants.",
  );
  check(snapshot.draftPicks.length === 25, "Expected 25 draft picks.");
  for (const participant of snapshot.participants) {
    check(
      snapshot.draftPicks.filter(
        ({ participantId }) => participantId === participant.id,
      ).length === 5,
      `${participant.id} must have five picks.`,
    );
  }

  for (const official of results.officialGroupOrders) {
    const group = snapshot.groups.find(
      ({ code }) => code === official.groupCode,
    );
    check(group !== undefined, `Unknown official group ${official.groupCode}.`);
    if (!group) continue;
    const standings = calculateGroupStandings(
      group.countryIds,
      snapshot.matches,
    );
    const calculated = rankGroupStandings(standings).map(
      ({ standing }) => standing.countryId,
    );
    check(
      calculated.join("|") === official.orderedCountryIds.join("|"),
      `Calculated Group ${official.groupCode} order differs from FIFA.`,
    );
  }
  check(
    results.groupOverrides.length === 0,
    "Unexpected group overrides at this cutoff.",
  );
  const qualified = snapshot.groupQualifications
    .filter(({ qualifiedForRoundOf32 }) => qualifiedForRoundOf32)
    .map(({ countryId }) => countryId)
    .sort();
  check(
    qualified.join("|") ===
      [...results.roundOf32QualifiedCountryIds].sort().join("|"),
    "Round-of-32 qualification differs from FIFA.",
  );
  const thirds = new Set(results.bestThirdPlaceQualifiedCountryIds);
  check(thirds.size === 8, "Expected eight best-third qualifiers.");
  for (const order of results.officialGroupOrders) {
    const third = order.orderedCountryIds[2]!;
    check(
      thirds.has(third) === qualified.includes(third),
      `Third-place qualification differs for ${third}.`,
    );
  }

  const progression = deriveProgression({
    countryIds: snapshot.countries.map(({ id }) => id),
    matches: snapshot.matches,
    groupQualifications: snapshot.groupQualifications,
  });
  check(progression.length === 48, "Progression did not cover all countries.");
  for (const result of results.completedResults) {
    const fixture = snapshot.matches.find(({ id }) => id === result.matchId)!;
    if (fixture.stage !== "group")
      check(
        fixture.advancingCountryId === result.advancingCountryId,
        `Knockout progression differs for ${fixture.id}.`,
      );
  }

  if (errors.length > 0)
    throw new Error(
      `Invalid official tournament data:\n- ${errors.join("\n- ")}`,
    );
}

function unique(
  values: readonly unknown[],
  label: string,
  errors: string[],
): void {
  const seen = new Set<unknown>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`Duplicate ${label}: ${String(value)}.`);
    seen.add(value);
  }
}
