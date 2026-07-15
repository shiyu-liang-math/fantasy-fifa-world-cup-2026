import { describe, expect, it } from "vitest";

import { isCompletedMatch, validateMatch } from "./match-validation";
import type { DomainMatch } from "./types";

function match(overrides: Partial<DomainMatch> = {}): DomainMatch {
  return {
    id: "match-1",
    stage: "group",
    status: "completed",
    homeCountryId: "home",
    awayCountryId: "away",
    homeGoals: 1,
    awayGoals: 1,
    wentToExtraTime: false,
    homeShootoutGoals: null,
    awayShootoutGoals: null,
    advancingCountryId: null,
    ...overrides,
  };
}

const codes = (candidate: DomainMatch) =>
  validateMatch(candidate).map(({ code }) => code);

describe("match validation", () => {
  it("accepts a completed group draw", () => {
    expect(validateMatch(match())).toEqual([]);
  });

  it("accepts a completed knockout shootout", () => {
    expect(
      validateMatch(
        match({
          stage: "round_of_32",
          wentToExtraTime: true,
          homeShootoutGoals: 5,
          awayShootoutGoals: 4,
          advancingCountryId: "home",
        }),
      ),
    ).toEqual([]);
  });

  it.each(["scheduled", "live", "postponed", "cancelled"] as const)(
    "rejects result fields on a %s match",
    (status) => {
      expect(
        codes(
          match({
            status,
            homeGoals: 1,
            awayGoals: 0,
            wentToExtraTime: true,
          }),
        ),
      ).toContain("result_before_completion");
    },
  );

  it("rejects extra time in a group match", () => {
    expect(codes(match({ stage: "group", wentToExtraTime: true }))).toContain(
      "group_extra_time",
    );
  });

  it.each([
    ["negative", { homeGoals: -1 }],
    ["fractional", { awayGoals: 1.5 }],
  ] as const)("rejects a %s score", (_label, override) => {
    expect(codes(match(override))).toContain("invalid_score");
  });

  it("rejects the same home and away country", () => {
    expect(codes(match({ awayCountryId: "home" }))).toContain("same_country");
  });

  it("requires countries and scores for a completed match", () => {
    expect(
      codes(
        match({
          homeCountryId: null,
          awayCountryId: null,
          homeGoals: null,
          awayGoals: null,
        }),
      ),
    ).toEqual(
      expect.arrayContaining([
        "missing_home_country",
        "missing_away_country",
        "missing_home_goals",
        "missing_away_goals",
      ]),
    );
  });

  it("rejects partial, tied, and no-extra-time shootout data", () => {
    expect(codes(match({ homeShootoutGoals: 5 }))).toEqual(
      expect.arrayContaining([
        "incomplete_shootout",
        "shootout_without_extra_time",
      ]),
    );
    expect(
      codes(
        match({
          stage: "round_of_32",
          wentToExtraTime: true,
          homeShootoutGoals: 4,
          awayShootoutGoals: 4,
          advancingCountryId: "home",
        }),
      ),
    ).toContain("tied_shootout");
  });

  it("rejects shootouts and advancing countries in group matches", () => {
    expect(
      codes(
        match({
          wentToExtraTime: true,
          homeShootoutGoals: 5,
          awayShootoutGoals: 4,
          advancingCountryId: "home",
        }),
      ),
    ).toEqual(
      expect.arrayContaining(["group_shootout", "group_advancing_country"]),
    );
  });

  it("requires a valid advancing country for a completed knockout match", () => {
    expect(codes(match({ stage: "quarterfinal" }))).toContain(
      "missing_advancing_country",
    );
    expect(
      codes(match({ stage: "quarterfinal", advancingCountryId: "outsider" })),
    ).toContain("invalid_advancing_country");
  });

  it("requires the advancing country to win the score or shootout", () => {
    expect(
      codes(
        match({
          stage: "quarterfinal",
          homeGoals: 2,
          awayGoals: 1,
          advancingCountryId: "away",
        }),
      ),
    ).toContain("advancing_country_did_not_win");
    expect(
      codes(
        match({
          stage: "quarterfinal",
          homeGoals: 2,
          awayGoals: 1,
          wentToExtraTime: true,
          homeShootoutGoals: 4,
          awayShootoutGoals: 3,
          advancingCountryId: "home",
        }),
      ),
    ).toContain("shootout_on_non_draw");
  });

  it("allows unresolved scheduled matches but rejects premature advancement", () => {
    expect(
      validateMatch(
        match({
          status: "scheduled",
          homeCountryId: null,
          awayCountryId: null,
          homeGoals: null,
          awayGoals: null,
        }),
      ),
    ).toEqual([]);
    expect(
      codes(
        match({
          status: "live",
          homeGoals: null,
          awayGoals: null,
          advancingCountryId: "home",
        }),
      ),
    ).toContain("advancement_before_completion");
  });

  it("uses one exact completed-match predicate", () => {
    expect(isCompletedMatch(match())).toBe(true);
    expect(isCompletedMatch(match({ status: "live" }))).toBe(false);
  });

  it("does not mutate match input", () => {
    const candidate = match({ homeGoals: -1 });
    const snapshot = structuredClone(candidate);

    validateMatch(candidate);

    expect(candidate).toEqual(snapshot);
  });
});
