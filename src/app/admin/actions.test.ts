import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  prepareResultReview: vi.fn(),
  applyResultReview: vi.fn(),
  createClient: vi.fn(),
  cookieGet: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  parseReview: vi.fn(),
  encryptReview: vi.fn(),
  decryptReview: vi.fn(),
  validateAdmin: vi.fn(),
}));

const REVIEW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }));
vi.mock("@/repositories/public-tournament-repository", () => ({
  TOURNAMENT_CACHE_TAG: "tournament:fifa-world-cup-2026",
}));
vi.mock("@/config/server-environment-runtime", () => ({
  readAdministrationPreviewEnvironment: () => ({
    signingSecret: "s".repeat(32),
  }),
}));
vi.mock("@/lib/supabase/auth-server", () => ({
  createAuthenticatedServerSupabaseClient: mocks.createClient,
}));
vi.mock("@/services/administration/admin-access", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/administration/admin-access")
    >();
  return {
    ...actual,
    validateAuthenticatedAdministrator: mocks.validateAdmin,
  };
});
vi.mock("@/services/administration/review-envelope", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/administration/review-envelope")
    >();
  return { ...actual, parseAdministrationReviewEnvelope: mocks.parseReview };
});
vi.mock("@/services/administration/review-cookie", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/administration/review-cookie")
    >();
  return {
    ...actual,
    encryptAdministrationReviewCookie: mocks.encryptReview,
    decryptAdministrationReviewCookie: mocks.decryptReview,
  };
});
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mocks.cookieGet,
    set: mocks.cookieSet,
    delete: mocks.cookieDelete,
  }),
}));
vi.mock("@/services/administration/result-entry", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/administration/result-entry")
    >();
  return {
    ...actual,
    prepareResultReview: mocks.prepareResultReview,
    applyResultReview: mocks.applyResultReview,
  };
});

import { applyResultAction, previewResultAction } from "./actions";

describe("administrator result actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({ auth: {}, rpc: vi.fn() });
    mocks.cookieGet.mockReturnValue({ value: "encrypted-review" });
    mocks.encryptReview.mockReturnValue("encrypted-review");
    mocks.decryptReview.mockReturnValue("signed-review");
    mocks.validateAdmin.mockResolvedValue("admin-user");
    mocks.parseReview.mockReturnValue({ changeSetId: REVIEW_ID });
  });

  it("prepares a signed review from server-parsed form fields", async () => {
    mocks.prepareResultReview.mockResolvedValue({
      serializedReview: "signed",
      reviewId: REVIEW_ID,
      expiresAt: "2026-07-17T12:15:00.000Z",
    });
    const form = new FormData();
    form.set("matchId", "match-104");
    form.set("homeGoals", "2");
    form.set("awayGoals", "1");
    form.set("wentToExtraTime", "on");
    form.set("advancingCountryId", "spain");
    const state = await previewResultAction({ status: "idle" }, form);
    expect(state.status).toBe("ready");
    expect(mocks.prepareResultReview).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: "fifa-world-cup-2026",
        signingSecret: "s".repeat(32),
        fields: expect.objectContaining({
          matchId: "match-104",
          homeGoals: "2",
          awayGoals: "1",
          wentToExtraTime: true,
        }),
      }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "admin-result-review",
      "encrypted-review",
      expect.objectContaining({ httpOnly: true, path: "/admin" }),
    );
    expect(mocks.encryptReview).toHaveBeenCalledWith(
      "signed",
      "admin-user",
      "s".repeat(32),
    );
  });

  it.each(["applied", "already_applied"] as const)(
    "invalidates the tournament cache after confirmed %s",
    async (status) => {
      mocks.applyResultReview.mockResolvedValue({ status, revision: "9" });
      const form = new FormData();
      form.set("reviewId", REVIEW_ID);
      const state = await applyResultAction({ status: "idle" }, form);
      expect(state).toMatchObject({ status: "success", revision: "9" });
      expect(mocks.applyResultReview).toHaveBeenCalledWith(
        expect.objectContaining({
          tournamentId: "fifa-world-cup-2026",
          serializedReview: "signed-review",
        }),
      );
      expect(mocks.updateTag).toHaveBeenCalledOnce();
      expect(mocks.cookieDelete).toHaveBeenCalledWith("admin-result-review");
    },
  );

  it.each([
    new Error("network"),
    Object.assign(new Error("stale"), { kind: "stale" }),
  ])(
    "never invalidates after an unconfirmed or rejected apply",
    async (error) => {
      mocks.applyResultReview.mockRejectedValue(error);
      const form = new FormData();
      form.set("reviewId", REVIEW_ID);
      const state = await applyResultAction({ status: "idle" }, form);
      expect(state.status).toBe("error");
      expect(mocks.updateTag).not.toHaveBeenCalled();
    },
  );

  it("rejects an apply without a serialized signed review", async () => {
    const state = await applyResultAction({ status: "idle" }, new FormData());
    expect(state).toMatchObject({ status: "error", discardReview: true });
    expect(mocks.applyResultReview).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("retains the exact review for an uncertain outcome so idempotent retry is possible", async () => {
    mocks.applyResultReview.mockRejectedValue(new Error("response lost"));
    const form = new FormData();
    form.set("reviewId", REVIEW_ID);
    const state = await applyResultAction({ status: "idle" }, form);
    expect(state).toMatchObject({ status: "error", discardReview: false });
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("keeps the newer tab review when an older tab submits a superseded id", async () => {
    mocks.parseReview.mockReturnValue({
      changeSetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    const form = new FormData();
    form.set("reviewId", REVIEW_ID);
    const state = await applyResultAction({ status: "idle" }, form);
    expect(state).toMatchObject({
      status: "error",
      discardReview: true,
      message: expect.stringContaining("newer preview"),
    });
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.applyResultReview).not.toHaveBeenCalled();
  });

  it("deletes a malformed encrypted review before apply", async () => {
    mocks.decryptReview.mockImplementation(() => {
      throw new Error("tampered");
    });
    const form = new FormData();
    form.set("reviewId", REVIEW_ID);
    const state = await applyResultAction({ status: "idle" }, form);
    expect(state).toMatchObject({ status: "error", discardReview: true });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("admin-result-review");
    expect(mocks.applyResultReview).not.toHaveBeenCalled();
  });

  it("fails preview before setting a cookie when the encrypted review is oversized", async () => {
    mocks.prepareResultReview.mockResolvedValue({
      serializedReview: "signed",
      reviewId: REVIEW_ID,
      expiresAt: "2026-07-17T12:15:00.000Z",
    });
    mocks.encryptReview.mockReturnValue("x".repeat(3_000));
    const form = new FormData();
    form.set("matchId", "match-104");
    const state = await previewResultAction({ status: "idle" }, form);
    expect(state).toMatchObject({
      status: "error",
      message: expect.stringContaining("too large"),
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
