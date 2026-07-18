import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { REFERENCE_SNAPSHOT } from "@/data/reference/snapshot";
import { snapshotPayload } from "@/repositories/supabase-snapshot-test-fixture";
import {
  AdministrationAccessError,
  getAuthorizedAdministrationContext,
  type AuthenticatedAdministrationClient,
} from "./admin-access";

function client(user: { id: string } | null, rpc: ReturnType<typeof vi.fn>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    rpc,
  } as unknown as AuthenticatedAdministrationClient;
}

describe("administrator access boundary", () => {
  it("requires a server-validated user before calling the allowlisted RPC", async () => {
    const rpc = vi.fn();
    await expect(
      getAuthorizedAdministrationContext(
        client(null, rpc),
        "fifa-world-cup-2026",
      ),
    ).rejects.toMatchObject({ kind: "unauthenticated" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a safe forbidden result for a non-allowlisted user", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P7403", message: "private detail" },
    });
    await expect(
      getAuthorizedAdministrationContext(
        client({ id: "ordinary-user" }, rpc),
        "fifa-world-cup-2026",
      ),
    ).rejects.toEqual(expect.any(AdministrationAccessError));
    await expect(
      getAuthorizedAdministrationContext(
        client({ id: "ordinary-user" }, rpc),
        "fifa-world-cup-2026",
      ),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("requires both validated authentication and an authorized context", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        tournament_id: "fifa-world-cup-2026",
        revision: "4",
        snapshot: snapshotPayload(REFERENCE_SNAPSHOT),
      },
      error: null,
    });
    const context = await getAuthorizedAdministrationContext(
      client({ id: "allowlisted-user" }, rpc),
      "fifa-world-cup-2026",
    );
    expect(context.revision).toBe("4");
    expect(context.snapshot.tournament?.id).toBe("fifa-world-cup-2026");
  });
});
