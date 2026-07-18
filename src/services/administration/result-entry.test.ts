import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "@/data/development/scenario";
import { snapshotPayload } from "@/repositories/supabase-snapshot-test-fixture";
import {
  MAXIMUM_REVIEW_LIFETIME_MS,
  parseAdministrationReviewEnvelope,
} from "./review-envelope";
import {
  applyResultReview,
  parseResultEntry,
  prepareResultReview,
  ResultEntryValidationError,
  type ResultEntryFields,
} from "./result-entry";
import { MAXIMUM_CORRECTION_REASON_BYTES } from "./result-entry-constraints";

const SECRET = "0123456789abcdef0123456789abcdef";
const CHANGE_SET = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function fields(overrides: Partial<ResultEntryFields> = {}): ResultEntryFields {
  return {
    matchId: "dev-r32-scheduled",
    homeGoals: "2",
    awayGoals: "1",
    wentToExtraTime: false,
    homeShootoutGoals: "",
    awayShootoutGoals: "",
    advancingCountryId: "mexico",
    correctionReason: "",
    ...overrides,
  };
}

function client(snapshot = FICTIONAL_DEVELOPMENT_SNAPSHOT) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "admin-user" } },
        error: null,
      }),
    },
    rpc: vi.fn().mockResolvedValue({
      data: {
        tournament_id: "fifa-world-cup-2026",
        revision: "7",
        snapshot: snapshotPayload(snapshot),
      },
      error: null,
    }),
  };
}

describe("result-entry form parsing", () => {
  it.each([
    ["", "1"],
    ["-1", "1"],
    ["1.5", "1"],
    ["x", "1"],
    ["9007199254740992", "1"],
  ])(
    "rejects missing, negative, fractional, malformed, or unsafe scores",
    (homeGoals, awayGoals) => {
      expect(() => parseResultEntry(fields({ homeGoals, awayGoals }))).toThrow(
        ResultEntryValidationError,
      );
    },
  );

  it("strictly parses nonnegative scores and an optional shootout pair", () => {
    expect(
      parseResultEntry(
        fields({
          homeGoals: " 0 ",
          awayGoals: "2",
          homeShootoutGoals: "4",
          awayShootoutGoals: "3",
          wentToExtraTime: true,
        }),
      ),
    ).toMatchObject({
      homeGoals: 0,
      awayGoals: 2,
      homeShootoutGoals: 4,
      awayShootoutGoals: 3,
      wentToExtraTime: true,
    });
  });

  it("requires both shootout values together", () => {
    expect(() => parseResultEntry(fields({ homeShootoutGoals: "4" }))).toThrow(
      ResultEntryValidationError,
    );
  });
});

