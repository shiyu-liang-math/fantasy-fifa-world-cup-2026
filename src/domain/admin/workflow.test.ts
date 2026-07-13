import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "../../data/development/scenario";
import type { TournamentDataSnapshot } from "../../data/types";
import { LocalTournamentRepository } from "../../repositories/local-tournament-repository";
import { getAwardsPageModel } from "../../services/page-models/awards";
import { getBracketPageModel } from "../../services/page-models/bracket";
import { getDashboardPageModel } from "../../services/page-models/dashboard";
import { getGroupsPageModel } from "../../services/page-models/groups";
import { getHomePageModel } from "../../services/page-models/home";
import { getParticipantDetailPageModel } from "../../services/page-models/participant-detail";
import { getRulesPageModel } from "../../services/page-models/rules";
import { getTournamentOverviewPageModel } from "../../services/page-models/tournament";
import {
  applyAdministrationProposal,
  prepareAdministrationUpdate,
} from "./workflow";
import type { AdministrationCommand } from "./types";

const snapshot = (): TournamentDataSnapshot =>
  structuredClone(FICTIONAL_DEVELOPMENT_SNAPSHOT);

describe("reviewed administration workflow", () => {
  it("prepares and applies a fixture without mutating the input", () => {
    const original = snapshot();
    const before = structuredClone(original);
    const proposal = prepareAdministrationUpdate(original, {
      type: "upsert_fixture",
      fixture: {
        id: "admin-group-fixture",
        roundId: "group",
        matchNumber: 1100,
        scheduledAt: "2026-06-20T18:00:00.000Z",
        homeCountryId: "france",
        awayCountryId: "portugal",
      },
    });

    expect(original).toEqual(before);
    expect(proposal).toMatchObject({
      validation: "valid",
      safeToApply: true,
      errors: [],
      affected: {
        matchIds: ["admin-group-fixture", "dev-qf-unresolved"],
        standingsChanged: false,
      },
    });
    expect(original.matches).not.toContainEqual(
      expect.objectContaining({ id: "admin-group-fixture" }),
    );

    const applied = applyAdministrationProposal(original, proposal);
    expect(applied.status).toBe("applied");
    if (applied.status === "applied") {
      expect(applied.snapshot.matches).toContainEqual(
        expect.objectContaining({
          id: "admin-group-fixture",
          status: "scheduled",
        }),
      );
    }
  });

  it("records a group result and recomputes standings and public totals", async () => {
    const prepared = prepareAdministrationUpdate(snapshot(), [
      fixture("admin-group-result", 1101, "france", "portugal"),
      {
        type: "record_result",
        result: { matchId: "admin-group-result", homeGoals: 4, awayGoals: 0 },
      },
    ]);
    const applied = applyAdministrationProposal(snapshot(), prepared);
    expect(applied.status).toBe("applied");
    if (applied.status !== "applied") return;

    const repository = new LocalTournamentRepository(applied.snapshot);
    const groups = await getGroupsPageModel(repository);
    const dashboard = await getDashboardPageModel(repository);
    expect(groups.status).toBe("incomplete");
    expect(dashboard.status).toBe("incomplete");
    if (groups.status === "incomplete" && dashboard.status === "incomplete") {
      expect(
        groups.data.groups
          .find(({ code }) => code === "A")
          ?.countries.find(({ countryId }) => countryId === "france")?.standing,
      ).toMatchObject({ played: 2, wins: 2, goalsFor: 6, points: 6 });
      expect(
        dashboard.data.participants
          .find(({ participantId }) => participantId === "lyla")
          ?.countries.find(({ countryId }) => countryId === "france")?.goals,
      ).toBe(11);
    }
  });

  it("supports knockout shootouts and cascades advancement", () => {
    const original = snapshot();
    const proposal = prepareAdministrationUpdate(original, {
      type: "record_result",
      result: {
        matchId: "dev-r32-scheduled",
        homeGoals: 2,
        awayGoals: 2,
        wentToExtraTime: true,
        homeShootoutGoals: 3,
        awayShootoutGoals: 5,
        advancingCountryId: "japan",
      },
    });
    const applied = applyAdministrationProposal(original, proposal);
    expect(applied.status).toBe("applied");
    if (applied.status === "applied") {
      expect(
        applied.snapshot.matches.find(({ id }) => id === "dev-qf-unresolved"),
      ).toMatchObject({ homeCountryId: "brazil", awayCountryId: "japan" });
    }
  });

  it("requires explicit reviewed replacement for completed results", () => {
    const rejected = prepareAdministrationUpdate(snapshot(), {
      type: "record_result",
      result: { matchId: "dev-group-win", homeGoals: 0, awayGoals: 1 },
    });
    expect(rejected.errors.map(({ code }) => code)).toContain(
      "result_requires_replacement",
    );
    expect(rejected.proposedSnapshot).toBeNull();

    const replacement = prepareAdministrationUpdate(snapshot(), {
      type: "replace_result",
      reason: "Official correction",
      result: { matchId: "dev-group-win", homeGoals: 0, awayGoals: 1 },
    });
    expect(replacement.safeToApply).toBe(true);
    expect(replacement.warnings.map(({ code }) => code)).toContain(
      "replacing_completed_result",
    );
  });

  it("rejects stale proposals", () => {
    const original = snapshot();
    const proposal = prepareAdministrationUpdate(
      original,
      fixture("stale-fixture", 1102, "france", "portugal"),
    );
    const changed = {
      ...original,
      tournament: {
        ...original.tournament!,
        lastUpdatedAt: "2026-07-20T00:00:00.000Z",
      },
    };
    expect(applyAdministrationProposal(changed, proposal)).toMatchObject({
      status: "rejected",
      code: "stale_proposal",
    });
  });

  it("validates a batch atomically and exposes no partial snapshot", () => {
    const original = snapshot();
    const proposal = prepareAdministrationUpdate(original, [
      fixture("valid-in-failed-batch", 1103, "france", "portugal"),
      fixture("invalid-in-batch", 1104, "france", "unknown"),
    ]);
    expect(proposal.safeToApply).toBe(false);
    expect(proposal.proposedSnapshot).toBeNull();
    expect(applyAdministrationProposal(original, proposal).status).toBe(
      "rejected",
    );
    expect(
      original.matches.some(({ id }) => id === "valid-in-failed-batch"),
    ).toBe(false);
  });

  it("applies, replaces, and removes group overrides", () => {
    const original = snapshot();
    const first = applyAdministrationProposal(
      original,
      prepareAdministrationUpdate(original, {
        type: "set_group_override",
        override: {
          id: "override-a",
          groupCode: "A",
          orderedCountryIds: ["spain", "france", "portugal", "argentina"],
          reason: "Official disciplinary ruling",
          source: "FIFA",
        },
      }),
    );
    expect(first.status).toBe("applied");
    if (first.status !== "applied") return;

    const replacement = applyAdministrationProposal(
      first.snapshot,
      prepareAdministrationUpdate(first.snapshot, {
        type: "replace_group_override",
        replacedOverrideId: "override-a",
        override: {
          id: "override-b",
          groupCode: "A",
          orderedCountryIds: ["france", "spain", "argentina", "portugal"],
          reason: "Corrected official ruling",
          source: "FIFA",
        },
      }),
    );
    expect(replacement.status).toBe("applied");
    if (replacement.status !== "applied") return;
    expect(
      replacement.snapshot.groupOverrides.map(({ setId }) => setId),
    ).toContain("override-b");

    const removal = applyAdministrationProposal(
      replacement.snapshot,
      prepareAdministrationUpdate(replacement.snapshot, {
        type: "remove_group_override",
        overrideId: "override-b",
      }),
    );
    expect(removal.status).toBe("applied");
    if (removal.status === "applied")
      expect(removal.snapshot.groupOverrides).toEqual([]);
  });

  it.each([
    ["unknown team", fixture("bad-team", 1200, "france", "missing")],
    ["same team", fixture("same-team", 1201, "france", "france")],
    [
      "negative score",
      {
        type: "replace_result",
        reason: "correction",
        result: { matchId: "dev-group-win", homeGoals: -1, awayGoals: 0 },
      },
    ],
    [
      "non-drawn shootout",
      {
        type: "record_result",
        result: {
          matchId: "dev-r32-scheduled",
          homeGoals: 2,
          awayGoals: 1,
          wentToExtraTime: true,
          homeShootoutGoals: 4,
          awayShootoutGoals: 3,
          advancingCountryId: "mexico",
        },
      },
    ],
    [
      "wrong penalty winner",
      {
        type: "record_result",
        result: {
          matchId: "dev-r32-scheduled",
          homeGoals: 1,
          awayGoals: 1,
          wentToExtraTime: true,
          homeShootoutGoals: 3,
          awayShootoutGoals: 4,
          advancingCountryId: "mexico",
        },
      },
    ],
  ] as const)("rejects invalid command: %s", (_label, command) => {
    expect(
      prepareAdministrationUpdate(snapshot(), command as AdministrationCommand)
        .safeToApply,
    ).toBe(false);
  });

  it("preserves baseline public page-model output during review", async () => {
    const original = snapshot();
    const repository = new LocalTournamentRepository(original);
    const before = await Promise.all([
      getDashboardPageModel(repository),
      getGroupsPageModel(repository),
      getAwardsPageModel(repository),
    ]);
    prepareAdministrationUpdate(
      original,
      fixture("review-only", 1202, "france", "portugal"),
    );
    const after = await Promise.all([
      getDashboardPageModel(repository),
      getGroupsPageModel(repository),
      getAwardsPageModel(repository),
    ]);
    expect(after).toEqual(before);
  });

  it("rejects mutated, cloned, and fabricated proposals", () => {
    const original = snapshot();
    const reviewed = prepareAdministrationUpdate(
      original,
      fixture("reviewed-fixture", 1203, "france", "portugal"),
    );
    expect(Object.isFrozen(reviewed)).toBe(true);
    expect(Object.isFrozen(reviewed.commands[0])).toBe(true);
    expect(Object.isFrozen(reviewed.proposedSnapshot)).toBe(true);

    const changedCommands = structuredClone(reviewed);
    (
      changedCommands as unknown as { commands: AdministrationCommand[] }
    ).commands = [fixture("unreviewed-fixture", 1204, "france", "portugal")];
    expect(
      applyAdministrationProposal(original, changedCommands),
    ).toMatchObject({
      status: "rejected",
      code: "proposal_tampered",
    });

    const changedSnapshot = structuredClone(reviewed);
    (
      changedSnapshot.proposedSnapshot as {
        tournament: TournamentDataSnapshot["tournament"];
      }
    ).tournament = {
      ...changedSnapshot.proposedSnapshot!.tournament!,
      status: "completed",
    };
    expect(
      applyAdministrationProposal(original, changedSnapshot),
    ).toMatchObject({
      status: "rejected",
      code: "proposal_tampered",
    });

    const fabricated = structuredClone(reviewed);
    expect(applyAdministrationProposal(original, fabricated)).toMatchObject({
      status: "rejected",
      code: "proposal_tampered",
    });
  });

  it("keeps input, proposal, recomputation, and output deeply unaliased", () => {
    const original = snapshot();
    const reviewed = prepareAdministrationUpdate(
      original,
      fixture("alias-fixture", 1205, "france", "portugal"),
    );
    const applied = applyAdministrationProposal(original, reviewed);
    expect(applied.status).toBe("applied");
    if (applied.status !== "applied" || reviewed.proposedSnapshot === null)
      return;

    (
      applied.snapshot.matches[0] as {
        homeSourceSlot: TournamentDataSnapshot["matches"][number]["homeSourceSlot"];
      }
    ).homeSourceSlot = { sourceMatchId: "changed", outcome: "winner" };
    expect(reviewed.proposedSnapshot.matches[0]!.homeSourceSlot).not.toEqual(
      applied.snapshot.matches[0]!.homeSourceSlot,
    );
    expect(original.matches[0]!.homeSourceSlot).not.toEqual(
      applied.snapshot.matches[0]!.homeSourceSlot,
    );
  });

  it("produces deterministic proposal identities", () => {
    const original = snapshot();
    const command = fixture("deterministic", 1206, "france", "portugal");
    const first = prepareAdministrationUpdate(original, command);
    const second = prepareAdministrationUpdate(original, command);
    expect({
      base: first.baseRevision,
      commands: first.commandsRevision,
      result: first.resultRevision,
      proposal: first.proposalRevision,
    }).toEqual({
      base: second.baseRevision,
      commands: second.commandsRevision,
      result: second.resultRevision,
      proposal: second.proposalRevision,
    });
    expect(applyAdministrationProposal(original, first).status).toBe("applied");
    expect(applyAdministrationProposal(original, second).status).toBe(
      "applied",
    );
  });

  it("rejects non-JSON runtime values before they can affect identity", () => {
    const command = fixture("runtime-date", 1217, "france", "portugal");
    if (command.type !== "upsert_fixture") return;
    const proposal = prepareAdministrationUpdate(snapshot(), {
      ...command,
      fixture: {
        ...command.fixture,
        scheduledAt: new Date("2026-07-24T00:00:00.000Z"),
      },
    } as unknown as AdministrationCommand);
    expect(proposal.safeToApply).toBe(false);
    expect(proposal.errors.map(({ code }) => code)).toContain(
      "unsupported_runtime_value",
    );
    expect(proposal.proposedSnapshot).toBeNull();
  });

  it("keeps process-local proposals independent and reusable after rejection", () => {
    const original = snapshot();
    const proposalA = prepareAdministrationUpdate(
      original,
      fixture("concurrent-a", 1213, "france", "portugal"),
    );
    const proposalB = prepareAdministrationUpdate(
      original,
      fixture("concurrent-b", 1214, "spain", "portugal"),
    );
    const changed = {
      ...original,
      tournament: {
        ...original.tournament!,
        lastUpdatedAt: "2026-07-22T00:00:00.000Z",
      },
    };

    expect(applyAdministrationProposal(changed, proposalA)).toMatchObject({
      status: "rejected",
      code: "stale_proposal",
    });
    const appliedA = applyAdministrationProposal(original, proposalA);
    expect(appliedA.status).toBe("applied");
    expect(applyAdministrationProposal(original, proposalB).status).toBe(
      "applied",
    );
    if (appliedA.status !== "applied") return;
    expect(
      applyAdministrationProposal(appliedA.snapshot, proposalA),
    ).toMatchObject({ status: "rejected", code: "stale_proposal" });
    expect(
      applyAdministrationProposal(appliedA.snapshot, proposalB),
    ).toMatchObject({ status: "rejected", code: "stale_proposal" });
  });

  it("ignores unsuccessful mutation of a frozen nested command", () => {
    const original = snapshot();
    const proposal = prepareAdministrationUpdate(
      original,
      fixture("frozen-command", 1215, "france", "portugal"),
    );
    const fixtureCommand = proposal.commands[0];
    expect(fixtureCommand?.type).toBe("upsert_fixture");
    if (fixtureCommand?.type !== "upsert_fixture") return;
    expect(Reflect.set(fixtureCommand.fixture, "matchNumber", 9999)).toBe(
      false,
    );
    expect(applyAdministrationProposal(original, proposal).status).toBe(
      "applied",
    );
  });

  it("rejects conflicting repeated writes before applying a batch", () => {
    const proposal = prepareAdministrationUpdate(snapshot(), [
      fixture("conflict", 1207, "france", "portugal"),
      fixture("conflict", 1208, "france", "portugal"),
    ]);
    expect(proposal.errors.map(({ code }) => code)).toContain(
      "conflicting_commands",
    );
    expect(proposal.proposedSnapshot).toBeNull();
  });

  it("rejects unknown runtime command types cleanly", () => {
    const proposal = prepareAdministrationUpdate(snapshot(), {
      type: "not-a-command",
    } as never);
    expect(proposal.safeToApply).toBe(false);
    expect(proposal.errors.map(({ code }) => code)).toContain(
      "unknown_command",
    );
  });

  it("rejects cross-group and unassigned group fixtures", () => {
    expect(
      prepareAdministrationUpdate(
        snapshot(),
        fixture("cross-group", 1209, "france", "brazil"),
      ).errors.map(({ code }) => code),
    ).toContain("cross_group_fixture");
    expect(
      prepareAdministrationUpdate(
        snapshot(),
        fixture("unassigned", 1210, "france", "england"),
      ).errors.map(({ code }) => code),
    ).toContain("cross_group_fixture");
  });

  it("rejects existing duplicate and reversed group pairings", () => {
    const base = snapshot();
    const duplicate = {
      ...base,
      matches: [
        ...base.matches,
        groupMatch("duplicate-pair", 1216, "spain", "france", 0, 0),
      ],
    } satisfies TournamentDataSnapshot;
    const proposal = prepareAdministrationUpdate(duplicate, {
      type: "update_tournament_metadata",
      update: { lastUpdatedAt: "2026-07-23T00:00:00.000Z" },
    });
    expect(proposal.errors.map(({ code }) => code)).toContain(
      "duplicate_group_fixture",
    );
  });

  it("does not finalize qualification from partial or zero-result groups", () => {
    const original = snapshot();
    const partial = prepareAdministrationUpdate(
      original,
      fixture("partial-group", 1211, "france", "portugal"),
    );
    expect(
      partial.proposedSnapshot?.groupQualifications.some(
        ({ countryId }) => countryId === "france",
      ),
    ).toBe(false);

    const base = snapshot();
    const zero = {
      ...base,
      matches: base.matches.filter(({ stage }) => stage !== "group"),
      groupQualifications: [],
    } satisfies TournamentDataSnapshot;
    const reviewed = prepareAdministrationUpdate(
      zero,
      fixture("zero-group", 1212, "france", "spain"),
    );
    expect(reviewed.proposedSnapshot?.groupQualifications).toEqual([]);
  });

  it("preserves qualifications during unrelated knockout updates", () => {
    const original = snapshot();
    const proposal = prepareAdministrationUpdate(original, {
      type: "record_result",
      result: {
        matchId: "dev-r32-scheduled",
        homeGoals: 1,
        awayGoals: 0,
        advancingCountryId: "mexico",
      },
    });
    expect(proposal.proposedSnapshot?.groupQualifications).toEqual(
      original.groupQualifications,
    );
    expect(proposal.affected.qualificationsChanged).toBe(false);
  });

  it("finalizes a group only after its last required match", () => {
    const original = groupAlmostCompleteSnapshot();
    const before = prepareAdministrationUpdate(original, {
      type: "update_tournament_metadata",
      update: { lastUpdatedAt: "2026-07-20T00:00:00.000Z" },
    });
    expect(
      before.proposedSnapshot?.groupQualifications.some(
        ({ countryId }) => countryId === "france",
      ),
    ).toBe(true); // Existing authoritative value is preserved by unrelated work.

    const final = prepareAdministrationUpdate(original, {
      type: "record_result",
      result: { matchId: "group-a-final", homeGoals: 1, awayGoals: 0 },
    });
    const groupA = final.proposedSnapshot?.groupQualifications.filter(
      ({ countryId }) =>
        ["france", "spain", "portugal", "argentina"].includes(countryId),
    );
    expect(groupA).toEqual(
      expect.arrayContaining([
        {
          countryId: "france",
          qualifiedForRoundOf32: true,
          source: "calculated",
        },
        {
          countryId: "spain",
          qualifiedForRoundOf32: true,
          source: "calculated",
        },
        {
          countryId: "portugal",
          qualifiedForRoundOf32: false,
          source: "calculated",
        },
      ]),
    );
  });

  it("requires a complete group order and restores unresolved state on removal", () => {
    const original = snapshot();
    const partial = prepareAdministrationUpdate(original, {
      type: "set_group_override",
      override: {
        id: "partial",
        groupCode: "A",
        orderedCountryIds: ["france", "spain"],
        reason: "Official",
        source: "FIFA",
      },
    });
    expect(partial.errors.map(({ code }) => code)).toContain(
      "incomplete_group_override",
    );
    const duplicate = prepareAdministrationUpdate(original, {
      ...completeOverride("duplicate"),
      override: {
        ...completeOverride("duplicate").override,
        orderedCountryIds: ["france", "france", "portugal", "argentina"],
      },
    } as AdministrationCommand);
    expect(duplicate.errors.map(({ code }) => code)).toContain(
      "duplicate_override_country",
    );
    expect(duplicate.errors.map(({ code }) => code)).toContain(
      "missing_override_country",
    );
    const outside = prepareAdministrationUpdate(original, {
      ...completeOverride("outside"),
      override: {
        ...completeOverride("outside").override,
        orderedCountryIds: ["france", "spain", "portugal", "brazil"],
      },
    } as AdministrationCommand);
    expect(outside.errors.map(({ code }) => code)).toContain(
      "override_team_not_in_group",
    );

    const valid = prepareAdministrationUpdate(
      original,
      completeOverride("complete"),
    );
    expect(valid.safeToApply).toBe(true);
    expect(
      valid.proposedSnapshot?.groupQualifications.filter(({ countryId }) =>
        ["france", "spain", "portugal", "argentina"].includes(countryId),
      ),
    ).toEqual(
      expect.arrayContaining([
        { countryId: "spain", qualifiedForRoundOf32: true, source: "override" },
        {
          countryId: "france",
          qualifiedForRoundOf32: true,
          source: "override",
        },
        {
          countryId: "argentina",
          qualifiedForRoundOf32: false,
          source: "override",
        },
      ]),
    );
    const applied = applyAdministrationProposal(original, valid);
    expect(applied.status).toBe("applied");
    if (applied.status !== "applied") return;
    const removed = prepareAdministrationUpdate(applied.snapshot, {
      type: "remove_group_override",
      overrideId: "complete",
    });
    expect(
      removed.proposedSnapshot?.groupQualifications.some(
        ({ countryId }) => countryId === "france",
      ),
    ).toBe(false);
    expect(
      prepareAdministrationUpdate(original, {
        type: "remove_group_override",
        overrideId: "missing",
      }).errors.map(({ code }) => code),
    ).toContain("unknown_group_override");
  });

  it("restores calculated qualification when an override is removed after completion", () => {
    const almostComplete = groupAlmostCompleteSnapshot();
    const completed = applyAdministrationProposal(
      almostComplete,
      prepareAdministrationUpdate(almostComplete, {
        type: "record_result",
        result: { matchId: "group-a-final", homeGoals: 1, awayGoals: 0 },
      }),
    );
    expect(completed.status).toBe("applied");
    if (completed.status !== "applied") return;
    const overridden = applyAdministrationProposal(
      completed.snapshot,
      prepareAdministrationUpdate(
        completed.snapshot,
        completeOverride("final-order"),
      ),
    );
    expect(overridden.status).toBe("applied");
    if (overridden.status !== "applied") return;
    const removed = prepareAdministrationUpdate(overridden.snapshot, {
      type: "remove_group_override",
      overrideId: "final-order",
    });
    expect(removed.safeToApply).toBe(true);
    expect(
      removed.proposedSnapshot?.groupQualifications.find(
        ({ countryId }) => countryId === "france",
      ),
    ).toEqual({
      countryId: "france",
      qualifiedForRoundOf32: true,
      source: "calculated",
    });
  });

  it("keeps a fully played tied group unresolved instead of using country order", () => {
    const original = tiedCompleteGroupSnapshot();
    const proposal = prepareAdministrationUpdate(original, {
      type: "replace_result",
      reason: "Reviewed draw confirmation",
      result: { matchId: "tie-1", homeGoals: 0, awayGoals: 0 },
    });
    expect(proposal.safeToApply).toBe(true);
    expect(
      proposal.proposedSnapshot?.groupQualifications.some(({ countryId }) =>
        ["france", "spain", "portugal", "argentina"].includes(countryId),
      ),
    ).toBe(false);
  });

  it("recomputes unresolved downstream participants after a correction", () => {
    const original = snapshot();
    const proposal = prepareAdministrationUpdate(original, {
      type: "replace_result",
      reason: "Official correction",
      result: {
        matchId: "dev-r32-shootout",
        homeGoals: 0,
        awayGoals: 1,
        advancingCountryId: "germany",
      },
    });
    expect(
      proposal.proposedSnapshot?.matches.find(
        ({ id }) => id === "dev-qf-unresolved",
      ),
    ).toMatchObject({ homeCountryId: "germany", awayCountryId: null });
  });

  it("rejects stale completed downstream results unless replaced atomically", () => {
    const original = knockoutDependencySnapshot();
    const upstreamOnly = prepareAdministrationUpdate(original, {
      type: "replace_result",
      reason: "Semifinal correction",
      result: {
        matchId: "dev-semifinal-one",
        homeGoals: 0,
        awayGoals: 2,
        advancingCountryId: "argentina",
      },
    });
    expect(upstreamOnly.errors.map(({ code }) => code)).toContain(
      "completed_downstream_conflict",
    );

    const atomic = prepareAdministrationUpdate(original, [
      {
        type: "replace_result",
        reason: "Semifinal correction",
        result: {
          matchId: "dev-semifinal-one",
          homeGoals: 0,
          awayGoals: 2,
          advancingCountryId: "argentina",
        },
      },
      {
        type: "replace_result",
        reason: "Final corrected for new participant",
        result: {
          matchId: "dev-final",
          homeGoals: 1,
          awayGoals: 0,
          advancingCountryId: "argentina",
        },
      },
    ]);
    expect(atomic.safeToApply).toBe(true);
    expect(
      atomic.proposedSnapshot?.matches.find(({ id }) => id === "dev-final"),
    ).toMatchObject({
      homeCountryId: "argentina",
      advancingCountryId: "argentina",
    });
  });

  it("propagates semifinal losers into an unresolved third-place match", () => {
    const base = snapshot();
    const original = {
      ...base,
      matches: base.matches.map((match) =>
        match.id === "dev-third-place"
          ? {
              ...match,
              status: "scheduled",
              homeGoals: null,
              awayGoals: null,
              advancingCountryId: null,
              homeSourceSlot: {
                sourceMatchId: "dev-semifinal-one",
                outcome: "loser",
              },
              awaySourceSlot: {
                sourceMatchId: "dev-semifinal-two",
                outcome: "loser",
              },
            }
          : match,
      ),
    } satisfies TournamentDataSnapshot;
    const proposal = prepareAdministrationUpdate(original, {
      type: "replace_result",
      reason: "Semifinal correction",
      result: {
        matchId: "dev-semifinal-one",
        homeGoals: 0,
        awayGoals: 1,
        advancingCountryId: "argentina",
      },
    });
    expect(
      proposal.proposedSnapshot?.matches.find(
        ({ id }) => id === "dev-third-place",
      ),
    ).toMatchObject({ homeCountryId: "france", awayCountryId: "portugal" });
  });

  it("reports affected data from actual state differences", () => {
    const proposal = prepareAdministrationUpdate(snapshot(), {
      type: "replace_result",
      reason: "Official correction",
      result: { matchId: "dev-group-win", homeGoals: 0, awayGoals: 1 },
    });
    expect(proposal.affected).toMatchObject({
      resultsChanged: true,
      standingsChanged: true,
      leaderboardChanged: true,
      goldenGoalChanged: true,
      publicPageModelsChanged: true,
    });
    expect(proposal.summary).toContain("Public leaderboard changed.");
  });

  it("updates tournament metadata only from explicit reviewed values", () => {
    const proposal = prepareAdministrationUpdate(snapshot(), {
      type: "update_tournament_metadata",
      update: {
        lastUpdatedAt: "2026-07-21T00:00:00.000Z",
        status: "active",
        currentRoundId: "round-of-16",
        missingOfficialData: ["Final official match reports"],
      },
    });
    expect(proposal.safeToApply).toBe(true);
    expect(proposal.proposedSnapshot?.tournament).toMatchObject({
      lastUpdatedAt: "2026-07-21T00:00:00.000Z",
      status: "active",
      currentRoundId: "round-of-16",
      missingOfficialData: ["Final official match reports"],
    });
    expect(proposal.affected.tournamentMetadataChanged).toBe(true);
    expect(proposal.summary).toContain("Tournament metadata changed.");
  });

  it("matches fixed complete public page-model baselines", async () => {
    const repository = new LocalTournamentRepository(snapshot());
    const models = {
      home: await getHomePageModel(repository),
      dashboard: await getDashboardPageModel(repository),
      tournament: await getTournamentOverviewPageModel(repository),
      groups: await getGroupsPageModel(repository),
      bracket: await getBracketPageModel(repository),
      awards: await getAwardsPageModel(repository),
      participant: await getParticipantDetailPageModel(repository, "lyla"),
      rules: await getRulesPageModel(repository),
    };
    expect
      .soft(sha256(models.home))
      .toBe("8bb497d9d64c1d2b468e813c8b0119368fb2f84556609518eea0a0c91c3d14de");
    expect
      .soft(sha256(models.dashboard))
      .toBe("82b93abdea3c1f4ffdcbe0b3c26ad91ad36b1f8f38fc027cf452ed945cf11102");
    expect
      .soft(sha256(models.tournament))
      .toBe("9ffebbaab9d535b0801ee4ebba474e0bcb477bd81dd0f42601d285f8bd459faa");
    expect
      .soft(sha256(models.groups))
      .toBe("096a35ea2421f44de031e89fc17164c9e3f14b927f4bd1d56d8a132dc82bbcd9");
    expect
      .soft(sha256(models.bracket))
      .toBe("0b4241c358baeffbcff0e40b6f2f653824295cfbf3e461c29ed698d1aa9da37e");
    expect
      .soft(sha256(models.awards))
      .toBe("ebe6092d29c943dfd1ea10aee5029ab3ca2f1a4608930737f671d3b48851fab5");
    expect
      .soft(sha256(models.participant))
      .toBe("db9b150031dfa5c51b1a425bb24b5b9390185e5cfa1b440bc0c47961ba9b02a4");
    expect
      .soft(sha256(models.rules))
      .toBe("548ade523e3b2d91cfd2b93037b136d6f10c912579f7b2c6c367ede99f55f866");
  });
});

