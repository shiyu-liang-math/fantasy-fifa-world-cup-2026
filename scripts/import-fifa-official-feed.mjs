import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { format } from "prettier";

const TOURNAMENT_ID = "fifa-world-cup-2026";
const RETRIEVED_AT = "2026-07-15T05:56:29Z";
const MATCH_FEED_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=500&IdCompetition=17&IdSeason=285023";

const EXISTING_IDENTITIES = {
  ARG: ["argentina", "Argentina", ["Argentina"]],
  BEL: ["belgium", "Belgium", ["Belgium"]],
  BRA: ["brazil", "Brazil", ["Brazil"]],
  CAN: ["canada", "Canada", ["Canada"]],
  COL: ["colombia", "Colombia", ["Colombia"]],
  CRO: ["croatia", "Croatia", ["Croatia"]],
  ENG: ["england", "England", ["England"]],
  FRA: ["france", "France", ["France"]],
  GER: ["germany", "Germany", ["Germany"]],
  IRN: ["iran", "Iran", ["IR Iran"]],
  CIV: ["ivory-coast", "Ivory Coast", ["Côte d'Ivoire", "Côte d’Ivoire"]],
  JPN: ["japan", "Japan", ["Japan"]],
  MEX: ["mexico", "Mexico", ["Mexico"]],
  MAR: ["morocco", "Morocco", ["Morocco"]],
  NED: ["netherlands", "Netherlands", ["Netherlands"]],
  NOR: ["norway", "Norway", ["Norway"]],
  POR: ["portugal", "Portugal", ["Portugal"]],
  SCO: ["scotland", "Scotland", ["Scotland"]],
  SEN: ["senegal", "Senegal", ["Senegal"]],
  KOR: ["south-korea", "South Korea", ["Korea Republic"]],
  ESP: ["spain", "Spain", ["Spain"]],
  SWE: ["sweden", "Sweden", ["Sweden"]],
  SUI: ["switzerland", "Switzerland", ["Switzerland"]],
  USA: ["united-states", "United States", ["USA", "United States"]],
  URU: ["uruguay", "Uruguay", ["Uruguay"]],
};

const NEW_IDENTITIES = {
  ALG: "algeria",
  AUS: "australia",
  AUT: "austria",
  BIH: "bosnia-and-herzegovina",
  CPV: "cabo-verde",
  COD: "congo-dr",
  CUW: "curacao",
  CZE: "czechia",
  ECU: "ecuador",
  EGY: "egypt",
  GHA: "ghana",
  HAI: "haiti",
  IRQ: "iraq",
  JOR: "jordan",
  NZL: "new-zealand",
  PAN: "panama",
  PAR: "paraguay",
  QAT: "qatar",
  KSA: "saudi-arabia",
  RSA: "south-africa",
  TUN: "tunisia",
  TUR: "turkiye",
  UZB: "uzbekistan",
};

const STAGES = {
  "First Stage": ["group", "group"],
  "Round of 32": ["round_of_32", "round-of-32"],
  "Round of 16": ["round_of_16", "round-of-16"],
  "Quarter-final": ["quarterfinal", "quarterfinal"],
  "Semi-final": ["semifinal", "semifinal"],
  "Bronze final": ["third_place", "third-place"],
  Final: ["final", "final"],
};

const SOURCES = [
  {
    url: MATCH_FEED_URL,
    description:
      "Official FIFA Data Platform match feed for FIFA World Cup 2026, season 285023; authoritative for teams, group slots, fixtures, UTC kickoffs, match status, results, shootouts, and winners at the cutoff.",
    retrievedAt: RETRIEVED_AT,
  },
  {
    url: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/teams/",
    description: "Official FIFA World Cup 2026 team list.",
    retrievedAt: RETRIEVED_AT,
  },
  {
    url: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/final-draw-results",
    description: "Official FIFA final draw and group allocation page.",
    retrievedAt: RETRIEVED_AT,
  },
  {
    url: "https://fwc26teambasecamps.fifa.com/ReactApps/TBC/dist/static/media/match-schedule-english.071cf28145379e10f0cf.pdf",
    description:
      "Official FIFA match schedule document, dated 5 September 2025; authoritative for match numbering and knockout winner/loser formulas, reconciled with the current FIFA match feed for resolved participants and kickoff times.",
    retrievedAt: RETRIEVED_AT,
  },
];

const input = process.argv[2];
if (!input)
  throw new Error("Pass a downloaded official FIFA match-feed JSON file.");
