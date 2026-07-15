import { describe, expect, it } from "vitest";
import { REFERENCE_SNAPSHOT } from "../data/reference/snapshot";
import { deriveGroupQualifications } from "./group-qualification";

describe("deriveGroupQualifications", () => {
  it("leaves truthful incomplete groups unresolved", () => {
    expect(deriveGroupQualifications(REFERENCE_SNAPSHOT)).toEqual([]);
  });
});
