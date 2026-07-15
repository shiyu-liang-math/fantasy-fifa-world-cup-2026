import { describe, expect, it } from "vitest";

import {
  REFERENCE_RULES,
  REFERENCE_TOURNAMENT,
} from "../../data/reference/tournament";
import { REFERENCE_ROUNDS } from "../../data/reference/rounds";
import type {
  Country,
  GroupCode,
  TournamentDataSnapshot,
  TournamentGroup,
} from "../../data/types";
import {
  createReferenceTournamentRepository,
  LocalTournamentRepository,
} from "../../repositories/local-tournament-repository";
import { createFictionalDevelopmentRepository } from "../../repositories/development-tournament-repository";
import { getAwardsPageModel } from "./awards";
import { getBracketPageModel } from "./bracket";
import { getDashboardPageModel } from "./dashboard";
import { getGroupsPageModel } from "./groups";
import { getHomePageModel } from "./home";
import { getParticipantDetailPageModel } from "./participant-detail";
import { getRulesPageModel } from "./rules";
import { getTournamentOverviewPageModel } from "./tournament";
import type { PageModelResult } from "./types";
import { SupabaseConfigurationError } from "../../config/server-environment";
import {
  InvalidTournamentSnapshotError,
  TournamentRepositoryUnavailableError,
} from "../../repositories/repository-errors";

function dataOf<T>(result: PageModelResult<T>): T {
  if (
    result.status === "ready" ||
    result.status === "empty" ||
    result.status === "incomplete"
  ) {
    return result.data;
  }
  throw new Error(`Expected page data, received ${result.status}.`);
}

