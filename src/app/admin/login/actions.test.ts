import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  createClient: vi.fn(),
  getContext: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ delete: mocks.cookieDelete }),
}));
vi.mock("@/lib/supabase/auth-server", () => ({
  createAuthenticatedServerSupabaseClient: mocks.createClient,
}));
vi.mock("@/services/administration/admin-access", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/services/administration/admin-access")
    >();
  return { ...actual, getAuthorizedAdministrationContext: mocks.getContext };
});

import { loginAction, logoutAction } from "./actions";

function authClient(signInError: unknown = null) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: signInError }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
}

describe("administrator login actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns one generic failure for invalid credentials", async () => {
    mocks.createClient.mockResolvedValue(authClient(new Error("invalid user")));
    const form = new FormData();
    form.set("email", "someone@example.com");
    form.set("password", "wrong");
    const state = await loginAction({ status: "idle" }, form);
    expect(state.message).toBe(
      "Sign-in failed or this account does not have administrator access.",
    );
    expect(state.message).not.toContain("someone@example.com");
  });

  it("returns the same generic failure when the authentication service throws", async () => {
    mocks.createClient.mockRejectedValue(new Error("network detail"));
    const form = new FormData();
    form.set("email", "someone@example.com");
    form.set("password", "secret");
    await expect(loginAction({ status: "idle" }, form)).resolves.toEqual({
      status: "error",
      message:
        "Sign-in failed or this account does not have administrator access.",
    });
  });

  it("requires allowlisted RPC access after successful authentication", async () => {
    const client = authClient();
    mocks.createClient.mockResolvedValue(client);
    mocks.getContext.mockRejectedValue(new Error("forbidden"));
    const form = new FormData();
    form.set("email", "admin@example.com");
    form.set("password", "secret");
    const state = await loginAction({ status: "idle" }, form);
    expect(state.status).toBe("error");
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects only after authentication and allowlisted authorization", async () => {
    mocks.createClient.mockResolvedValue(authClient());
    mocks.getContext.mockResolvedValue({ revision: "1" });
    const form = new FormData();
    form.set("email", "admin@example.com");
    form.set("password", "secret");
    await expect(loginAction({ status: "idle" }, form)).rejects.toThrow(
      "REDIRECT:/admin",
    );
    expect(mocks.cookieDelete).toHaveBeenCalledWith("admin-result-review");
  });

  it("clears the local session on logout", async () => {
    const client = authClient();
    mocks.createClient.mockResolvedValue(client);
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/admin/login");
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.cookieDelete).toHaveBeenCalledWith("admin-result-review");
  });
});
