import { describe, expect, it } from "vitest";

import {
  calculateGroupStandings,
  rankGroupStandings,
  resolveBestThirdPlaceQualifications,
} from "./group-standings";
import type { DomainMatch, GroupQualification, GroupStanding } from "./types";

function match(overrides: Partial<DomainMatch> = {}): DomainMatch {
  return {
    id: "match-1",
    stage: "group",
    status: "completed",
    homeCountryId: "a",
    awayCountryId: "b",
    homeGoals: 2,
    awayGoals: 1,
    wentToExtraTime: false,
    homeShootoutGoals: null,
    awayShootoutGoals: null,
    advancingCountryId: null,
    ...overrides,
  };
}

function standing(
  countryId: string,
  points: number,
  goalDifference: number,
  goalsFor: number,
): GroupStanding {
  return {
    countryId,
    played: 3,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    goalDifference,
    points,
  };
}

describe("calculateGroupStandings", () => {
  it("calculates all group statistics from completed matches", () => {
    const result = calculateGroupStandings(
      ["a", "b", "c"],
      [
        match(),
        match({
          id: "match-2",
          homeCountryId: "a",
          awayCountryId: "c",
          homeGoals: 0,
          awayGoals: 0,
        }),
        match({
          id: "match-3",
          homeCountryId: "b",
          awayCountryId: "c",
          homeGoals: 0,
          awayGoals: 3,
        }),
      ],
    );

    expect(result).toEqual([
      {
        countryId: "a",
        played: 2,
        wins: 1,
        draws: 1,
        losses: 0,
        goalsFor: 2,
        goalsAgainst: 1,
        goalDifference: 1,
        points: 4,
      },
      {
        countryId: "b",
        played: 2,
        wins: 0,
        draws: 0,
        losses: 2,
        goalsFor: 1,
        goalsAgainst: 5,
        goalDifference: -4,
        points: 0,
      },
      {
        countryId: "c",
        played: 2,
        wins: 1,
        draws: 1,
        losses: 0,
        goalsFor: 3,
        goalsAgainst: 0,
        goalDifference: 3,
        points: 4,
      },
    ]);
  });

  it("ignores non-completed, knockout, and out-of-group matches", () => {
    const result = calculateGroupStandings(
      ["a", "b"],
      [
        match({ status: "live", homeGoals: 8 }),
        match({ stage: "round_of_32", advancingCountryId: "a" }),
        match({ homeCountryId: "outside", awayCountryId: "b" }),
      ],
    );

    expect(result.every(({ played }) => played === 0)).toBe(true);
  });

  it("does not mutate countries or matches", () => {
    const countryIds = ["a", "b"];
    const matches = [match()];
    const snapshot = structuredClone({ countryIds, matches });

    calculateGroupStandings(countryIds, matches);

    expect({ countryIds, matches }).toEqual(snapshot);
  });
});

