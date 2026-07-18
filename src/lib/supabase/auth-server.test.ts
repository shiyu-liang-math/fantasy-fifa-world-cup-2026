import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAll: vi.fn(),
  set: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: mocks.getAll, set: mocks.set }),
}));
vi.mock("@/config/server-environment-runtime", () => ({
  readSupabaseServerEnvironment: () => ({
    url: "https://project.supabase.co",
    anonymousKey: "anon-key",
  }),
}));

import { createAuthenticatedServerSupabaseClient } from "./auth-server";

describe("authenticated Supabase server client", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses request cookies with HttpOnly server-only session defaults", async () => {
    const expected = { auth: {} };
    mocks.createServerClient.mockReturnValue(expected);
    await expect(createAuthenticatedServerSupabaseClient()).resolves.toBe(
      expected,
    );
    const options = mocks.createServerClient.mock.calls[0]?.[2];
    expect(options.cookieOptions).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
    });
    expect(options.cookies.getAll).toBeTypeOf("function");
    expect(options.cookies.setAll).toBeTypeOf("function");
    options.cookies.setAll([
      { name: "session", value: "redacted", options: { path: "/" } },
    ]);
    expect(mocks.set).toHaveBeenCalledWith("session", "redacted", {
      path: "/",
    });
  });
});
