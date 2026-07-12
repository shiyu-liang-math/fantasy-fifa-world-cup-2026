import type { RankedEntry } from "./types";

export const STAR_RANKING_TOLERANCE = 1e-2;

export type RankingOptions = Readonly<{
  tolerance?: number;
}>;

export function rankWithTies<T>(
  entries: readonly T[],
  getValue: (entry: T) => number,
  options: RankingOptions = {},
): RankedEntry<T>[] {
  const tolerance = options.tolerance ?? 0;

  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new RangeError(
      "Ranking tolerance must be a finite non-negative number.",
    );
  }

  const sorted = entries
    .map((entry, originalIndex) => ({
      entry,
      originalIndex,
      value: getValue(entry),
    }))
    .sort((left, right) =>
      right.value === left.value
        ? left.originalIndex - right.originalIndex
        : right.value - left.value,
    );

  let currentRank = 0;
  let groupValue: number | undefined;

  return sorted.map(({ entry, value }, index) => {
    if (
      groupValue === undefined ||
      !valuesAreTied(value, groupValue, tolerance)
    ) {
      currentRank = index + 1;
      groupValue = value;
    }

    return { entry, rank: currentRank, value };
  });
}

function valuesAreTied(
  left: number,
  right: number,
  tolerance: number,
): boolean {
  return tolerance === 0 ? left === right : Math.abs(left - right) < tolerance;
}
