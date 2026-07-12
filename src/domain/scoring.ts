import type { CountryId, CountryResult, DraftPick, DraftValue } from "./types";

export const THIRD_PLACE_MULTIPLIER = 6 - Math.log2(3);

const RESULT_MULTIPLIERS: Readonly<Record<CountryResult, number>> = {
  before_round_of_32: 0,
  round_of_32: 1,
  round_of_16: 2,
  quarterfinal: 3,
  semifinal: 4,
  fourth_place: 4,
  third_place: THIRD_PLACE_MULTIPLIER,
  runner_up: 5,
  champion: 6,
};

export function calculateCountryStars(
  draftValue: DraftValue,
  result: CountryResult,
): number {
  return draftValue * RESULT_MULTIPLIERS[result];
}

export function calculateParticipantStars(
  picks: readonly DraftPick[],
  resultsByCountry: ReadonlyMap<CountryId, CountryResult>,
): number {
  return picks.reduce((total, pick) => {
    const result = resultsByCountry.get(pick.countryId);
    return result === undefined
      ? total
      : total + calculateCountryStars(pick.draftValue, result);
  }, 0);
}
