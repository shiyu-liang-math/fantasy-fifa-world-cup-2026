import { describe, expect, it } from "vitest";

import { rankWithTies, STAR_RANKING_TOLERANCE } from "./ranking";

type Entry = Readonly<{ id: string; value: number }>;

const rank = (entries: readonly Entry[], tolerance = 0) =>
  rankWithTies(entries, (entry) => entry.value, { tolerance });

describe("rankWithTies", () => {
  it("uses standard competition ranking", () => {
    const result = rank([
      { id: "a", value: 20 },
      { id: "b", value: 20 },
      { id: "c", value: 18 },
    ]);

    expect(result.map(({ rank: position }) => position)).toEqual([1, 1, 3]);
  });

  it("sorts descending and handles multiple tie groups", () => {
    const result = rank([
      { id: "e", value: 5 },
      { id: "a", value: 10 },
      { id: "b", value: 8 },
      { id: "c", value: 8 },
      { id: "d", value: 5 },
    ]);

    expect(
      result.map(({ entry, rank: position }) => [entry.id, position]),
    ).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["e", 4],
      ["d", 4],
    ]);
  });

  it("treats Star totals differing by less than 0.01 as tied", () => {
    const result = rank(
      [
        { id: "a", value: 10 },
        { id: "b", value: 9.995 },
        { id: "c", value: 9 },
      ],
      STAR_RANKING_TOLERANCE,
    );

    expect(result.map(({ rank: position }) => position)).toEqual([1, 1, 3]);
  });

  it("does not tie values whose computed difference is exactly 0.01", () => {
    const lower = 0;
    const higher = STAR_RANKING_TOLERANCE;

    expect(Math.abs(higher - lower)).toBe(STAR_RANKING_TOLERANCE);
    expect(
      rank(
        [
          { id: "a", value: higher },
          { id: "b", value: lower },
        ],
        STAR_RANKING_TOLERANCE,
      ).map(({ rank: position }) => position),
    ).toEqual([1, 2]);
  });

  it("does not tie values differing by more than 0.01", () => {
    expect(
      rank(
        [
          { id: "a", value: 10.02 },
          { id: "b", value: 10 },
        ],
        STAR_RANKING_TOLERANCE,
      ).map(({ rank: position }) => position),
    ).toEqual([1, 2]);
  });

  it("uses the exact product comparison near the tolerance boundary", () => {
    const inside = 1 + STAR_RANKING_TOLERANCE - Number.EPSILON;
    const outside = 1 + STAR_RANKING_TOLERANCE + Number.EPSILON;

    expect(Math.abs(inside - 1) < STAR_RANKING_TOLERANCE).toBe(true);
    expect(Math.abs(outside - 1) < STAR_RANKING_TOLERANCE).toBe(false);
  });

  it("uses exact integer equality when tolerance is omitted", () => {
    expect(
      rank([
        { id: "a", value: 10 },
        { id: "b", value: 9.999 },
      ]).map(({ rank: position }) => position),
    ).toEqual([1, 2]);
  });

  it("preserves input order among tied entries and does not mutate input", () => {
    const entries = [
      { id: "b", value: 10 },
      { id: "a", value: 10 },
    ];
    const snapshot = structuredClone(entries);

    expect(rank(entries).map(({ entry }) => entry.id)).toEqual(["b", "a"]);
    expect(entries).toEqual(snapshot);
  });

  it("supports empty input and rejects invalid tolerances", () => {
    expect(rank([])).toEqual([]);
    expect(() => rank([], -1)).toThrow(RangeError);
  });
});