const payload = JSON.parse(readFileSync(resolve(input), "utf8"));
const matches = [...payload.Results].sort(
  (left, right) => left.MatchNumber - right.MatchNumber,
);
if (matches.length !== 104)
  throw new Error("The FIFA feed must contain 104 matches.");

const groupMatches = matches.filter((match) => match.MatchNumber <= 72);
const teamByCode = new Map();
for (const match of groupMatches) {
  teamByCode.set(match.Home.Abbreviation, match.Home);
  teamByCode.set(match.Away.Abbreviation, match.Away);
}
if (teamByCode.size !== 48)
  throw new Error("The FIFA feed must contain 48 teams.");

const identityByCode = new Map();
const countries = [...teamByCode.entries()]
  .map(([fifaCode, team]) => {
    const established = EXISTING_IDENTITIES[fifaCode];
    const id = established?.[0] ?? NEW_IDENTITIES[fifaCode];
    if (!id) throw new Error(`No reviewed application ID for ${fifaCode}.`);
    const officialName = team.TeamName[0].Description;
    const displayName = established?.[1] ?? officialName;
    const aliases = [
      ...new Set([displayName, officialName, ...(established?.[2] ?? [])]),
    ];
    const country = { id, displayName, officialName, fifaCode, aliases };
    identityByCode.set(fifaCode, country);
    return country;
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const groups = "ABCDEFGHIJKL".split("").map((code) => {
  const slots = new Map();
  for (const match of groupMatches.filter(
    (candidate) => candidate.GroupName[0].Description === `Group ${code}`,
  )) {
    for (const side of ["Home", "Away"]) {
      const label = side === "Home" ? match.PlaceHolderA : match.PlaceHolderB;
      const position = Number(label.slice(1));
      if (label[0] === code && position >= 1 && position <= 4) {
        slots.set(position, identityByCode.get(match[side].Abbreviation).id);
      }
    }
  }
  if (slots.size !== 4)
    throw new Error(`Could not resolve all draw slots for Group ${code}.`);
  return {
    code,
    countryIds: [1, 2, 3, 4].map((position) => slots.get(position)),
  };
});

function sourceSlot(label) {
  const winner = /^W(\d+)$/.exec(label ?? "");
  if (winner)
    return { sourceMatchId: matchId(Number(winner[1])), outcome: "winner" };
  const loser = /^RU(\d+)$/.exec(label ?? "");
  if (loser)
    return { sourceMatchId: matchId(Number(loser[1])), outcome: "loser" };
  return null;
}

function matchId(number) {
  return `match-${String(number).padStart(3, "0")}`;
}

function countryId(side) {
  return side?.Abbreviation
    ? (identityByCode.get(side.Abbreviation)?.id ?? null)
    : null;
}

const fixtures = matches.map((match) => {
  const stageName = match.StageName[0].Description;
  const stage = STAGES[stageName];
  if (!stage) throw new Error(`Unsupported FIFA stage ${stageName}.`);
  return {
    id: matchId(match.MatchNumber),
    officialMatchId: match.IdMatch,
    matchNumber: match.MatchNumber,
    roundId: stage[1],
    stage: stage[0],
    scheduledAt: new Date(match.Date).toISOString(),
    officialHomeSlot: match.PlaceHolderA,
    officialAwaySlot: match.PlaceHolderB,
    homeCountryId: countryId(match.Home),
    awayCountryId: countryId(match.Away),
    homeSourceSlot:
      match.MatchNumber >= 89 ? sourceSlot(match.PlaceHolderA) : null,
    awaySourceSlot:
      match.MatchNumber >= 89 ? sourceSlot(match.PlaceHolderB) : null,
  };
});

const structure = {
  schemaVersion: "official-tournament-structure/v1",
  tournament: {
    id: TOURNAMENT_ID,
    name: "2026 FIFA World Cup",
    officialName: "FIFA World Cup 2026™",
    year: 2026,
  },
  sources: SOURCES,
  interpretations: [
    "Existing product country IDs and display names are preserved; official FIFA names are retained as import aliases.",
    "Round-of-32 group-position and best-third formulas remain descriptive official slots and are not converted into unsupported database match-source slots.",
    "From the Round of 16 onward, Wnn denotes the winner of match nn and RUnn denotes the losing team of match nn.",
    "The live FIFA match feed supersedes the pre-draw schedule document for resolved teams, results, match status, and kickoff timestamps.",
  ],
  sourceDiscrepancies: [
    "No contradictory finalized tournament fact was found. The schedule document retains pre-resolution slot labels while the live FIFA feed names resolved countries; the live feed is used for those current resolved participants as documented above.",
  ],
  countries,
  groups,
  fixtures,
};

const structureText = await format(JSON.stringify(structure), {
  parser: "json",
});
const structureHash = createHash("sha256").update(structureText).digest("hex");

const groupOrders = groups.map((group) => {
  const table = new Map(
    group.countryIds.map((id) => [
      id,
      { countryId: id, points: 0, goalsFor: 0, goalsAgainst: 0 },
    ]),
  );
  for (const match of groupMatches) {
    const home = countryId(match.Home);
    const away = countryId(match.Away);
    if (!table.has(home) || !table.has(away)) continue;
    const h = table.get(home);
    const a = table.get(away);
    h.goalsFor += match.HomeTeamScore;
    h.goalsAgainst += match.AwayTeamScore;
    a.goalsFor += match.AwayTeamScore;
    a.goalsAgainst += match.HomeTeamScore;
    if (match.HomeTeamScore > match.AwayTeamScore) h.points += 3;
    else if (match.HomeTeamScore < match.AwayTeamScore) a.points += 3;
    else {
      h.points += 1;
      a.points += 1;
    }
  }
  const ordered = [...table.values()].sort(
    (left, right) =>
      right.points - left.points ||
      right.goalsFor -
        right.goalsAgainst -
        (left.goalsFor - left.goalsAgainst) ||
      right.goalsFor - left.goalsFor,
  );
  return {
    groupCode: group.code,
    orderedCountryIds: ordered.map((row) => row.countryId),
  };
});

const thirdPlaceByGroup = new Map(
  groupOrders.map((order) => [order.groupCode, order.orderedCountryIds[2]]),
);
const roundOf32CountryIds = [
  ...new Set(
    fixtures
      .filter((fixture) => fixture.stage === "round_of_32")
      .flatMap((fixture) => [fixture.homeCountryId, fixture.awayCountryId])
      .filter(Boolean),
  ),
];
const bestThirdPlaceQualifiedCountryIds = groups
  .map((group) => thirdPlaceByGroup.get(group.code))
  .filter((id) => roundOf32CountryIds.includes(id));

const completedResults = matches
  .filter((match) => match.MatchStatus === 0)
  .map((match) => {
    const stage = STAGES[match.StageName[0].Description][0];
    const wentToExtraTime = match.ResultType === 2 || match.ResultType === 3;
    const result = {
      matchId: matchId(match.MatchNumber),
      homeGoals: match.HomeTeamScore,
      awayGoals: match.AwayTeamScore,
      wentToExtraTime,
      homeShootoutGoals: match.HomeTeamPenaltyScore,
      awayShootoutGoals: match.AwayTeamPenaltyScore,
      advancingCountryId:
        stage === "group"
          ? null
          : match.Winner === match.Home.IdTeam
            ? countryId(match.Home)
            : countryId(match.Away),
    };
    return result;
  });

const results = {
  schemaVersion: "official-tournament-results/v1",
  tournamentId: TOURNAMENT_ID,
  structureSha256: structureHash,
  sources: SOURCES,
  retrievedAt: RETRIEVED_AT,
  officialAsOf: RETRIEVED_AT,
  cutoffExplanation:
    "The official FIFA match feed was retrieved after semifinal match 101 was final and before semifinal match 102 began. Only MatchStatus 0 records are imported as completed.",
  omittedResultMeaning:
    "A fixture without an entry in completedResults was not officially final at officialAsOf and remains scheduled without a fabricated score or advancing country.",
  completedResults,
  officialGroupOrders: groupOrders,
  groupOverrides: [],
  roundOf32QualifiedCountryIds: roundOf32CountryIds,
  bestThirdPlaceQualifiedCountryIds,
};

const outputDirectory = resolve("data/official");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, "fifa-world-cup-2026.structure.json"),
  structureText,
);
writeFileSync(
  resolve(
    outputDirectory,
    "fifa-world-cup-2026.results.2026-07-15T05-56-29Z.json",
  ),
  await format(JSON.stringify(results), { parser: "json" }),
);

console.log(
  `Wrote ${countries.length} countries, ${groups.length} groups, ${fixtures.length} fixtures, and ${completedResults.length} completed results.`,
);