describe("page-model services", () => {
  it("derives deterministic dashboard totals and ranks from fictional data", async () => {
    const repository = createFictionalDevelopmentRepository();
    const first = await getDashboardPageModel(repository);
    const second = await getDashboardPageModel(repository);
    const dashboard = dataOf(first);

    expect(first.status).toBe("incomplete");
    if (first.status === "incomplete") {
      expect(first.missing).toContain(
        "This entire match scenario is fictional development data",
      );
    }
    expect(second).toEqual(first);
    expect(
      dashboard.participants.map(
        ({ participantId, stars, starRank, goals, goalRank }) => ({
          participantId,
          stars,
          starRank,
          goals,
          goalRank,
        }),
      ),
    ).toEqual([
      { participantId: "lyla", stars: 20, starRank: 1, goals: 8, goalRank: 1 },
      { participantId: "shiyu", stars: 15, starRank: 3, goals: 4, goalRank: 2 },
      {
        participantId: "ivy",
        stars: 2 + 3 * (6 - Math.log2(3)),
        starRank: 2,
        goals: 4,
        goalRank: 2,
      },
      { participantId: "xun", stars: 14, starRank: 4, goals: 2, goalRank: 4 },
      {
        participantId: "houji-yujin",
        stars: 0,
        starRank: 5,
        goals: 0,
        goalRank: 5,
      },
    ]);
  });

  it("builds landing and tournament overview contracts", async () => {
    const repository = createFictionalDevelopmentRepository();
    const home = dataOf(await getHomePageModel(repository));
    const tournament = dataOf(await getTournamentOverviewPageModel(repository));

    expect(home.goldenStarLeaders).toEqual([
      { participantId: "lyla", name: "Lyla", stars: 20 },
    ]);
    expect(home.goldenCup).toMatchObject({
      status: "resolved",
      winnerParticipantId: "lyla",
    });
    expect(tournament).toMatchObject({
      tournamentName: "2026 FIFA World Cup",
      representedCountryCount: 25,
      expectedCountryCount: 48,
      referenceDataComplete: false,
    });
  });

  it("excludes shootout kicks from a drafted country's goals", async () => {
    const dashboard = dataOf(
      await getDashboardPageModel(createFictionalDevelopmentRepository()),
    );
    const brazil = dashboard.participants
      .find(({ participantId }) => participantId === "lyla")
      ?.countries.find(({ countryId }) => countryId === "brazil");

    expect(brazil?.goals).toBe(1);
  });

  it("models unresolved and resolved Golden Cup states", async () => {
    const unresolved = dataOf(
      await getAwardsPageModel(createReferenceTournamentRepository()),
    );
    const resolved = dataOf(
      await getAwardsPageModel(createFictionalDevelopmentRepository()),
    );

    expect(unresolved.goldenCup.status).toBe("unresolved");
    expect(unresolved.goldenCup.winnerParticipantId).toBeNull();
    expect(resolved.goldenCup).toMatchObject({
      status: "resolved",
      winnerParticipantId: "lyla",
      winnerCountryId: "france",
    });
    expect(resolved.goldenStar.map(({ rank }) => rank)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(resolved.goldenGoal.map(({ rank }) => rank)).toEqual([
      1, 2, 2, 4, 5,
    ]);
  });

  it("builds participant detail with final placement models", async () => {
    const repository = createFictionalDevelopmentRepository();
    const lyla = dataOf(
      await getParticipantDetailPageModel(repository, "lyla"),
    );
    const shiyu = dataOf(
      await getParticipantDetailPageModel(repository, "shiyu"),
    );
    const ivy = dataOf(await getParticipantDetailPageModel(repository, "ivy"));
    const xun = dataOf(await getParticipantDetailPageModel(repository, "xun"));

    expect(
      lyla.countries.find(({ countryId }) => countryId === "france")?.result,
    ).toBe("champion");
    expect(
      shiyu.countries.find(({ countryId }) => countryId === "spain")?.result,
    ).toBe("runner_up");
    expect(
      ivy.countries.find(({ countryId }) => countryId === "portugal")?.result,
    ).toBe("third_place");
    expect(
      xun.countries.find(({ countryId }) => countryId === "argentina")?.result,
    ).toBe("fourth_place");
  });

  it("returns a typed not-found state for an unknown participant slug", async () => {
    expect(
      await getParticipantDetailPageModel(
        createFictionalDevelopmentRepository(),
        "unknown",
      ),
    ).toEqual({
      status: "not_found",
      entity: "participant",
      identifier: "unknown",
    });
  });

  it("builds group rows with owner labels, standings, and qualification", async () => {
    const groups = dataOf(
      await getGroupsPageModel(createFictionalDevelopmentRepository()),
    );
    const groupA = groups.groups.find(({ code }) => code === "A");

    expect(
      groupA?.countries.map(({ countryId, calculatedRank }) => [
        countryId,
        calculatedRank,
      ]),
    ).toEqual([
      ["france", 1],
      ["portugal", 2],
      ["argentina", 2],
      ["spain", 4],
    ]);
    expect(groupA?.countries.every(({ owner }) => owner !== null)).toBe(true);
    expect(
      groupA?.countries.every(
        ({ qualificationStatus }) => qualificationStatus === "qualified",
      ),
    ).toBe(true);
    expect(groupA?.completedMatches).toHaveLength(2);
  });

  it("preserves unresolved bracket source outcomes", async () => {
    const bracket = dataOf(
      await getBracketPageModel(createFictionalDevelopmentRepository()),
    );
    const quarterfinal = bracket.rounds
      .find(({ roundId }) => roundId === "quarterfinal")
      ?.matches.find(({ id }) => id === "dev-qf-unresolved");

    expect(quarterfinal?.homeSlot).toEqual({
      kind: "source",
      sourceMatchId: "dev-r32-shootout",
      outcome: "winner",
    });
    expect(quarterfinal?.awaySlot).toEqual({
      kind: "source",
      sourceMatchId: "dev-r32-scheduled",
      outcome: "winner",
    });
  });

  it("derives the Rules model from metadata and scoring logic", async () => {
    const rules = dataOf(
      await getRulesPageModel(createReferenceTournamentRepository()),
    );

    expect(rules.version).toBe("2026-07-12");
    expect(rules.draftValueExplanation).toContain("multiplies");
    expect(rules.goldenGoal).toEqual({
      includesGroupStage: true,
      shootoutKicksExcluded: true,
      completedMatchesOnly: true,
    });
    expect(
      rules.starStages.find(({ result }) => result === "third_place")
        ?.valueOneStars,
    ).toBe(6 - Math.log2(3));
  });

  it("distinguishes valid empty and incomplete datasets", async () => {
    const empty = await getDashboardPageModel(
      new LocalTournamentRepository(completeEmptySnapshot()),
    );
    const incomplete = await getDashboardPageModel(
      createReferenceTournamentRepository(),
    );

    expect(empty.status).toBe("empty");
    expect(incomplete.status).toBe("incomplete");
  });

  it("distinguishes missing tournament and invalid canonical data", async () => {
    const missingSnapshot = {
      ...completeEmptySnapshot(),
      tournament: null,
    } satisfies TournamentDataSnapshot;
    const invalidSnapshot = {
      ...completeEmptySnapshot(),
      countries: [
        ...completeEmptySnapshot().countries,
        completeEmptySnapshot().countries[0]!,
      ],
    } satisfies TournamentDataSnapshot;

    expect(
      await getDashboardPageModel(
        new LocalTournamentRepository(missingSnapshot),
      ),
    ).toEqual({ status: "missing_tournament" });
    expect(
      (
        await getDashboardPageModel(
          new LocalTournamentRepository(invalidSnapshot),
        )
      ).status,
    ).toBe("invalid");
  });

  it("distinguishes recoverable repository failures and rethrows defects", async () => {
    const repositoryThrowing = (error: Error) => ({
      getSnapshot: async () => {
        throw error;
      },
    });

    await expect(
      getDashboardPageModel(
        repositoryThrowing(new SupabaseConfigurationError("missing")),
      ),
    ).resolves.toEqual({ status: "configuration_error" });
    await expect(
      getDashboardPageModel(
        repositoryThrowing(new TournamentRepositoryUnavailableError()),
      ),
    ).resolves.toEqual({ status: "unavailable" });
    await expect(
      getDashboardPageModel(
        repositoryThrowing(new InvalidTournamentSnapshotError(["bad row"])),
      ),
    ).resolves.toEqual({
      status: "invalid",
      issues: ["The canonical tournament dataset is inconsistent."],
    });
    await expect(
      getDashboardPageModel(repositoryThrowing(new TypeError("defect"))),
    ).rejects.toThrow("defect");
  });
});

function completeEmptySnapshot(): TournamentDataSnapshot {
  const groupCodes = "ABCDEFGHIJKL".split("") as GroupCode[];
  const countries: Country[] = Array.from({ length: 48 }, (_, index) => ({
    id: `country-${index}`,
    name: `Country ${index}`,
    fifaCode: fifaCode(index),
    groupCode: groupCodes[Math.floor(index / 4)]!,
  }));
  const groups: TournamentGroup[] = groupCodes.map((code, index) => ({
    code,
    tournamentId: REFERENCE_TOURNAMENT.id,
    displayOrder: index + 1,
    countryIds: countries.slice(index * 4, index * 4 + 4).map(({ id }) => id),
  }));

  return {
    tournament: {
      ...REFERENCE_TOURNAMENT,
      referenceDataComplete: true,
      missingOfficialData: [],
    },
    participants: [],
    countries,
    draftPicks: [],
    rounds: REFERENCE_ROUNDS,
    groups,
    matches: [],
    groupQualifications: [],
    groupOverrides: [],
    rules: REFERENCE_RULES,
    datasetKind: "official_reference",
  };
}

function fifaCode(index: number): string {
  const first = String.fromCharCode(65 + Math.floor(index / 26));
  const second = String.fromCharCode(65 + (index % 26));
  return `Z${first}${second}`;
}
