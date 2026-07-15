import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/repositories/public-tournament-repository", () => ({
  createPublicTournamentRepository: () => ({
    getSnapshot: mocks.getSnapshot,
  }),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import { SupabaseConfigurationError } from "@/config/server-environment";
import { REFERENCE_SNAPSHOT } from "@/data/reference/snapshot";
import {
  InvalidTournamentSnapshotError,
  TournamentRepositoryUnavailableError,
} from "@/repositories/repository-errors";
import TeamPage, { generateMetadata } from "./page";

describe("participant route behavior", () => {
  beforeEach(() => {
    mocks.getSnapshot.mockReset();
    mocks.notFound.mockClear();
  });

  it("generates participant metadata from a valid canonical snapshot", async () => {
    mocks.getSnapshot.mockResolvedValue(REFERENCE_SNAPSHOT);
    await expect(
      generateMetadata({
        params: Promise.resolve({ participantSlug: "lyla" }),
      }),
    ).resolves.toMatchObject({ title: "Lyla" });
  });

  it.each([
    new SupabaseConfigurationError("secret configuration detail"),
    new TournamentRepositoryUnavailableError(),
    new InvalidTournamentSnapshotError(["raw payload detail"]),
  ])("uses safe generic metadata for recoverable failures", async (error) => {
    mocks.getSnapshot.mockRejectedValue(error);
    await expect(
      generateMetadata({
        params: Promise.resolve({ participantSlug: "lyla" }),
      }),
    ).resolves.toEqual({ title: "Team not found" });
  });

  it("uses safe generic metadata when the tournament is missing", async () => {
    mocks.getSnapshot.mockResolvedValue({
      ...REFERENCE_SNAPSHOT,
      tournament: null,
    });
    await expect(
      generateMetadata({
        params: Promise.resolve({ participantSlug: "lyla" }),
      }),
    ).resolves.toEqual({ title: "Team not found" });
  });

  it("calls notFound only for an unknown slug in a valid dataset", async () => {
    mocks.getSnapshot.mockResolvedValue(REFERENCE_SNAPSHOT);
    await expect(
      TeamPage({
        params: Promise.resolve({ participantSlug: "unknown-participant" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("renders a recoverable route state instead of calling notFound", async () => {
    mocks.getSnapshot.mockRejectedValue(
      new TournamentRepositoryUnavailableError(),
    );
    await expect(
      TeamPage({ params: Promise.resolve({ participantSlug: "lyla" }) }),
    ).resolves.toBeTruthy();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
