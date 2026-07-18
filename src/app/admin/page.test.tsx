import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadContext: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./load-context", () => ({ loadAdminPageContext: mocks.loadContext }));
vi.mock("./login/actions", () => ({ logoutAction: vi.fn() }));

import AdminPage from "./page";

describe("protected administrator page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects unauthenticated requests to login", async () => {
    mocks.loadContext.mockResolvedValue({ status: "unauthenticated" });
    await expect(AdminPage()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("shows no tournament administration data to non-allowlisted users", async () => {
    mocks.loadContext.mockResolvedValue({ status: "forbidden" });
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).toContain("Administrator access required");
    expect(html).not.toContain("Completed results");
    expect(html).not.toContain("Tournament results");
  });
});
