import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./server";

describe("createServerSupabaseClient", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("uses only public read configuration and disables browser session behavior", () => {
    const expected = { rpc: vi.fn() };
    vi.mocked(createClient).mockReturnValue(expected as never);
    expect(
      createServerSupabaseClient({
        url: "http://localhost:54321",
        anonymousKey: "anonymous-public-key-value",
      }),
    ).toBe(expected);
    expect(createClient).toHaveBeenCalledWith(
      "http://localhost:54321",
      "anonymous-public-key-value",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  });
});
