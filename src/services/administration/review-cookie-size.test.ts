import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FICTIONAL_DEVELOPMENT_SNAPSHOT } from "@/data/development/scenario";
import { OFFICIAL_TOURNAMENT_SNAPSHOT } from "@/data/official/snapshot";
import type { TournamentDataSnapshot } from "@/data/types";
import {
  prepareAdministrationUpdate,
  type AdministrationCommand,
} from "@/domain/admin";
import {
  createAdministrationReviewEnvelope,
  serializeAdministrationReviewEnvelope,
} from "./review-envelope";
import { MAXIMUM_CORRECTION_REASON_BYTES } from "./result-entry-constraints";
import {
  MAXIMUM_ADMINISTRATION_REVIEW_COOKIE_BYTES,
  administrationReviewSetCookieByteLength,
  encryptAdministrationReviewCookie,
} from "./review-cookie";

const SECRET = "0123456789abcdef0123456789abcdef";
const USER_ID = "representative-admin-user";
const CHANGE_SET = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ISSUED_AT = "2026-07-17T12:00:00.000Z";
const EXPIRES_AT = "2026-07-17T12:15:00.000Z";

describe("administration review cookie size boundary", () => {
  it("keeps representative group, knockout, shootout, and correction previews below the safe ceiling", () => {
    const groupSnapshot = scheduledGroupSnapshot();
    const semifinal = OFFICIAL_TOURNAMENT_SNAPSHOT.matches.find(
      ({ id }) => id === "match-102",
    )!;
    const correction = OFFICIAL_TOURNAMENT_SNAPSHOT.matches.find(
      ({ id }) => id === "match-101",
    )!;
    const measurements = [
      cookieBytes(groupSnapshot, {
        type: "record_result",
        result: {
          matchId: "dev-group-win",
          homeGoals: 2,
          awayGoals: 1,
        },
      }),
      cookieBytes(OFFICIAL_TOURNAMENT_SNAPSHOT, {
        type: "record_result",
        result: {
          matchId: semifinal.id,
          homeGoals: 2,
          awayGoals: 1,
          advancingCountryId: semifinal.homeCountryId,
        },
      }),
      cookieBytes(OFFICIAL_TOURNAMENT_SNAPSHOT, {
        type: "record_result",
        result: {
          matchId: semifinal.id,
          homeGoals: 1,
          awayGoals: 1,
          wentToExtraTime: true,
          homeShootoutGoals: 5,
          awayShootoutGoals: 4,
          advancingCountryId: semifinal.homeCountryId,
        },
      }),
      cookieBytes(OFFICIAL_TOURNAMENT_SNAPSHOT, {
        type: "replace_result",
        reason: "Official score correction",
        result: resultFromMatch(correction),
      }),
    ];
    expect(measurements).toHaveLength(4);
    expect(Math.max(...measurements)).toBeLessThan(
      MAXIMUM_ADMINISTRATION_REVIEW_COOKIE_BYTES,
    );
  });

  it("checks every currently completed official fixture at the maximum supported correction-reason size", () => {
    const maximumReason = "R".repeat(MAXIMUM_CORRECTION_REASON_BYTES);
    const measurements = OFFICIAL_TOURNAMENT_SNAPSHOT.matches
      .filter(({ status }) => status === "completed")
      .map((match) =>
        cookieBytes(OFFICIAL_TOURNAMENT_SNAPSHOT, {
          type: "replace_result",
          reason: maximumReason,
          result: resultFromMatch(match),
        }),
      );
    expect(measurements).toHaveLength(101);
    expect(Math.max(...measurements)).toBeLessThan(
      MAXIMUM_ADMINISTRATION_REVIEW_COOKIE_BYTES,
    );
  });
});

function cookieBytes(
  snapshot: TournamentDataSnapshot,
  command: AdministrationCommand,
): number {
  const proposal = prepareAdministrationUpdate(snapshot, command);
  expect(proposal.safeToApply).toBe(true);
  const serialized = serializeAdministrationReviewEnvelope(
    createAdministrationReviewEnvelope({
      tournamentId: "fifa-world-cup-2026",
      databaseRevision: "101",
      changeSetId: CHANGE_SET,
      issuedAt: ISSUED_AT,
      expiresAt: EXPIRES_AT,
      proposal,
      signingSecret: SECRET,
    }),
  );
  return administrationReviewSetCookieByteLength(
    encryptAdministrationReviewCookie(serialized, USER_ID, SECRET),
    EXPIRES_AT,
  );
}

function resultFromMatch(match: TournamentDataSnapshot["matches"][number]) {
  return {
    matchId: match.id,
    homeGoals: match.homeGoals!,
    awayGoals: match.awayGoals!,
    wentToExtraTime: match.wentToExtraTime,
    homeShootoutGoals: match.homeShootoutGoals,
    awayShootoutGoals: match.awayShootoutGoals,
    advancingCountryId: match.advancingCountryId,
  };
}

function scheduledGroupSnapshot(): TournamentDataSnapshot {
  return {
    ...FICTIONAL_DEVELOPMENT_SNAPSHOT,
    matches: FICTIONAL_DEVELOPMENT_SNAPSHOT.matches.map((match) =>
      match.id === "dev-group-win"
        ? {
            ...match,
            status: "scheduled" as const,
            homeGoals: null,
            awayGoals: null,
            wentToExtraTime: false,
            homeShootoutGoals: null,
            awayShootoutGoals: null,
            advancingCountryId: null,
          }
        : match,
    ),
  };
}
