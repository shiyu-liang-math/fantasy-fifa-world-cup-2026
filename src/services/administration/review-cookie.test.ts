import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  ADMINISTRATION_REVIEW_COOKIE_NAME,
  AdministrationReviewCookieError,
  MAXIMUM_ADMINISTRATION_REVIEW_COOKIE_BYTES,
  administrationReviewCookieOptions,
  administrationReviewSetCookieByteLength,
  assertAdministrationReviewCookieFits,
  decryptAdministrationReviewCookie,
  encryptAdministrationReviewCookie,
} from "./review-cookie";

const SECRET = "0123456789abcdef0123456789abcdef";
const USER_ID = "authenticated-admin-user";
const EXPIRES_AT = "2026-07-17T12:15:00.000Z";

describe("administration review cookie", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses one fixed, short-lived HttpOnly admin cookie without a Domain", () => {
    expect(ADMINISTRATION_REVIEW_COOKIE_NAME).toBe("admin-result-review");
    const options = administrationReviewCookieOptions(EXPIRES_AT);
    expect(options).toMatchObject({
      expires: new Date(EXPIRES_AT),
      httpOnly: true,
      path: "/admin",
      sameSite: "lax",
    });
    expect(options).not.toHaveProperty("domain");
  });

  it("uses Secure in production while preserving local HTTP development", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(administrationReviewCookieOptions(EXPIRES_AT).secure).toBe(true);
    vi.stubEnv("NODE_ENV", "development");
    expect(administrationReviewCookieOptions(EXPIRES_AT).secure).toBe(false);
  });

  it("encrypts the signed envelope and binds it to the authenticated user", () => {
    const serialized = JSON.stringify({ signed: "review", secret: false });
    const encrypted = encryptAdministrationReviewCookie(
      serialized,
      USER_ID,
      SECRET,
    );
    expect(encrypted).not.toContain(serialized);
    expect(encrypted).not.toContain("signed");
    expect(decryptAdministrationReviewCookie(encrypted, USER_ID, SECRET)).toBe(
      serialized,
    );
    expect(() =>
      decryptAdministrationReviewCookie(encrypted, "another-user", SECRET),
    ).toThrow(AdministrationReviewCookieError);
  });

  it("rejects malformed, tampered, and weak-key encrypted values", () => {
    const encrypted = encryptAdministrationReviewCookie(
      "signed-review",
      USER_ID,
      SECRET,
    );
    expect(() =>
      decryptAdministrationReviewCookie(`${encrypted}x`, USER_ID, SECRET),
    ).toThrow(AdministrationReviewCookieError);
    expect(() =>
      encryptAdministrationReviewCookie("signed-review", USER_ID, "short"),
    ).toThrow(AdministrationReviewCookieError);
  });

  it("measures encoded value, cookie name, and production attributes", () => {
    const encrypted = encryptAdministrationReviewCookie(
      "x".repeat(1_500),
      USER_ID,
      SECRET,
    );
    const bytes = administrationReviewSetCookieByteLength(
      encrypted,
      EXPIRES_AT,
    );
    expect(bytes).toBeGreaterThan(Buffer.byteLength(encrypted, "utf8"));
    expect(bytes).toBeLessThan(MAXIMUM_ADMINISTRATION_REVIEW_COOKIE_BYTES);
    expect(() =>
      assertAdministrationReviewCookieFits(encrypted, EXPIRES_AT),
    ).not.toThrow();
  });

  it("fails safely before storage when the production cookie would be oversized", () => {
    expect(() =>
      assertAdministrationReviewCookieFits("x".repeat(3_000), EXPIRES_AT),
    ).toThrow(AdministrationReviewCookieError);
  });
});
