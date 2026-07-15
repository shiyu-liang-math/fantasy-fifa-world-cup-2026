import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));

import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "../../data/development/scenario";
import { prepareAdministrationUpdate } from "../../domain/admin/workflow";
import {
  AdministrationReviewError,
  canonicalSerialize,
  createAdministrationReviewEnvelope,
  parseAdministrationReviewEnvelope,
  serializeAdministrationReviewEnvelope,
  verifyAdministrationReview,
  verifyAdministrationReviewSignature,
} from "./review-envelope";

const SECRET = "0123456789abcdef0123456789abcdef";
const ISSUED = "2026-07-14T12:00:00.000Z";
const EXPIRES = "2026-07-14T12:15:00.000Z";
const CHANGE_SET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function proposal() {
  return prepareAdministrationUpdate(FICTIONAL_DEVELOPMENT_SNAPSHOT, {
    type: "upsert_fixture",
    fixture: {
      id: "review-envelope-fixture",
      roundId: "group",
      matchNumber: 1999,
      scheduledAt: "2026-07-20T18:00:00.000Z",
      homeCountryId: "france",
      awayCountryId: "portugal",
    },
  });
}

function envelope() {
  return createAdministrationReviewEnvelope({
    tournamentId: "fifa-world-cup-2026",
    databaseRevision: 7,
    changeSetId: CHANGE_SET_ID,
    issuedAt: ISSUED,
    expiresAt: EXPIRES,
    proposal: proposal(),
    signingSecret: SECRET,
  });
}

function mutableEnvelope(): Record<string, unknown> {
  return JSON.parse(
    serializeAdministrationReviewEnvelope(envelope()),
  ) as Record<string, unknown>;
}

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error("Expected administration review rejection.");
  } catch (error) {
    expect(error).toBeInstanceOf(AdministrationReviewError);
    expect((error as AdministrationReviewError).code).toBe(code);
  }
}

