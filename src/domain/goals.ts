import { isCompletedMatch } from "./match-validation";
import type { CountryId, DomainMatch, DraftPick } from "./types";

export function calculateCountryGoals(
  matches: readonly DomainMatch[],
  countryId: CountryId,
): number {
  return matches.reduce((total, match) => {
    if (!isCompletedMatch(match)) {
      return total;
    }

    if (match.homeCountryId === countryId) {
      return total + (match.homeGoals ?? 0);
    }

    if (match.awayCountryId === countryId) {
      return total + (match.awayGoals ?? 0);
    }

    return total;
  }, 0);
}

export function calculateParticipantGoals(
  picks: readonly DraftPick[],
  matches: readonly DomainMatch[],
): number {
  const countryIds = new Set(picks.map((pick) => pick.countryId));

  return [...countryIds].reduce(
    (total, countryId) => total + calculateCountryGoals(matches, countryId),
    0,
  );
}
