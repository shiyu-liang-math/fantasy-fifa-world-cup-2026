import type { GroupQualificationOverrideRecord } from "../data/types";

export function groupOverrideEntryId(
  overrideSetId: string,
  tournamentId: string,
  groupCode: string,
  countryId: string,
): string {
  return JSON.stringify([overrideSetId, tournamentId, groupCode, countryId]);
}

export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareGroupOverrideEntries(
  left: GroupQualificationOverrideRecord,
  right: GroupQualificationOverrideRecord,
): number {
  return (
    (left.officialRank ?? Number.MAX_SAFE_INTEGER) -
      (right.officialRank ?? Number.MAX_SAFE_INTEGER) ||
    compareCodeUnits(left.countryId, right.countryId) ||
    compareCodeUnits(left.id, right.id)
  );
}
