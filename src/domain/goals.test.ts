import { describe, expect, it } from "vitest";

import { calculateCountryGoals, calculateParticipantGoals } from "./goals";
import type { DomainMatch, DraftPick, MatchStatus } from "./types";

function match(overrides: Partial<DomainMatch> = {}): DomainMatch {
  return {
    id: "match-1",
    stage: "group",
    status: "completed",
    homeCountryId: "home",
    awayCountryId: "away",
    homeGoals: 2,
    awayGoals: 1,
    wentToExtraTime: false,
    homeShootoutGoals: null,
    awayShootoutGoals: null,
    advancingCountryId: null,
    ...overrides,
  };
}

describe("goal calculations", () => {
  it("sums completed home and away scores across matches", () => {
    const matches = [
      match(),
      match({
        id: "match-2",
        homeCountryId: "other",
        awayCountryId: "home",
        homeGoals: 0,
        awayGoals: 3,
      }),
    ];

    expect(calculateCountryGoals(matches, "home")).toBe(5);
    expect(calculateCountryGoals(matches, "away")).toBe(1);
  });

  it("counts the official score after extra time but excludes shootout kicks", () => {
    const extraTimeMatch = match({
      stage: "round_of_16",
      homeGoals: 1,
      awayGoals: 1,
      wentToExtraTime: true,
      homeShootoutGoals: 5,
      awayShootoutGoals: 4,
      advancingCountryId: "home",
    });

    expect(calculateCountryGoals([extraTimeMatch], "home")).toBe(1);
    expect(calculateCountryGoals([extraTimeMatch], "away")).toBe(1);
  });

  it.each<MatchStatus>(["scheduled", "live", "postponed", "cancelled"])(
    "ignores a %s match",
    (status) => {
      expect(calculateCountryGoals([match({ status })], "home")).toBe(0);
    },
  );

  it("recalculates from replacement canonical input without double counting", () => {
    const original = [match({ homeGoals: 2 })];
    const corrected = [match({ homeGoals: 4 })];

    expect(calculateCountryGoals(original, "home")).toBe(2);
    expect(calculateCountryGoals(corrected, "home")).toBe(4);
    expect(calculateCountryGoals(corrected, "home")).toBe(4);
  });

  it("sums unique drafted countries for a participant", () => {
    const picks: readonly DraftPick[] = [
      { participantId: "participant", countryId: "home", draftValue: 3 },
      { participantId: "participant", countryId: "away", draftValue: 2 },
      { participantId: "participant", countryId: "home", draftValue: 3 },
    ];

    expect(calculateParticipantGoals(picks, [match()])).toBe(3);
  });

  it("does not mutate match input", () => {
    const matches = [match()];
    const snapshot = structuredClone(matches);

    calculateCountryGoals(matches, "home");

    expect(matches).toEqual(snapshot);
  });
});
