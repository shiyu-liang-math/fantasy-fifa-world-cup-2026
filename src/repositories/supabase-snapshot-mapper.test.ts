import { describe, expect, it } from "vitest";
import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "../data/development/scenario";
import { REFERENCE_SNAPSHOT } from "../data/reference/snapshot";
import { InvalidTournamentSnapshotError } from "./repository-errors";
import { mapSupabaseSnapshot } from "./supabase-snapshot-mapper";
import { snapshotPayload } from "./supabase-snapshot-test-fixture";

describe("mapSupabaseSnapshot", () => {
  it("hydrates the approved stable reference snapshot exactly", () => {
    expect(mapSupabaseSnapshot(snapshotPayload(REFERENCE_SNAPSHOT))).toEqual(
      normalizedReference(),
    );
  });

  it("normalizes row ordering deterministically", () => {
    const payload = snapshotPayload(REFERENCE_SNAPSHOT);
    payload.participants.reverse();
    payload.countries.reverse();
    payload.rounds.reverse();
    payload.groups.reverse();
    payload.draft_picks.reverse();
    expect(mapSupabaseSnapshot(payload)).toEqual(normalizedReference());
  });

  it("hydrates matches, source slots, overrides, and derived qualification", () => {
    const mapped = mapSupabaseSnapshot(
      snapshotPayload(FICTIONAL_DEVELOPMENT_SNAPSHOT),
    );
    expect(mapped.matches).toEqual(FICTIONAL_DEVELOPMENT_SNAPSHOT.matches);
    expect(mapped.groups).toEqual(FICTIONAL_DEVELOPMENT_SNAPSHOT.groups);
    expect(mapped.groupOverrides).toEqual(
      FICTIONAL_DEVELOPMENT_SNAPSHOT.groupOverrides,
    );
  });

  it("rejects unsupported literals and missing classifications", () => {
    const unsupported = snapshotPayload(FICTIONAL_DEVELOPMENT_SNAPSHOT);
    unsupported.matches[0]!.status = "unknown" as never;
    expect(() => mapSupabaseSnapshot(unsupported)).toThrow(
      InvalidTournamentSnapshotError,
    );

    const missing = snapshotPayload(
      FICTIONAL_DEVELOPMENT_SNAPSHOT,
    ) as unknown as {
      matches: Array<Record<string, unknown>>;
    };
    delete missing.matches[0]!.data_classification;
    expectInvalidIssue(missing, "data_classification");
  });

  it("rejects duplicates, dangling references, and contradictions", () => {
    const duplicate = snapshotPayload(REFERENCE_SNAPSHOT);
    const duplicateRows = duplicate as unknown as {
      participants: Array<Record<string, unknown>>;
    };
    duplicateRows.participants.push({ ...duplicateRows.participants[0]! });
    expectInvalidIssue(duplicate, "Duplicate participant id");

    const dangling = snapshotPayload(REFERENCE_SNAPSHOT);
    dangling.draft_picks[0]!.participant_id = "missing";
    expectInvalidIssue(dangling, "missing participant");

    const contradiction = snapshotPayload(FICTIONAL_DEVELOPMENT_SNAPSHOT);
    contradiction.matches[0]!.stage = "final";
    expectInvalidIssue(contradiction, "contradicts its round");
  });

  it("rejects source-slot, group-membership, and round-phase contradictions", () => {
    const resolvedSource = snapshotPayload(
      FICTIONAL_DEVELOPMENT_SNAPSHOT,
    ) as unknown as {
      matches: Array<Record<string, unknown>>;
      match_source_slots: Array<Record<string, unknown>>;
    };
    const sourceRow = resolvedSource.match_source_slots.find(
      ({ match_id, slot }) =>
        match_id === "dev-qf-unresolved" && slot === "home",
    )!;
    const targetMatch = resolvedSource.matches.find(
      ({ id }) => id === sourceRow.match_id,
    )!;
    targetMatch.home_country_id = "spain";
    expectInvalidIssue(resolvedSource, "contradicts its resolved source slot");

    const groupMismatch = snapshotPayload(
      FICTIONAL_DEVELOPMENT_SNAPSHOT,
    ) as unknown as { matches: Array<Record<string, unknown>> };
    const groupMatch = groupMismatch.matches.find(
      ({ stage }) => stage === "group",
    )!;
    groupMatch.away_country_id = "germany";
    expectInvalidIssue(groupMismatch, "contradict group membership");

    const phaseMismatch = snapshotPayload(REFERENCE_SNAPSHOT) as unknown as {
      rounds: Array<Record<string, unknown>>;
    };
    phaseMismatch.rounds[0]!.phase = "knockout";
    expectInvalidIssue(phaseMismatch, "phase contradicts its stage");
  });

  it("returns an alias-safe explicit missing-tournament snapshot", () => {
    const missing = snapshotPayload({
      ...REFERENCE_SNAPSHOT,
      tournament: null,
    });
    const first = mapSupabaseSnapshot(missing);
    const second = mapSupabaseSnapshot(missing);
    expect(first.tournament).toBeNull();
    expect(first).not.toBe(second);
  });
});

function normalizedReference() {
  return {
    ...REFERENCE_SNAPSHOT,
    countries: [...REFERENCE_SNAPSHOT.countries].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    draftPicks: [...REFERENCE_SNAPSHOT.draftPicks].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
}

function expectInvalidIssue(payload: unknown, expected: string): void {
  try {
    mapSupabaseSnapshot(payload);
    throw new Error("Expected mapping to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidTournamentSnapshotError);
    expect(
      (error as InvalidTournamentSnapshotError).issues.join(" "),
    ).toContain(expected);
  }
}
