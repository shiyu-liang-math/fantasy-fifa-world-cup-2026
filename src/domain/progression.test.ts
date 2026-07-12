import { describe, expect, it } from "vitest";

import { deriveProgression } from "./progression";
import type {
  DomainMatch,
  GroupQualification,
  MatchStage,
  MatchStatus,
} from "./types";

function knockoutMatch(
  id: string,
  stage: Exclude<MatchStage, "group">,
  homeCountryId: string,
  awayCountryId: string,
  advancingCountryId: string,
  status: MatchStatus = "completed",
): DomainMatch {
  return {
    id,
    stage,
    status,
    homeCountryId,
    awayCountryId,
    homeGoals: 1,
    awayGoals: 0,
    wentToExtraTime: false,
    homeShootoutGoals: null,
    awayShootoutGoals: null,
    advancingCountryId,
  };
}

const qualification = (
  countryId: string,
  qualifiedForRoundOf32: boolean,
): GroupQualification => ({
  countryId,
  qualifiedForRoundOf32,
  source: "calculated",
});

describe("deriveProgression", () => {
  it("uses resolved group qualification as the only Round-of-32 input", () => {
    const result = deriveProgression({
      countryIds: ["qualified", "eliminated", "unresolved"],
      matches: [],
      groupQualifications: [
        qualification("qualified", true),
        qualification("eliminated", false),
      ],
    });

    expect(result).toEqual([
      { countryId: "qualified", result: "round_of_32", isEliminated: false },
      {
        countryId: "eliminated",
        result: "before_round_of_32",
        isEliminated: true,
      },
      {
        countryId: "unresolved",
        result: "before_round_of_32",
        isEliminated: false,
      },
    ]);
  });

  it("advances and eliminates countries through completed knockout rounds", () => {
    const result = deriveProgression({
      countryIds: ["winner", "r32-loser", "r16-loser", "qf-loser"],
      groupQualifications: [
        qualification("winner", true),
        qualification("r32-loser", true),
        qualification("r16-loser", true),
        qualification("qf-loser", true),
      ],
      matches: [
        knockoutMatch("qf", "quarterfinal", "winner", "qf-loser", "winner"),
        knockoutMatch("r16", "round_of_16", "winner", "r16-loser", "winner"),
        knockoutMatch("r32", "round_of_32", "winner", "r32-loser", "winner"),
      ],
    });

    expect(result).toEqual([
      { countryId: "winner", result: "semifinal", isEliminated: false },
      { countryId: "r32-loser", result: "round_of_32", isEliminated: true },
      { countryId: "r16-loser", result: "round_of_16", isEliminated: true },
      { countryId: "qf-loser", result: "quarterfinal", isEliminated: true },
    ]);
  });

  it.each<MatchStatus>(["scheduled", "live", "postponed", "cancelled"])(
    "ignores a %s knockout match",
    (status) => {
      const result = deriveProgression({
        countryIds: ["a", "b"],
        groupQualifications: [
          qualification("a", true),
          qualification("b", true),
        ],
        matches: [knockoutMatch("r32", "round_of_32", "a", "b", "a", status)],
      });

      expect(result.map(({ result: countryResult }) => countryResult)).toEqual([
        "round_of_32",
        "round_of_32",
      ]);
    },
  );

  it("gives a semifinal winner immediate runner-up status", () => {
    const result = deriveProgression({
      countryIds: ["winner", "loser"],
      groupQualifications: [],
      matches: [knockoutMatch("sf", "semifinal", "winner", "loser", "winner")],
    });

    expect(result).toEqual([
      { countryId: "winner", result: "runner_up", isEliminated: false },
      { countryId: "loser", result: "semifinal", isEliminated: true },
    ]);
  });

  it("keeps both losing semifinalists at semifinal status before third place", () => {
    const result = deriveProgression({
      countryIds: ["finalist-a", "finalist-b", "loser-a", "loser-b"],
      groupQualifications: [],
      matches: [
        knockoutMatch(
          "sf-a",
          "semifinal",
          "finalist-a",
          "loser-a",
          "finalist-a",
        ),
        knockoutMatch(
          "sf-b",
          "semifinal",
          "finalist-b",
          "loser-b",
          "finalist-b",
        ),
      ],
    });

    expect(
      result.filter(
        ({ result: countryResult }) => countryResult === "semifinal",
      ),
    ).toEqual([
      { countryId: "loser-a", result: "semifinal", isEliminated: true },
      { countryId: "loser-b", result: "semifinal", isEliminated: true },
    ]);
  });

  it("assigns third and fourth place only after their completed match", () => {
    const result = deriveProgression({
      countryIds: ["third", "fourth"],
      groupQualifications: [],
      matches: [
        knockoutMatch("third", "third_place", "third", "fourth", "third"),
      ],
    });

    expect(result).toEqual([
      { countryId: "third", result: "third_place", isEliminated: true },
      { countryId: "fourth", result: "fourth_place", isEliminated: true },
    ]);
  });

  it("assigns champion and runner-up after the final", () => {
    const result = deriveProgression({
      countryIds: ["champion", "runner-up"],
      groupQualifications: [],
      matches: [
        knockoutMatch("final", "final", "champion", "runner-up", "champion"),
      ],
    });

    expect(result).toEqual([
      { countryId: "champion", result: "champion", isEliminated: false },
      { countryId: "runner-up", result: "runner_up", isEliminated: true },
    ]);
  });

  it("uses the advancing country for a completed shootout", () => {
    const shootout = {
      ...knockoutMatch("r32", "round_of_32", "a", "b", "b"),
      homeGoals: 1,
      awayGoals: 1,
      wentToExtraTime: true,
      homeShootoutGoals: 4,
      awayShootoutGoals: 5,
    } satisfies DomainMatch;
    const result = deriveProgression({
      countryIds: ["a", "b"],
      groupQualifications: [qualification("a", true), qualification("b", true)],
      matches: [shootout],
    });

    expect(result).toEqual([
      { countryId: "a", result: "round_of_32", isEliminated: true },
      { countryId: "b", result: "round_of_16", isEliminated: false },
    ]);
  });

  it("recalculates a corrected advancing country without retaining prior state", () => {
    const input = {
      countryIds: ["a", "b"],
      groupQualifications: [qualification("a", true), qualification("b", true)],
    };
    const original = deriveProgression({
      ...input,
      matches: [knockoutMatch("r32", "round_of_32", "a", "b", "a")],
    });
    const correctedInput = {
      ...input,
      matches: [knockoutMatch("r32", "round_of_32", "a", "b", "b")],
    };

    expect(original[0]?.result).toBe("round_of_16");
    expect(deriveProgression(correctedInput)).toEqual([
      { countryId: "a", result: "round_of_32", isEliminated: true },
      { countryId: "b", result: "round_of_16", isEliminated: false },
    ]);
    expect(deriveProgression(correctedInput)).toEqual(
      deriveProgression(correctedInput),
    );
  });

  it("rejects invalid completed knockout advancement", () => {
    expect(() =>
      deriveProgression({
        countryIds: ["a", "b"],
        groupQualifications: [],
        matches: [knockoutMatch("r32", "round_of_32", "a", "b", "outsider")],
      }),
    ).toThrow("valid advancing country");
  });

  it("does not mutate any input", () => {
    const input = {
      countryIds: ["a", "b"],
      groupQualifications: [qualification("a", true), qualification("b", true)],
      matches: [knockoutMatch("r32", "round_of_32", "a", "b", "a")],
    };
    const snapshot = structuredClone(input);

    deriveProgression(input);

    expect(input).toEqual(snapshot);
  });
});
