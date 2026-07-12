import { describe, expect, it } from "vitest";

import { createReferenceTournamentRepository } from "./local-tournament-repository";
import { createFictionalDevelopmentRepository } from "./development-tournament-repository";

describe("LocalTournamentRepository", () => {
  it("returns deterministic participant order", async () => {
    const repository = createReferenceTournamentRepository();
    expect(
      (await repository.getSnapshot()).participants.map(({ id }) => id),
    ).toEqual(["lyla", "shiyu", "ivy", "xun", "houji-yujin"]);
  });

  it("defensively copies arrays and nested records", async () => {
    const repository = createFictionalDevelopmentRepository();
    const firstRead = await repository.getSnapshot();
    const mutable = firstRead as unknown as {
      tournament: { missingOfficialData: string[] };
      groups: Array<{ countryIds: string[] }>;
      matches: Array<{
        homeGoals: number | null;
        homeSourceSlot: { outcome: string } | null;
      }>;
      groupQualifications: Array<{ qualifiedForRoundOf32: boolean }>;
    };
    mutable.tournament.missingOfficialData.push("mutation");
    mutable.groups[0]!.countryIds.push("mutation");
    mutable.matches[0]!.homeGoals = 99;
    mutable.matches[4]!.homeSourceSlot!.outcome = "loser";
    mutable.groupQualifications[0]!.qualifiedForRoundOf32 = false;

    const secondRead = await repository.getSnapshot();
    expect(secondRead.tournament?.missingOfficialData).not.toContain(
      "mutation",
    );
    expect(secondRead.groups[0]?.countryIds).not.toContain("mutation");
    expect(secondRead.matches[0]?.homeGoals).toBe(2);
    expect(secondRead.matches[4]?.homeSourceSlot?.outcome).toBe("winner");
    expect(secondRead.groupQualifications[0]?.qualifiedForRoundOf32).toBe(true);
  });

  it("keeps official reference and fictional development matches separate", async () => {
    const reference = createReferenceTournamentRepository();
    const development = createFictionalDevelopmentRepository();

    expect((await reference.getSnapshot()).matches).toEqual([]);
    expect(
      (await development.getSnapshot()).matches.every(
        ({ dataClassification }) =>
          dataClassification === "fictional_development",
      ),
    ).toBe(true);
  });
});
