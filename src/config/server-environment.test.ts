import { describe, expect, it } from "vitest";
import {
  parseAdministrationPreviewEnvironment,
  parseSupabaseServerEnvironment,
  SupabaseConfigurationError,
} from "./server-environment";

describe("parseAdministrationPreviewEnvironment", () => {
  it("accepts at least 32 bytes of server-only signing material", () => {
    expect(
      parseAdministrationPreviewEnvironment({
        ADMIN_PREVIEW_SIGNING_SECRET: "0123456789abcdef0123456789abcdef",
      }),
    ).toEqual({ signingSecret: "0123456789abcdef0123456789abcdef" });
  });

  it("rejects missing and short secrets without exposing their contents", () => {
    for (const value of [undefined, "too-short"]) {
      expect(() =>
        parseAdministrationPreviewEnvironment({
          ADMIN_PREVIEW_SIGNING_SECRET: value,
        }),
      ).toThrow("at least 32 bytes");
    }
  });

  it("counts UTF-8 bytes and ignores browser-prefixed values", () => {
    expect(
      parseAdministrationPreviewEnvironment({
        ADMIN_PREVIEW_SIGNING_SECRET: "🔐".repeat(8),
      }).signingSecret,
    ).toBe("🔐".repeat(8));
    expect(() =>
      parseAdministrationPreviewEnvironment({
        NEXT_PUBLIC_ADMIN_PREVIEW_SIGNING_SECRET: "x".repeat(64),
      }),
    ).toThrow("ADMIN_PREVIEW_SIGNING_SECRET");
  });
});

describe("parseSupabaseServerEnvironment", () => {
  it("validates and normalizes server-only public read configuration", () => {
    expect(
      parseSupabaseServerEnvironment({
        SUPABASE_URL: "http://127.0.0.1:54321/",
        SUPABASE_ANON_KEY: anonymousJwt(),
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      anonymousKey: anonymousJwt(),
    });
  });

  it.each([
    [{}, "SUPABASE_URL"],
    [
      {
        SUPABASE_URL: "not-a-url",
        SUPABASE_ANON_KEY: anonymousJwt(),
      },
      "valid URL",
    ],
    [
      {
        SUPABASE_URL: "file:///tmp/db",
        SUPABASE_ANON_KEY: anonymousJwt(),
      },
      "HTTP or HTTPS",
    ],
    [
      { SUPABASE_URL: "http://localhost:54321", SUPABASE_ANON_KEY: "short" },
      "SUPABASE_ANON_KEY",
    ],
  ])(
    "rejects malformed configuration without exposing key contents",
    (environment, expected) => {
      expect(() => parseSupabaseServerEnvironment(environment)).toThrowError(
        SupabaseConfigurationError,
      );
      expect(() => parseSupabaseServerEnvironment(environment)).toThrow(
        expected,
      );
    },
  );

  it("does not recognize browser-prefixed configuration", () => {
    expect(() =>
      parseSupabaseServerEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      }),
    ).toThrow("SUPABASE_URL");
  });

  it("accepts publishable keys and rejects elevated or secret key forms", () => {
    expect(
      parseSupabaseServerEnvironment({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "sb_publishable_abcdefghijklmnopqrstuvwxyz",
      }).anonymousKey,
    ).toBe("sb_publishable_abcdefghijklmnopqrstuvwxyz");
    for (const key of [
      roleJwt("service_role"),
      "sb_secret_abcdefghijklmnopqrstuvwxyz",
      "an-arbitrary-long-string-that-is-not-a-key",
    ]) {
      expect(() =>
        parseSupabaseServerEnvironment({
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: key,
        }),
      ).toThrow("SUPABASE_ANON_KEY");
    }
  });
});

function anonymousJwt(): string {
  return roleJwt("anon");
}

function roleJwt(role: string): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.test-signature`;
}
