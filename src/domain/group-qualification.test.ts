import { describe, expect, it } from "vitest";
import { REFERENCE_SNAPSHOT } from "../data/reference/snapshot";
import { deriveGroupQualifications } from "./group-qualification";

describe("deriveGroupQualifications", () => {
  it("leaves truthful incomplete groups unresolved", () => {
    expect(
      deriveGroupQualifications({
        ...REFERENCE_SNAPSHOT,
        groups: REFERENCE_SNAPSHOT.groups.map((group) => ({
          ...group,
          countryIds: [],
        })),
        matches: [],
      }),
    ).toEqual([]);
  });

  it("reproduces all 32 official qualifiers from the complete snapshot", () => {
    expect(
      deriveGroupQualifications(REFERENCE_SNAPSHOT).filter(
        ({ qualifiedForRoundOf32 }) => qualifiedForRoundOf32,
      ),
    ).toHaveLength(32);
  });
});
