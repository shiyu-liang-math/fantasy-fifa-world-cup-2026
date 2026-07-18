import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/config/server-environment-runtime", () => ({
  readSupabaseServerEnvironment: () => ({
    url: "https://project.supabase.co",
    anonymousKey: "anon-key",
  }),
}));

import { refreshAdminSession } from "./admin-session-proxy";

describe("administrator session proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getUser: async () => {
          options.cookies.setAll(
            [
              {
                name: "session",
                value: "refreshed",
                options: { httpOnly: true, path: "/" },
              },
            ],
            {
              "Cache-Control":
                "private, no-cache, no-store, must-revalidate, max-age=0",
              Expires: "0",
              Pragma: "no-cache",
            },
          );
          return { data: { user: { id: "admin" } }, error: null };
        },
      },
    }));
  });

  it("propagates refreshed cookies and prevents caching of admin responses", async () => {
    const response = await refreshAdminSession(
      new NextRequest("https://example.test/admin/matches/match-102"),
    );
    expect(response.cookies.get("session")).toMatchObject({
      value: "refreshed",
      httpOnly: true,
      path: "/",
    });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Expires")).toBe("0");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });
});
