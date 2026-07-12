import { describe, expect, it } from "vitest";

import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "./development/scenario";
import { REFERENCE_SNAPSHOT } from "./reference/snapshot";
import type { TournamentDataSnapshot } from "./types";
import { validateCanonicalData } from "./validation";

describe("validateCanonicalData", () => {
  it("accepts both local datasets with only declared incompleteness", () => {
    for (const snapshot of [
      REFERENCE_SNAPSHOT,
      FICTIONAL_DEVELOPMENT_SNAPSHOT,
    ]) {
      const issues = validateCanonicalData(snapshot);
      expect(issues.filter(({ severity }) => severity === "error")).toEqual([]);
      expect(issues.some(({ severity }) => severity === "incomplete")).toBe(
        true,
      );
    }
  });

  it("rejects duplicate participant identity fields", () => {
    const duplicate = {
      ...REFERENCE_SNAPSHOT,
      participants: [
        ...REFERENCE_SNAPSHOT.participants,
        { ...REFERENCE_SNAPSHOT.participants[0]!, id: "duplicate-id" },
      ],
    } satisfies TournamentDataSnapshot;

    expect(validateCanonicalData(duplicate).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "duplicate_participant_slug",
        "duplicate_participant_abbreviation",
        "duplicate_participant_display_order",
      ]),
    );
  });

  it("rejects unknown draft references and duplicate ownership", () => {
    const duplicateOwner = {
      ...REFERENCE_SNAPSHOT,
      draftPicks: [
        ...REFERENCE_SNAPSHOT.draftPicks,
        {
          id: "bad-pick",
          tournamentId: "fifa-world-cup-2026",
          participantId: "unknown",
          countryId: "france",
          draftValue: 1 as const,
        },
      ],
    } satisfies TournamentDataSnapshot;

    expect(
      validateCanonicalData(duplicateOwner).map(({ code }) => code),
    ).toEqual(
      expect.arrayContaining([
        "unknown_pick_participant",
        "duplicate_country_owner",
      ]),
    );
  });

  it("rejects unknown and self-referencing match source slots", () => {
    const match = FICTIONAL_DEVELOPMENT_SNAPSHOT.matches[4]!;
    const invalid = {
      ...FICTIONAL_DEVELOPMENT_SNAPSHOT,
      matches: [
        ...FICTIONAL_DEVELOPMENT_SNAPSHOT.matches.slice(0, 4),
        {
          ...match,
          homeSourceSlot: {
            sourceMatchId: match.id,
            outcome: "winner" as const,
          },
          awaySourceSlot: {
            sourceMatchId: "missing",
            outcome: "winner" as const,
          },
        },
        ...FICTIONAL_DEVELOPMENT_SNAPSHOT.matches.slice(5),
      ],
    } satisfies TournamentDataSnapshot;

    expect(validateCanonicalData(invalid).map(({ code }) => code)).toEqual(
      expect.arrayContaining(["self_source_match", "unknown_source_match"]),
    );
  });

  it("rejects indirect match-source cycles", () => {
    const [first, second, third] = FICTIONAL_DEVELOPMENT_SNAPSHOT.matches;
    const cyclic = {
      ...FICTIONAL_DEVELOPMENT_SNAPSHOT,
      matches: [
        {
          ...first!,
          homeSourceSlot: {
            sourceMatchId: second!.id,
            outcome: "winner" as const,
          },
        },
        {
          ...second!,
          homeSourceSlot: {
            sourceMatchId: third!.id,
            outcome: "winner" as const,
          },
        },
        {
          ...third!,
          homeSourceSlot: {
            sourceMatchId: first!.id,
            outcome: "loser" as const,
          },
        },
        ...FICTIONAL_DEVELOPMENT_SNAPSHOT.matches.slice(3),
      ],
    } satisfies TournamentDataSnapshot;

    const cycles = validateCanonicalData(cyclic).filter(
      ({ code }) => code === "cyclic_source_matches",
    );
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.message).toContain(first!.id);
  });

  it("runtime-validates winner and loser source semantics", () => {
    const target = FICTIONAL_DEVELOPMENT_SNAPSHOT.matches[4]!;
    const invalid = {
      ...FICTIONAL_DEVELOPMENT_SNAPSHOT,
      matches: FICTIONAL_DEVELOPMENT_SNAPSHOT.matches.map((match) =>
        match.id === target.id
          ? {
              ...match,
              homeSourceSlot: {
                sourceMatchId: "dev-r32-shootout",
                outcome: "invalid",
              },
            }
          : match,
      ),
    } as unknown as TournamentDataSnapshot;

    expect(validateCanonicalData(invalid).map(({ code }) => code)).toContain(
      "invalid_source_outcome",
    );
  });

  it("rejects a false claim that an incomplete dataset is complete", () => {
    const invalid = {
      ...REFERENCE_SNAPSHOT,
      tournament: {
        ...REFERENCE_SNAPSHOT.tournament!,
        referenceDataComplete: true,
      },
    } satisfies TournamentDataSnapshot;

    expect(validateCanonicalData(invalid).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "false_completeness_claim",
        "false_group_completeness_claim",
      ]),
    );
  });

  it("rejects invalid qualification and override references", () => {
    const invalid = {
      ...REFERENCE_SNAPSHOT,
      groupQualifications: [
        {
          countryId: "missing",
          qualifiedForRoundOf32: true,
          source: "calculated" as const,
        },
        {
          countryId: "missing",
          qualifiedForRoundOf32: false,
          source: "override" as const,
        },
      ],
      groupOverrides: [
        {
          id: "bad-override",
          tournamentId: "fifa-world-cup-2026",
          groupCode: "A" as const,
          countryId: "missing",
          reason: "",
          source: "",
        },
      ],
    } satisfies TournamentDataSnapshot;

    expect(validateCanonicalData(invalid).map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        "unknown_qualification_country",
        "duplicate_group_qualification",
        "unknown_override_country",
        "invalid_group_override",
      ]),
    );
  });
});
