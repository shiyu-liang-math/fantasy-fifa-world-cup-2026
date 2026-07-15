import { describe, expect, it } from "vitest";

import type { GroupQualificationOverrideRecord } from "../data/types";
import {
  compareGroupOverrideEntries,
  groupOverrideEntryId,
} from "./group-override-entry";

function entry(
  countryId: string,
  officialRank: number,
  setId = 'set:-"雪',
): GroupQualificationOverrideRecord {
  const tournamentId = "cup:-雪";
  const groupCode = "A";
  return {
    id: groupOverrideEntryId(setId, tournamentId, groupCode, countryId),
    setId,
    tournamentId,
    groupCode,
    countryId,
    officialRank,
    reason: "Official",
    source: "FIFA",
  };
}

describe("group override entry identity", () => {
  it("uses an injective canonical JSON identity for delimiter-like strings", () => {
    expect(groupOverrideEntryId('a:b-"雪', "cup", "A", "c:d-e")).toBe(
      '["a:b-\\\"雪","cup","A","c:d-e"]',
    );
    expect(groupOverrideEntryId("a:b", "cup", "A", "c:d-e")).not.toBe(
      groupOverrideEntryId("a", "cup", "A", "b:c:d-e"),
    );
  });

  it("keeps identity stable when rank changes", () => {
    expect(entry("france", 1).id).toBe(entry("france", 4).id);
  });

  it("orders by rank, country code units, then identity", () => {
    expect(
      [entry("ä", 2), entry("z", 1), entry("Z", 1)].sort(
        compareGroupOverrideEntries,
      ),
    ).toEqual([entry("Z", 1), entry("z", 1), entry("ä", 2)]);
  });
});
