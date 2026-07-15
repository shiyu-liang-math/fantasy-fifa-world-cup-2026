import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  AdministrationRepositoryError,
  SupabaseAdministrationRepository,
  type AdministrationRpcClient,
} from "./supabase-administration-repository";
import { REFERENCE_SNAPSHOT } from "../data/reference/snapshot";
import { snapshotPayload } from "./supabase-snapshot-test-fixture";

const rpc = vi.fn();
const repository = () =>
  new SupabaseAdministrationRepository({ rpc } as AdministrationRpcClient);

describe("SupabaseAdministrationRepository", () => {
  beforeEach(() => rpc.mockReset());

  it("strictly maps an authenticated administration context", async () => {
    rpc.mockResolvedValue({
      data: {
        tournament_id: "fifa-world-cup-2026",
        revision: "3",
        snapshot: snapshotPayload(REFERENCE_SNAPSHOT),
      },
      error: null,
    });
    const result = await repository().getContext("fifa-world-cup-2026");
    expect(result.revision).toBe("3");
    expect(result.snapshot.tournament?.id).toBe("fifa-world-cup-2026");
    expect(rpc).toHaveBeenCalledWith("read_administration_context", {
      p_tournament_id: "fifa-world-cup-2026",
    });
  });

  it.each([
    ["P7401", "unauthorized"],
    ["P7403", "forbidden"],
    ["P7S01", "stale"],
    ["P7I01", "idempotency_conflict"],
    ["P7V01", "validation"],
    ["42501", "internal"],
  ])(
    "maps database code %s without leaking SQL details",
    async (code, kind) => {
      rpc.mockResolvedValue({
        data: null,
        error: { code, message: "private.audit_log secret detail" },
      });
      await expect(
        repository().getContext("fifa-world-cup-2026"),
      ).rejects.toMatchObject({
        kind,
      });
      await expect(
        repository().getContext("fifa-world-cup-2026"),
      ).rejects.not.toThrow("private.audit_log");
    },
  );

  it.each(["applied", "already_applied"] as const)(
    "maps a structured %s result",
    async (status) => {
      rpc.mockResolvedValue({
        data: {
          status,
          tournament_id: "fifa-world-cup-2026",
          revision: "4",
          change_set_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        },
        error: null,
      });
      await expect(
        repository().apply({
          tournamentId: "fifa-world-cup-2026",
          expectedRevision: "3",
          changeSetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          commands: [],
          reviewFingerprint: "x".repeat(43),
        }),
      ).resolves.toEqual({
        status,
        tournamentId: "fifa-world-cup-2026",
        revision: "4",
        changeSetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      });
      expect(rpc).toHaveBeenCalledWith("apply_administration_change", {
        p_tournament_id: "fifa-world-cup-2026",
        p_expected_revision: "3",
        p_change_set_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        p_commands: [],
        p_review_fingerprint: "x".repeat(43),
      });
    },
  );

  it("rejects malformed success payloads", async () => {
    rpc.mockResolvedValue({ data: { status: "applied" }, error: null });
    await expect(
      repository().apply({
        tournamentId: "fifa-world-cup-2026",
        expectedRevision: "0",
        changeSetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        commands: [],
        reviewFingerprint: "x".repeat(43),
      }),
    ).rejects.toBeInstanceOf(AdministrationRepositoryError);
  });

  it.each([3, 3.5, Number.MAX_SAFE_INTEGER + 1, -1, "+3", "03", "", "1.0"])(
    "rejects noncanonical revision %j",
    async (revision) => {
      rpc.mockResolvedValue({
        data: {
          tournament_id: "fifa-world-cup-2026",
          revision,
          snapshot: snapshotPayload(REFERENCE_SNAPSHOT),
        },
        error: null,
      });
      await expect(
        repository().getContext("fifa-world-cup-2026"),
      ).rejects.toBeInstanceOf(AdministrationRepositoryError);
    },
  );
});