describe("administration review envelope", () => {
  it("uses stable canonical serialization independent of object key order", () => {
    expect(canonicalSerialize({ z: 1, a: { d: 2, c: 3 } })).toBe(
      '{"a":{"c":3,"d":2},"z":1}',
    );
    expect(serializeAdministrationReviewEnvelope(envelope())).toBe(
      serializeAdministrationReviewEnvelope(envelope()),
    );
  });

  it("uses deterministic JavaScript code-unit ordering for Unicode keys", () => {
    expect(canonicalSerialize({ ä: 1, z: 2, Z: 3, "😀": 4 })).toBe(
      '{"Z":3,"z":2,"ä":1,"😀":4}',
    );
    expect(canonicalSerialize({ ä: 1, z: 2, Z: 3, "😀": 4 })).toBe(
      canonicalSerialize({ "😀": 4, Z: 3, ä: 1, z: 2 }),
    );
  });

  it("produces a stable HMAC with a fixed secret", () => {
    expect(envelope().signature).toBe(
      "EbQntjBzB0mIn6oqogeY3mtg4mJgD0KwN0Be0EPUI6c",
    );
  });

  it.each([
    ["summary", ["tampered"]],
    ["baseRevision", "8"],
    ["changeSetId", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    ["expiresAt", "2026-07-14T12:30:00.000Z"],
  ])("rejects tampering with %s", (field, value) => {
    const changed = mutableEnvelope();
    changed[field] = value;
    expectCode(
      () =>
        verifyAdministrationReviewSignature(
          changed,
          SECRET,
          new Date("2026-07-14T12:05:00.000Z"),
        ),
      "invalid_review_signature",
    );
  });

  it("rejects command tampering", () => {
    const changed = mutableEnvelope();
    const commands = changed.commands as Array<Record<string, unknown>>;
    const fixture = commands[0]!.fixture as Record<string, unknown>;
    fixture.matchNumber = 2000;
    expectCode(
      () =>
        verifyAdministrationReviewSignature(
          changed,
          SECRET,
          new Date("2026-07-14T12:05:00.000Z"),
        ),
      "invalid_review_signature",
    );
  });

  it.each(["invalid", "abc", "A".repeat(42)])(
    "rejects an invalid or truncated signature",
    (signature) => {
      const changed = mutableEnvelope();
      changed.signature = signature;
      expectCode(
        () => parseAdministrationReviewEnvelope(changed),
        "invalid_review",
      );
    },
  );

  it.each([`${"A".repeat(43)}=`, "A".repeat(44), `${"A".repeat(42)}+`])(
    "rejects padded, oversized, or invalid-character signatures",
    (signature) => {
      const changed = mutableEnvelope();
      changed.signature = signature;
      expectCode(
        () => parseAdministrationReviewEnvelope(changed),
        "invalid_review",
      );
    },
  );

  it("rejects a noncanonical base64url spelling of the same digest", () => {
    const changed = mutableEnvelope();
    const signature = changed.signature as string;
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const index = alphabet.indexOf(signature.at(-1)!);
    const replacement = alphabet[(index & ~3) + ((index + 1) & 3)]!;
    changed.signature = `${signature.slice(0, -1)}${replacement}`;
    expect(Buffer.from(changed.signature as string, "base64url")).toEqual(
      Buffer.from(signature, "base64url"),
    );
    expectCode(
      () => parseAdministrationReviewEnvelope(changed),
      "invalid_review",
    );
  });

  it("rejects a well-formed but incorrect signature", () => {
    expectCode(
      () =>
        verifyAdministrationReviewSignature(
          envelope(),
          "fedcba9876543210fedcba9876543210",
          new Date("2026-07-14T12:05:00.000Z"),
        ),
      "invalid_review_signature",
    );
  });

  it("rejects unsupported versions", () => {
    const changed = mutableEnvelope();
    changed.schema = "administration-review/v2";
    expectCode(
      () => parseAdministrationReviewEnvelope(changed),
      "unsupported_review_version",
    );
  });

  it("rejects expired previews", () => {
    expectCode(
      () =>
        verifyAdministrationReviewSignature(
          envelope(),
          SECRET,
          new Date(EXPIRES),
        ),
      "expired_review",
    );
  });

  it("rejects an excessive signed lifetime and a future issue time", () => {
    expect(() =>
      createAdministrationReviewEnvelope({
        tournamentId: "fifa-world-cup-2026",
        databaseRevision: 7,
        changeSetId: CHANGE_SET_ID,
        issuedAt: ISSUED,
        expiresAt: "2026-07-14T12:15:00.001Z",
        proposal: proposal(),
        signingSecret: SECRET,
      }),
    ).toThrow("15 minutes");

    const excessive = mutableEnvelope();
    excessive.expiresAt = "2026-07-14T12:15:00.001Z";
    const unsigned: Record<string, unknown> = { ...excessive };
    delete unsigned.signature;
    excessive.signature = createHmac("sha256", SECRET)
      .update(canonicalSerialize(unsigned), "utf8")
      .digest("base64url");
    expectCode(
      () =>
        verifyAdministrationReviewSignature(
          excessive,
          SECRET,
          new Date("2026-07-14T12:05:00.000Z"),
        ),
      "invalid_review",
    );

    const future = createAdministrationReviewEnvelope({
      tournamentId: "fifa-world-cup-2026",
      databaseRevision: 7,
      changeSetId: CHANGE_SET_ID,
      issuedAt: "2026-07-14T12:02:00.000Z",
      expiresAt: "2026-07-14T12:10:00.000Z",
      proposal: proposal(),
      signingSecret: SECRET,
    });
    expectCode(
      () =>
        verifyAdministrationReviewSignature(
          future,
          SECRET,
          new Date("2026-07-14T12:00:00.000Z"),
        ),
      "invalid_review",
    );
  });

  it("rejects persistence-managed lastUpdatedAt in a command", () => {
    const changed = mutableEnvelope();
    changed.commands = [
      {
        type: "update_tournament_metadata",
        update: { lastUpdatedAt: ISSUED },
      },
    ];
    expectCode(
      () => parseAdministrationReviewEnvelope(changed),
      "invalid_review",
    );
  });

  it.each([
    {
      type: "record_result",
      result: { matchId: "m", homeGoals: 1, awayGoals: 0 },
    },
    {
      type: "replace_result",
      reason: "Correction",
      result: { matchId: "m", homeGoals: 0, awayGoals: 1 },
    },
    {
      type: "set_knockout_participants",
      matchId: "m",
      homeCountryId: "france",
      awayCountryId: null,
    },
    {
      type: "set_group_override",
      override: {
        id: "o",
        groupCode: "A",
        orderedCountryIds: ["a", "b", "c", "d"],
        reason: "Official",
        source: "FIFA",
      },
    },
    {
      type: "replace_group_override",
      replacedOverrideId: "old",
      override: {
        id: "new",
        groupCode: "B",
        orderedCountryIds: ["a", "b", "c", "d"],
        reason: "Correction",
        source: "FIFA",
      },
    },
    { type: "remove_group_override", overrideId: "old" },
    { type: "update_tournament_metadata", update: { status: "active" } },
  ])("strictly parses command variant $type", (command) => {
    const changed = mutableEnvelope();
    changed.commands = [command];
    expect(parseAdministrationReviewEnvelope(changed).commands).toEqual([
      command,
    ]);
  });

  it("verifies after cross-instance JSON serialization", () => {
    const serialized = serializeAdministrationReviewEnvelope(envelope());
    const verified = verifyAdministrationReview({
      serialized,
      signingSecret: SECRET,
      now: new Date("2026-07-14T12:05:00.000Z"),
      currentSnapshot: structuredClone(FICTIONAL_DEVELOPMENT_SNAPSHOT),
      currentDatabaseRevision: "7",
    });
    expect(verified.envelope.changeSetId).toBe(CHANGE_SET_ID);
    expect(verified.recomputedProposal.safeToApply).toBe(true);
  });

  it("ignores database-managed time but rejects a business-state mismatch", () => {
    const current = {
      ...structuredClone(FICTIONAL_DEVELOPMENT_SNAPSHOT),
      tournament: {
        ...FICTIONAL_DEVELOPMENT_SNAPSHOT.tournament!,
        lastUpdatedAt: "2026-07-14T12:01:00.000Z",
      },
    };
    expect(
      verifyAdministrationReview({
        serialized: envelope(),
        signingSecret: SECRET,
        now: new Date("2026-07-14T12:05:00.000Z"),
        currentSnapshot: current,
        currentDatabaseRevision: 7,
      }).recomputedProposal.resultRevision,
    ).toBe(proposal().resultRevision);
    current.tournament.status =
      current.tournament.status === "active" ? "planned" : "active";
    expectCode(
      () =>
        verifyAdministrationReview({
          serialized: envelope(),
          signingSecret: SECRET,
          now: new Date("2026-07-14T12:05:00.000Z"),
          currentSnapshot: current,
          currentDatabaseRevision: 7,
        }),
      "review_mismatch",
    );
  });

  it("rejects a current snapshot from another tournament", () => {
    const base = structuredClone(FICTIONAL_DEVELOPMENT_SNAPSHOT);
    const current = {
      ...base,
      tournament: { ...base.tournament!, id: "another-tournament" },
    };
    expectCode(
      () =>
        verifyAdministrationReview({
          serialized: envelope(),
          signingSecret: SECRET,
          now: new Date("2026-07-14T12:05:00.000Z"),
          currentSnapshot: current,
          currentDatabaseRevision: 7,
        }),
      "review_mismatch",
    );
  });

  it("rejects stale canonical database state before recomputation", () => {
    expectCode(
      () =>
        verifyAdministrationReview({
          serialized: envelope(),
          signingSecret: SECRET,
          now: new Date("2026-07-14T12:05:00.000Z"),
          currentSnapshot: FICTIONAL_DEVELOPMENT_SNAPSHOT,
          currentDatabaseRevision: 8,
        }),
      "stale_review",
    );
  });
});
