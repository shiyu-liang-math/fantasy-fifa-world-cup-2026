import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../config/server-environment-runtime", () => ({
  readAdministrationPreviewEnvironment: () => ({
    signingSecret: "0123456789abcdef0123456789abcdef",
  }),
}));

import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "../../data/development/scenario";
import { prepareAdministrationUpdate } from "../../domain/admin/workflow";
import { snapshotPayload } from "../../repositories/supabase-snapshot-test-fixture";
import { mapSupabaseSnapshot } from "../../repositories/supabase-snapshot-mapper";
import type { AdministrationRpcClient } from "../../repositories/supabase-administration-repository";
import { applyReviewedAdministrationChange } from "./apply-reviewed-change";
import { createAdministrationReviewEnvelope } from "./review-envelope";

const SECRET = "0123456789abcdef0123456789abcdef";
const TOURNAMENT = "fifa-world-cup-2026";
const CHANGE_SET = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SNAPSHOT = mapSupabaseSnapshot(
  snapshotPayload(FICTIONAL_DEVELOPMENT_SNAPSHOT),
);

function review() {
  const proposal = prepareAdministrationUpdate(SNAPSHOT, {
    type: "upsert_fixture",
    fixture: {
      id: "coordinator-fixture",
      roundId: "group",
      matchNumber: 1998,
      scheduledAt: "2026-07-20T18:00:00.000Z",
      homeCountryId: "france",
      awayCountryId: "portugal",
    },
  });
  return createAdministrationReviewEnvelope({
    tournamentId: TOURNAMENT,
    databaseRevision: "7",
    changeSetId: CHANGE_SET,
    issuedAt: "2026-07-14T12:00:00.000Z",
    expiresAt: "2026-07-14T12:15:00.000Z",
    proposal,
    signingSecret: SECRET,
  });
}

describe("applyReviewedAdministrationChange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:05:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("loads, verifies, and applies only signed recomputed values", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          tournament_id: TOURNAMENT,
          revision: "7",
          snapshot: snapshotPayload(SNAPSHOT),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          status: "applied",
          tournament_id: TOURNAMENT,
          revision: "8",
          change_set_id: CHANGE_SET,
        },
        error: null,
      });

    await expect(
      applyReviewedAdministrationChange(
        { rpc } as AdministrationRpcClient,
        review(),
      ),
    ).resolves.toMatchObject({ status: "applied", revision: "8" });
    expect(rpc).toHaveBeenNthCalledWith(1, "read_administration_context", {
      p_tournament_id: TOURNAMENT,
    });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "apply_administration_change",
      expect.objectContaining({
        p_tournament_id: TOURNAMENT,
        p_expected_revision: "7",
        p_change_set_id: CHANGE_SET,
        p_review_fingerprint: review().signature,
      }),
    );
  });

  it("rejects stale context before applying", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        tournament_id: TOURNAMENT,
        revision: "8",
        snapshot: snapshotPayload(SNAPSHOT),
      },
      error: null,
    });
    await expect(
      applyReviewedAdministrationChange(
        { rpc } as AdministrationRpcClient,
        review(),
      ),
    ).rejects.toMatchObject({ code: "stale_review" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects a switched context even when the revision matches", async () => {
    const base = structuredClone(FICTIONAL_DEVELOPMENT_SNAPSHOT);
    const switched = {
      ...base,
      tournament: { ...base.tournament!, id: "other-tournament" },
    };
    const rpc = vi.fn().mockResolvedValue({
      data: {
        tournament_id: TOURNAMENT,
        revision: "7",
        snapshot: snapshotPayload(switched),
      },
      error: null,
    });
    await expect(
      applyReviewedAdministrationChange(
        { rpc } as AdministrationRpcClient,
        review(),
      ),
    ).rejects.toMatchObject({ kind: "internal" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
