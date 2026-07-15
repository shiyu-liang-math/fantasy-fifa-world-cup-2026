import { describe, expect, it } from "vitest";

import { REFERENCE_COUNTRIES } from "./countries";
import { REFERENCE_DRAFT_PICKS } from "./draft-picks";
import { REFERENCE_PARTICIPANTS } from "./participants";
import { REFERENCE_GROUPS } from "./rounds";
import { REFERENCE_SNAPSHOT } from "./snapshot";

describe("authoritative reference data", () => {
  it("preserves the approved participant display order", () => {
    expect(
      REFERENCE_PARTICIPANTS.map(({ name, abbreviation, displayOrder }) => ({
        name,
        abbreviation,
        displayOrder,
      })),
    ).toEqual([
      { name: "Lyla", abbreviation: "L", displayOrder: 1 },
      { name: "Shiyu", abbreviation: "S", displayOrder: 2 },
      { name: "Ivy", abbreviation: "Y", displayOrder: 3 },
      { name: "Xun", abbreviation: "X", displayOrder: 4 },
      { name: "Houji & Yujin", abbreviation: "H&J", displayOrder: 5 },
    ]);
  });

  it("contains every approved draft pick and value", () => {
    const picks = Object.fromEntries(
      REFERENCE_DRAFT_PICKS.map((pick) => [
        `${pick.participantId}:${pick.countryId}`,
        pick.draftValue,
      ]),
    );

    expect(picks).toEqual({
      "lyla:france": 3,
      "lyla:colombia": 2,
      "lyla:brazil": 1,
      "lyla:norway": 1,
      "lyla:south-korea": 1,
      "shiyu:spain": 3,
      "shiyu:england": 2,
      "shiyu:united-states": 1,
      "shiyu:canada": 1,
      "shiyu:belgium": 1,
      "ivy:portugal": 3,
      "ivy:germany": 2,
      "ivy:uruguay": 1,
      "ivy:netherlands": 1,
      "ivy:senegal": 1,
      "xun:argentina": 3,
      "xun:croatia": 2,
      "xun:mexico": 1,
      "xun:japan": 1,
      "xun:morocco": 1,
      "houji-yujin:switzerland": 3,
      "houji-yujin:sweden": 2,
      "houji-yujin:scotland": 1,
      "houji-yujin:iran": 1,
      "houji-yujin:ivory-coast": 1,
    });
  });

  it("gives each participant three value-1, one value-2, and one value-3 pick", () => {
    for (const participant of REFERENCE_PARTICIPANTS) {
      const values = REFERENCE_DRAFT_PICKS.filter(
        ({ participantId }) => participantId === participant.id,
      ).map(({ draftValue }) => draftValue);

      expect(values).toHaveLength(5);
      expect(values.filter((value) => value === 1)).toHaveLength(3);
      expect(values.filter((value) => value === 2)).toHaveLength(1);
      expect(values.filter((value) => value === 3)).toHaveLength(1);
    }
  });

  it("contains the complete official tournament structure and match snapshot", () => {
    expect(REFERENCE_COUNTRIES).toHaveLength(48);
    expect(REFERENCE_GROUPS).toHaveLength(12);
    expect(
      REFERENCE_GROUPS.every(({ countryIds }) => countryIds.length === 4),
    ).toBe(true);
    expect(REFERENCE_SNAPSHOT.tournament?.referenceDataComplete).toBe(true);
    expect(REFERENCE_SNAPSHOT.tournament?.missingOfficialData).toEqual([]);
    expect(REFERENCE_SNAPSHOT.matches).toHaveLength(104);
    expect(
      REFERENCE_SNAPSHOT.matches.filter(({ status }) => status === "completed"),
    ).toHaveLength(101);
  });
});