describe("reviewed result preparation", () => {
  it("derives record_result from fresh scheduled state and uses the existing TTL", async () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const review = await prepareResultReview({
      client: client(),
      tournamentId: "fifa-world-cup-2026",
      fields: fields(),
      signingSecret: SECRET,
      now,
      changeSetId: CHANGE_SET,
    });
    const envelope = parseAdministrationReviewEnvelope(review.serializedReview);
    expect(review.commandType).toBe("record_result");
    expect(envelope.commands[0]?.type).toBe("record_result");
    expect(Date.parse(envelope.expiresAt) - now.getTime()).toBe(
      MAXIMUM_REVIEW_LIFETIME_MS,
    );
    expect(review.before.status).toBe("scheduled");
    expect(review.after.status).toBe("completed");
  });

  it("derives replace_result from fresh completed state and requires a reason", async () => {
    await expect(
      prepareResultReview({
        client: client(),
        tournamentId: "fifa-world-cup-2026",
        fields: fields({
          matchId: "dev-group-win",
          advancingCountryId: "",
        }),
        signingSecret: SECRET,
      }),
    ).rejects.toMatchObject({
      fieldErrors: { correctionReason: expect.any(String) },
    });

    const review = await prepareResultReview({
      client: client(),
      tournamentId: "fifa-world-cup-2026",
      fields: fields({
        matchId: "dev-group-win",
        advancingCountryId: "",
        correctionReason: "Official score correction",
      }),
      signingSecret: SECRET,
    });
    const envelope = parseAdministrationReviewEnvelope(review.serializedReview);
    expect(review.commandType).toBe("replace_result");
    expect(envelope.commands[0]).toMatchObject({
      type: "replace_result",
      reason: "Official score correction",
    });
  });

  it("bounds correction reasons by UTF-8 bytes before creating a review", async () => {
    await expect(
      prepareResultReview({
        client: client(),
        tournamentId: "fifa-world-cup-2026",
        fields: fields({
          matchId: "dev-group-win",
          advancingCountryId: "",
          correctionReason: "x".repeat(MAXIMUM_CORRECTION_REASON_BYTES + 1),
        }),
        signingSecret: SECRET,
      }),
    ).rejects.toMatchObject({
      fieldErrors: { correctionReason: expect.stringContaining("500") },
    });
  });

  it("allows a group draw without advancement", async () => {
    const review = await prepareResultReview({
      client: client(),
      tournamentId: "fifa-world-cup-2026",
      fields: fields({
        matchId: "dev-group-draw",
        homeGoals: "1",
        awayGoals: "1",
        advancingCountryId: "",
        correctionReason: "Confirmed official draw",
      }),
      signingSecret: SECRET,
    });
    expect(review.after.advancingCountryId).toBeNull();
  });

  it.each([
    [
      "group shootout",
      fields({
        matchId: "dev-group-draw",
        homeShootoutGoals: "4",
        awayShootoutGoals: "3",
        advancingCountryId: "",
        correctionReason: "Invalid group shootout",
      }),
    ],
    [
      "knockout draw without shootout",
      fields({ homeGoals: "1", awayGoals: "1" }),
    ],
    ["wrong advancing country", fields({ advancingCountryId: "france" })],
    [
      "shootout loser marked advancing",
      fields({
        homeGoals: "1",
        awayGoals: "1",
        homeShootoutGoals: "3",
        awayShootoutGoals: "4",
        advancingCountryId: "mexico",
        wentToExtraTime: true,
      }),
    ],
  ])("rejects invalid %s semantics", async (_label, invalidFields) => {
    await expect(
      prepareResultReview({
        client: client(),
        tournamentId: "fifa-world-cup-2026",
        fields: invalidFields,
        signingSecret: SECRET,
      }),
    ).rejects.toBeInstanceOf(ResultEntryValidationError);
  });

  it("accepts an extra-time shootout and its winner", async () => {
    const review = await prepareResultReview({
      client: client(),
      tournamentId: "fifa-world-cup-2026",
      fields: fields({
        homeGoals: "1",
        awayGoals: "1",
        homeShootoutGoals: "4",
        awayShootoutGoals: "3",
        advancingCountryId: "mexico",
        wentToExtraTime: true,
      }),
      signingSecret: SECRET,
    });
    expect(review.after).toMatchObject({
      wentToExtraTime: true,
      homeShootoutGoals: 4,
      awayShootoutGoals: 3,
      advancingCountryId: "mexico",
    });
  });

  it("fails closed before any apply when a correction conflicts with completed downstream results", async () => {
    const downstreamCompletedSnapshot = {
      ...FICTIONAL_DEVELOPMENT_SNAPSHOT,
      matches: FICTIONAL_DEVELOPMENT_SNAPSHOT.matches.map((match) =>
        match.id === "dev-final"
          ? {
              ...match,
              homeSourceSlot: {
                sourceMatchId: "dev-semifinal-one",
                outcome: "winner" as const,
              },
              awaySourceSlot: {
                sourceMatchId: "dev-semifinal-two",
                outcome: "winner" as const,
              },
            }
          : match,
      ),
    };
    const administrationClient = client(downstreamCompletedSnapshot);
    await expect(
      prepareResultReview({
        client: administrationClient,
        tournamentId: "fifa-world-cup-2026",
        fields: fields({
          matchId: "dev-semifinal-one",
          homeGoals: "0",
          awayGoals: "1",
          advancingCountryId: "argentina",
          correctionReason: "Correct the semifinal winner",
        }),
        signingSecret: SECRET,
      }),
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.any(String)]),
    });
    expect(administrationClient.rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a wrong-tournament review before any administration RPC", async () => {
    const review = await prepareResultReview({
      client: client(),
      tournamentId: "fifa-world-cup-2026",
      fields: fields(),
      signingSecret: SECRET,
    });
    const switched = JSON.parse(review.serializedReview) as Record<
      string,
      unknown
    >;
    switched.tournamentId = "another-tournament";
    const applyClient = client();
    await expect(
      applyResultReview({
        client: applyClient,
        tournamentId: "fifa-world-cup-2026",
        serializedReview: JSON.stringify(switched),
      }),
    ).rejects.toMatchObject({ code: "review_mismatch" });
    expect(applyClient.rpc).not.toHaveBeenCalled();
  });
});
