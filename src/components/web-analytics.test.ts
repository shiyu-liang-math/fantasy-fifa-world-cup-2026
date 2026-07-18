import { describe, expect, it, vi } from "vitest";

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

import { filterAdminAnalytics } from "./web-analytics";

describe("web analytics route privacy", () => {
  it.each([
    "/admin",
    "/admin/",
    "/admin/login",
    "https://example.test/admin/matches/match-104?step=review",
  ])("drops admin event %s", (url) => {
    expect(filterAdminAnalytics({ type: "pageview", url })).toBeNull();
  });

  it.each(["/", "/dashboard", "/administrator", "/tournament/bracket"])(
    "keeps public event %s",
    (url) => {
      const event = { type: "pageview" as const, url };
      expect(filterAdminAnalytics(event)).toBe(event);
    },
  );

  it("fails closed for a malformed URL", () => {
    expect(
      filterAdminAnalytics({ type: "pageview", url: "http://[invalid" }),
    ).toBeNull();
  });
});
