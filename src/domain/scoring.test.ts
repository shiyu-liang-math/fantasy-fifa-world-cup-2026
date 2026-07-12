import { describe, expect, it } from "vitest";

import {
  calculateCountryStars,
  calculateParticipantStars,
  THIRD_PLACE_MULTIPLIER,
} from "./scoring";
import type { CountryResult, DraftPick, DraftValue } from "./types";

describe("calculateCountryStars", () => {
  const multipliers: ReadonlyArray<readonly [CountryResult, number]> = [
    ["before_round_of_32", 0],
    ["round_of_32", 1],
    ["round_of_16", 2],
    ["quarterfinal", 3],
    ["semifinal", 4],
    ["fourth_place", 4],
    ["third_place", THIRD_PLACE_MULTIPLIER],
    ["runner_up", 5],
    ["champion", 6],
  ];

  for (const draftValue of [1, 2, 3] as const) {
    for (const [result, multiplier] of multipliers) {
      it(`scores value ${draftValue} at ${result}`, () => {
        expect(calculateCountryStars(draftValue, result)).toBeCloseTo(
          draftValue * multiplier,
          12,
        );
      });
    }
  }

  it.each<readonly [DraftValue, CountryResult, number]>([
    [3, "round_of_32", 3],
    [3, "round_of_16", 6],
    [1, "quarterfinal", 3],
    [2, "semifinal", 8],
    [3, "fourth_place", 12],
    [2, "runner_up", 10],
    [1, "champion", 6],
  ])("matches required example %#", (draftValue, result, expected) => {
    expect(calculateCountryStars(draftValue, result)).toBe(expected);
  });

  it("keeps full precision for third place", () => {
    expect(calculateCountryStars(3, "third_place")).toBeCloseTo(
      13.24511249783653,
      12,
    );
  });
});

describe("calculateParticipantStars", () => {
  it("sums each pick's current result without accumulating prior stages", () => {
    const picks: readonly DraftPick[] = [
      { participantId: "participant", countryId: "a", draftValue: 3 },
      { participantId: "participant", countryId: "b", draftValue: 2 },
      { participantId: "participant", countryId: "c", draftValue: 1 },
    ];
    const results = new Map([
      ["a", "champion"],
      ["b", "round_of_16"],
      ["c", "before_round_of_32"],
    ] satisfies ReadonlyArray<readonly [string, CountryResult]>);

    expect(calculateParticipantStars(picks, results)).toBe(22);
    expect(picks[0]?.draftValue).toBe(3);
  });

  it("ignores a pick with no resolved result", () => {
    const picks: readonly DraftPick[] = [
      { participantId: "participant", countryId: "missing", draftValue: 3 },
    ];

    expect(calculateParticipantStars(picks, new Map())).toBe(0);
  });
});