function fixture(
  id: string,
  matchNumber: number,
  homeCountryId: string,
  awayCountryId: string,
): AdministrationCommand {
  return {
    type: "upsert_fixture",
    fixture: {
      id,
      roundId: "group",
      matchNumber,
      scheduledAt: null,
      homeCountryId,
      awayCountryId,
    },
  };
}

function completeOverride(
  id: string,
): Extract<AdministrationCommand, { type: "set_group_override" }> {
  return {
    type: "set_group_override",
    override: {
      id,
      groupCode: "A",
      orderedCountryIds: ["spain", "france", "portugal", "argentina"],
      reason: "Official order",
      source: "FIFA",
    },
  };
}

function groupAlmostCompleteSnapshot(): TournamentDataSnapshot {
  const value = snapshot();
  const additions = [
    groupMatch("group-a-fp", 1300, "france", "portugal", 3, 0),
    groupMatch("group-a-fa", 1301, "france", "argentina", 2, 0),
    groupMatch("group-a-sp", 1302, "spain", "portugal", 2, 0),
    groupMatch("group-a-final", 1303, "spain", "argentina", null, null),
  ];
  return { ...value, matches: [...value.matches, ...additions] };
}

function groupMatch(
  id: string,
  matchNumber: number,
  homeCountryId: string,
  awayCountryId: string,
  homeGoals: number | null,
  awayGoals: number | null,
): TournamentDataSnapshot["matches"][number] {
  return {
    id,
    tournamentId: "fifa-world-cup-2026",
    roundId: "group",
    stage: "group",
    status: homeGoals === null ? "scheduled" : "completed",
    matchNumber,
    scheduledAt: null,
    homeCountryId,
    awayCountryId,
    homeGoals,
    awayGoals,
    wentToExtraTime: false,
    homeShootoutGoals: null,
    awayShootoutGoals: null,
    advancingCountryId: null,
    homeSourceSlot: null,
    awaySourceSlot: null,
    dataClassification: "fictional_development",
  };
}

function knockoutDependencySnapshot(): TournamentDataSnapshot {
  const value = snapshot();
  return {
    ...value,
    matches: value.matches.map((match) =>
      match.id === "dev-final"
        ? {
            ...match,
            homeSourceSlot: {
              sourceMatchId: "dev-semifinal-one",
              outcome: "winner",
            },
            awaySourceSlot: {
              sourceMatchId: "dev-semifinal-two",
              outcome: "winner",
            },
          }
        : match,
    ),
  };
}

function tiedCompleteGroupSnapshot(): TournamentDataSnapshot {
  const value = snapshot();
  const countries = ["france", "spain", "portugal", "argentina"];
  let matchNumber = 1400;
  let id = 1;
  const tiedMatches = countries.flatMap((homeCountryId, index) =>
    countries
      .slice(index + 1)
      .map((awayCountryId) =>
        groupMatch(
          `tie-${id++}`,
          matchNumber++,
          homeCountryId,
          awayCountryId,
          0,
          0,
        ),
      ),
  );
  return {
    ...value,
    matches: [
      ...value.matches.filter(({ stage }) => stage !== "group"),
      ...tiedMatches,
    ],
  };
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
