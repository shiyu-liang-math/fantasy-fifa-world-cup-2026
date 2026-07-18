import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDashboardPageModel: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/repositories/public-tournament-repository", () => ({
  createPublicTournamentRepository: () => ({}),
}));
vi.mock("@/services/page-models/dashboard", () => ({
  getDashboardPageModel: mocks.getDashboardPageModel,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { SiteHeader } from "./site-header";

describe("SiteHeader recoverable data failures", () => {
  beforeEach(() => mocks.getDashboardPageModel.mockReset());

  it.each([
    { status: "configuration_error" },
    { status: "unavailable" },
    { status: "invalid", issues: ["internal detail"] },
    { status: "missing_tournament" },
  ])("keeps navigation available for $status", async (result) => {
    mocks.getDashboardPageModel.mockResolvedValue(result);
    const html = renderToStaticMarkup(await SiteHeader());
    expect(html).toContain("Fantasy World Cup");
    expect(html).toContain("Primary navigation");
    expect(html).toContain("Open primary navigation");
    expect(html).not.toContain("internal detail");
    expect(html).not.toContain("temporarily unavailable");
  });
});
