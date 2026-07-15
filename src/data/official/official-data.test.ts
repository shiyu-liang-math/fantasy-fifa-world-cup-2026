import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import reviewedCommandBundle from "../../../data/official/fifa-world-cup-2026.reviewed-commands.json";
import {
  prepareAdministrationUpdate,
  type AdministrationCommand,
} from "../../domain/admin";
import { calculateCountryGoals } from "../../domain/goals";
import type { TournamentDataSnapshot } from "../types";
import {
  OFFICIAL_RESULTS_ARTIFACT,
  OFFICIAL_STRUCTURE_ARTIFACT,
  OFFICIAL_TOURNAMENT_SNAPSHOT,
} from "./snapshot";
import { validateOfficialTournamentData } from "./validation";

const preservedCountryIds = [
  "argentina",
  "belgium",
  "brazil",
  "canada",
  "colombia",
  "croatia",
  "england",
  "france",
  "germany",
  "iran",
  "ivory-coast",
  "japan",
  "mexico",
  "morocco",
  "netherlands",
  "norway",
  "portugal",
  "scotland",
  "senegal",
  "south-korea",
  "spain",
  "sweden",
  "switzerland",
  "united-states",
  "uruguay",
];

describe("official FIFA World Cup 2026 artifacts", () => {
  it("passes strict artifact and canonical semantic validation", () => {
    expect(() =>
      validateOfficialTournamentData(
        OFFICIAL_STRUCTURE_ARTIFACT,
        OFFICIAL_RESULTS_ARTIFACT,
        OFFICIAL_TOURNAMENT_SNAPSHOT,
      ),
    ).not.toThrow();
  });

  it("binds results to the exact structure bytes and preserves existing IDs", () => {
    const bytes = readFileSync(
      "data/official/fifa-world-cup-2026.structure.json",
    );
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      OFFICIAL_RESULTS_ARTIFACT.structureSha256,
    );
    expect(
      preservedCountryIds.every((id) =>
        OFFICIAL_TOURNAMENT_SNAPSHOT.countries.some(
          (country) => country.id === id,
        ),
      ),
    ).toBe(true);
  });

  it("has the complete cutoff state without future fabricated results", () => {
    const completed = OFFICIAL_TOURNAMENT_SNAPSHOT.matches.filter(
      ({ status }) => status === "completed",
    );
    const unresolved = OFFICIAL_TOURNAMENT_SNAPSHOT.matches.filter(
      ({ status }) => status !== "completed",
    );
    expect(OFFICIAL_TOURNAMENT_SNAPSHOT.countries).toHaveLength(48);
    expect(OFFICIAL_TOURNAMENT_SNAPSHOT.groups).toHaveLength(12);
    expect(OFFICIAL_TOURNAMENT_SNAPSHOT.matches).toHaveLength(104);
    expect(completed).toHaveLength(101);
    expect(unresolved).toHaveLength(3);
    expect(
      completed.filter(({ wentToExtraTime }) => wentToExtraTime),
    ).toHaveLength(8);
    expect(
      completed.filter(({ homeShootoutGoals }) => homeShootoutGoals !== null),
    ).toHaveLength(4);
    expect(
      unresolved.every(
        ({ homeGoals, awayGoals, advancingCountryId }) =>
          homeGoals === null &&
          awayGoals === null &&
          advancingCountryId === null,
      ),
    ).toBe(true);
  });

  it("reproduces official qualification and excludes shootout kicks from Golden Goal", () => {
    expect(
      OFFICIAL_TOURNAMENT_SNAPSHOT.groupQualifications.filter(
        ({ qualifiedForRoundOf32 }) => qualifiedForRoundOf32,
      ),
    ).toHaveLength(32);
    expect(
      OFFICIAL_RESULTS_ARTIFACT.bestThirdPlaceQualifiedCountryIds,
    ).toHaveLength(8);
    expect(OFFICIAL_TOURNAMENT_SNAPSHOT.groupOverrides).toEqual([]);

    const calculatedGoals = OFFICIAL_TOURNAMENT_SNAPSHOT.countries.reduce(
      (total, country) =>
        total +
        calculateCountryGoals(OFFICIAL_TOURNAMENT_SNAPSHOT.matches, country.id),
      0,
    );
    const officialMatchGoals =
      OFFICIAL_RESULTS_ARTIFACT.completedResults.reduce(
        (total, result) => total + result.homeGoals + result.awayGoals,
        0,
      );
    const shootoutKicks = OFFICIAL_RESULTS_ARTIFACT.completedResults.reduce(
      (total, result) =>
        total +
        (result.homeShootoutGoals ?? 0) +
        (result.awayShootoutGoals ?? 0),
      0,
    );
    expect(shootoutKicks).toBeGreaterThan(0);
    expect(calculatedGoals).toBe(officialMatchGoals);
  });

  it("detects generated seed, bootstrap, and command-bundle drift", () => {
    expect(() =>
      execFileSync(
        "node",
        ["scripts/generate-official-bootstrap.mjs", "--check"],
        {
          cwd: process.cwd(),
          stdio: "pipe",
        },
      ),
    ).not.toThrow();
  });

  it("reconstructs the complete snapshot through the reviewed apply boundary", () => {
    const structuralSnapshot: TournamentDataSnapshot = {
      ...OFFICIAL_TOURNAMENT_SNAPSHOT,
      tournament: {
        ...OFFICIAL_TOURNAMENT_SNAPSHOT.tournament!,
        status: "planned",
        currentRoundId: "group",
        referenceDataComplete: false,
        missingOfficialData: ["Fixtures and results await reviewed apply"],
      },
      matches: [],
      groupQualifications: [],
    };
    const proposal = prepareAdministrationUpdate(
      structuralSnapshot,
      reviewedCommandBundle.commands as readonly AdministrationCommand[],
    );

    expect(proposal.errors).toEqual([]);
    expect(proposal.safeToApply).toBe(true);
    expect(proposal.proposedSnapshot).not.toBeNull();
    expect(proposal.proposedSnapshot?.tournament).toEqual(
      OFFICIAL_TOURNAMENT_SNAPSHOT.tournament,
    );
    expect(proposal.proposedSnapshot?.matches).toEqual(
      OFFICIAL_TOURNAMENT_SNAPSHOT.matches,
    );
    expect(proposal.proposedSnapshot?.groupQualifications).toEqual(
      OFFICIAL_TOURNAMENT_SNAPSHOT.groupQualifications,
    );
  });

  it("validates the environment-only reviewed bootstrap runner", () => {
    expect(() =>
      execFileSync(
        "node",
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          "scripts/apply-official-reviewed-bootstrap.ts",
          "--validate-only",
        ],
        { cwd: process.cwd(), stdio: "pipe" },
      ),
    ).not.toThrow();
  });
});
