import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

export const ADMINISTRATION_REVIEW_COOKIE_NAME = "admin-result-review";
export const MAXIMUM_ADMINISTRATION_REVIEW_COOKIE_BYTES = 3_072;

export class AdministrationReviewCookieError extends Error {
  constructor() {
    super("The administration review is too large for safe cookie storage.");
    this.name = "AdministrationReviewCookieError";
  }
}

const COOKIE_ENCRYPTION_VERSION = "v1";
const COOKIE_ENCRYPTION_CONTEXT = "administration-result-review-cookie/v1";

export function encryptAdministrationReviewCookie(
  serializedReview: string,
  authenticatedUserId: string,
  signingSecret: string,
): string {
  const key = reviewCookieEncryptionKey(signingSecret);
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, initializationVector);
  cipher.setAAD(reviewCookieAdditionalData(authenticatedUserId));
  const ciphertext = Buffer.concat([
    cipher.update(serializedReview, "utf8"),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();
  return [
    COOKIE_ENCRYPTION_VERSION,
    initializationVector.toString("base64url"),
    ciphertext.toString("base64url"),
    authenticationTag.toString("base64url"),
  ].join(".");
}

export function decryptAdministrationReviewCookie(
  encryptedReview: string,
  authenticatedUserId: string,
  signingSecret: string,
): string {
  try {
    const [
      version,
      initializationVector,
      ciphertext,
      authenticationTag,
      extra,
    ] = encryptedReview.split(".");
    if (
      version !== COOKIE_ENCRYPTION_VERSION ||
      extra !== undefined ||
      !/^[A-Za-z0-9_-]{16}$/.test(initializationVector ?? "") ||
      !/^[A-Za-z0-9_-]+$/.test(ciphertext ?? "") ||
      !/^[A-Za-z0-9_-]{22}$/.test(authenticationTag ?? "")
    ) {
      throw new Error("Malformed encrypted review.");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      reviewCookieEncryptionKey(signingSecret),
      Buffer.from(initializationVector!, "base64url"),
    );
    decipher.setAAD(reviewCookieAdditionalData(authenticatedUserId));
    decipher.setAuthTag(Buffer.from(authenticationTag!, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext!, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AdministrationReviewCookieError();
  }
}

export function administrationReviewCookieOptions(expiresAt: string) {
  const expires = new Date(expiresAt);
  if (!Number.isFinite(expires.getTime())) {
    throw new AdministrationReviewCookieError();
  }
  return {
    expires,
    httpOnly: true,
    path: "/admin",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * The encrypted envelope is client-held in an HttpOnly cookie and sent back
 * with admin requests. Measure the production Set-Cookie representation,
 * including URI encoding and attributes, before asking the framework to store
 * it.
 */
export function administrationReviewSetCookieByteLength(
  encryptedReview: string,
  expiresAt: string,
): number {
  const options = administrationReviewCookieOptions(expiresAt);
  let encodedValue: string;
  try {
    encodedValue = encodeURIComponent(encryptedReview);
  } catch {
    throw new AdministrationReviewCookieError();
  }
  const productionHeader =
    `${ADMINISTRATION_REVIEW_COOKIE_NAME}=${encodedValue}` +
    `; Path=${options.path}` +
    `; Expires=${options.expires.toUTCString()}` +
    "; Secure; HttpOnly; SameSite=Lax";
  return Buffer.byteLength(productionHeader, "utf8");
}

export function assertAdministrationReviewCookieFits(
  encryptedReview: string,
  expiresAt: string,
): void {
  if (
    administrationReviewSetCookieByteLength(encryptedReview, expiresAt) >
    MAXIMUM_ADMINISTRATION_REVIEW_COOKIE_BYTES
  ) {
    throw new AdministrationReviewCookieError();
  }
}

function reviewCookieEncryptionKey(signingSecret: string): Buffer {
  if (Buffer.byteLength(signingSecret, "utf8") < 32) {
    throw new AdministrationReviewCookieError();
  }
  return createHmac("sha256", signingSecret)
    .update(COOKIE_ENCRYPTION_CONTEXT, "utf8")
    .digest();
}

function reviewCookieAdditionalData(authenticatedUserId: string): Buffer {
  if (
    authenticatedUserId.trim() === "" ||
    Buffer.byteLength(authenticatedUserId, "utf8") > 512
  ) {
    throw new AdministrationReviewCookieError();
  }
  return Buffer.from(
    `${COOKIE_ENCRYPTION_CONTEXT}\0${authenticatedUserId}`,
    "utf8",
  );
}