describe("rankGroupStandings", () => {
  it("orders by points, goal difference, then goals scored", () => {
    const ranked = rankGroupStandings([
      standing("few-goals", 6, 2, 3),
      standing("lower-difference", 6, 1, 10),
      standing("leader", 7, -1, 1),
      standing("more-goals", 6, 2, 4),
    ]);

    expect(ranked.map(({ standing: row }) => row.countryId)).toEqual([
      "leader",
      "more-goals",
      "few-goals",
      "lower-difference",
    ]);
    expect(ranked.map(({ calculatedRank }) => calculatedRank)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  it("preserves equal positions using standard competition ranking", () => {
    const ranked = rankGroupStandings([
      standing("a", 7, 2, 4),
      standing("b", 7, 2, 4),
      standing("c", 6, 3, 5),
    ]);

    expect(ranked.map(({ calculatedRank }) => calculatedRank)).toEqual([
      1, 1, 3,
    ]);
    expect(ranked.map(({ standing: row }) => row.countryId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps calculated statistics separate from official override metadata", () => {
    const original = standing("a", 4, 0, 2);
    const [ranked] = rankGroupStandings(
      [original],
      [
        {
          countryId: "a",
          officialRank: 2,
          qualifiedForRoundOf32: true,
          reason: "Official FIFA ordering",
          source: "FIFA",
        },
      ],
    );

    expect(ranked).toEqual({
      standing: original,
      calculatedRank: 1,
      officialRank: 2,
      qualifiedForRoundOf32: true,
      resolutionSource: "override",
      resolutionReason: "Official FIFA ordering",
      resolutionAuthority: "FIFA",
    });
    expect(ranked?.standing.points).toBe(4);
  });

  it("requires override reasons and sources", () => {
    expect(() =>
      rankGroupStandings(
        [standing("a", 0, 0, 0)],
        [{ countryId: "a", reason: "", source: "FIFA" }],
      ),
    ).toThrow("reason and source");
  });
});

describe("resolveBestThirdPlaceQualifications", () => {
  const unambiguous = Array.from({ length: 12 }, (_, index) =>
    standing(`country-${index + 1}`, 20 - index, 0, 1),
  );

  it("selects the first eight at an unambiguous cutoff", () => {
    const result = resolveBestThirdPlaceQualifications(unambiguous);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(
        result.qualifications
          .filter(({ qualifiedForRoundOf32 }) => qualifiedForRoundOf32)
          .map(({ countryId }) => countryId),
      ).toEqual(
        Array.from({ length: 8 }, (_, index) => `country-${index + 1}`),
      );
      expect(
        result.qualifications.every(({ source }) => source === "calculated"),
      ).toBe(true);
    }
  });

  it("requires resolution when an exact-statistics tie crosses eighth place", () => {
    const standings = [
      ...Array.from({ length: 7 }, (_, index) =>
        standing(`clear-${index + 1}`, 20 - index, 0, 1),
      ),
      standing("tied-a", 5, 0, 2),
      standing("tied-b", 5, 0, 2),
      standing("below-a", 4, 0, 2),
      standing("below-b", 3, 0, 2),
      standing("below-c", 2, 0, 2),
    ];
    const result = resolveBestThirdPlaceQualifications(standings);

    expect(result).toMatchObject({
      status: "requires_resolution",
      tiedCountryIds: ["tied-a", "tied-b"],
      availablePlaces: 1,
    });
    if (result.status === "requires_resolution") {
      expect(result.guaranteedQualifications).toHaveLength(7);
    }
  });

  it("accepts complete official resolution of a boundary tie", () => {
    const standings = [
      ...Array.from({ length: 7 }, (_, index) =>
        standing(`clear-${index + 1}`, 20 - index, 0, 1),
      ),
      standing("tied-a", 5, 0, 2),
      standing("tied-b", 5, 0, 2),
      standing("below-a", 4, 0, 2),
      standing("below-b", 3, 0, 2),
      standing("below-c", 2, 0, 2),
    ];
    const resolution: readonly GroupQualification[] = [
      {
        countryId: "tied-a",
        qualifiedForRoundOf32: false,
        source: "override",
      },
      {
        countryId: "tied-b",
        qualifiedForRoundOf32: true,
        source: "override",
      },
    ];
    const result = resolveBestThirdPlaceQualifications(standings, resolution);

    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(
        result.qualifications.find(({ countryId }) => countryId === "tied-b"),
      ).toEqual(resolution[1]);
      expect(
        result.qualifications.filter(({ qualifiedForRoundOf32 }) =>
          Boolean(qualifiedForRoundOf32),
        ),
      ).toHaveLength(8);
    }
  });

  it("does not accept a partial or over-allocating boundary resolution", () => {
    const standings = [
      ...Array.from({ length: 7 }, (_, index) =>
        standing(`clear-${index + 1}`, 20 - index, 0, 1),
      ),
      standing("tied-a", 5, 0, 2),
      standing("tied-b", 5, 0, 2),
      standing("below-a", 4, 0, 2),
      standing("below-b", 3, 0, 2),
      standing("below-c", 2, 0, 2),
    ];

    expect(
      resolveBestThirdPlaceQualifications(standings, [
        {
          countryId: "tied-a",
          qualifiedForRoundOf32: true,
          source: "override",
        },
      ]).status,
    ).toBe("requires_resolution");
  });
});
