import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { REFERENCE_SNAPSHOT } from "../data/reference/snapshot";
import { TournamentRepositoryUnavailableError } from "./repository-errors";
import { snapshotPayload } from "./supabase-snapshot-test-fixture";
import {
  loadSupabaseTournamentSnapshot,
  SupabaseTournamentRepository,
} from "./supabase-tournament-repository";

describe("SupabaseTournamentRepository", () => {
  it("uses one RPC request with the canonical identifier", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: snapshotPayload(REFERENCE_SNAPSHOT),
      error: null,
    });
    const snapshot = await loadSupabaseTournamentSnapshot(
      { rpc },
      "fifa-world-cup-2026",
    );
    expect(snapshot.tournament).toEqual(REFERENCE_SNAPSHOT.tournament);
    expect(snapshot.participants).toEqual(REFERENCE_SNAPSHOT.participants);
    expect(snapshot.matches).toEqual([]);
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("read_tournament_snapshot", {
      p_tournament_id: "fifa-world-cup-2026",
    });
  });

  it("deduplicates concurrent loads while returning independent snapshots", async () => {
    const loader = vi.fn().mockResolvedValue(REFERENCE_SNAPSHOT);
    const repository = new SupabaseTournamentRepository(loader);
    const [first, second] = await Promise.all([
      repository.getSnapshot(),
      repository.getSnapshot(),
    ]);
    expect(loader).toHaveBeenCalledOnce();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.participants).not.toBe(second.participants);
  });

  it("does not retain failed loads", async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new TournamentRepositoryUnavailableError())
      .mockResolvedValueOnce(REFERENCE_SNAPSHOT);
    const repository = new SupabaseTournamentRepository(loader);
    await expect(repository.getSnapshot()).rejects.toBeInstanceOf(
      TournamentRepositoryUnavailableError,
    );
    await expect(repository.getSnapshot()).resolves.toEqual(REFERENCE_SNAPSHOT);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("converts thrown and returned Supabase failures without exposing details", async () => {
    await expect(
      loadSupabaseTournamentSnapshot(
        {
          rpc: vi.fn().mockRejectedValue(new Error("secret transport detail")),
        },
        "fifa-world-cup-2026",
      ),
    ).rejects.toEqual(new TournamentRepositoryUnavailableError());
    await expect(
      loadSupabaseTournamentSnapshot(
        {
          rpc: vi
            .fn()
            .mockResolvedValue({ data: null, error: { message: "raw SQL" } }),
        },
        "fifa-world-cup-2026",
      ),
    ).rejects.toEqual(new TournamentRepositoryUnavailableError());
  });

  it("rejects a valid graph for a different tournament", async () => {
    await expect(
      loadSupabaseTournamentSnapshot(
        {
          rpc: vi.fn().mockResolvedValue({
            data: snapshotPayload(REFERENCE_SNAPSHOT),
            error: null,
          }),
        },
        "different-tournament",
      ),
    ).rejects.toMatchObject({
      issues: ["The snapshot returned a different tournament than requested."],
    });
  });
});
