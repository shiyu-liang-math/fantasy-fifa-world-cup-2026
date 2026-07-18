import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("administrator route integration boundaries", () => {
  it("scopes session refresh only to administrator routes", () => {
    const source = read("proxy.ts");
    expect(source).toContain('matcher: ["/admin/:path*"]');
    expect(source).not.toContain("/dashboard");
    expect(source).not.toContain("/tournament");
    expect(read("src/lib/supabase/admin-session-proxy.ts")).toContain(
      "await client.auth.getUser()",
    );
  });

  it("marks protected pages dynamic without changing public route caching", () => {
    expect(read("src/app/admin/page.tsx")).toContain(
      'dynamic = "force-dynamic"',
    );
    expect(read("src/app/admin/matches/[matchId]/page.tsx")).toContain(
      'dynamic = "force-dynamic"',
    );
    expect(read("src/repositories/public-tournament-repository.ts")).toContain(
      "revalidate: 60",
    );
  });

  it("keeps browser components free of Supabase clients and service-role paths", () => {
    const sources = [
      "src/components/admin/login-form.tsx",
      "src/components/admin/result-form.tsx",
      "src/components/web-analytics.tsx",
    ].map(read);
    for (const source of sources) {
      expect(source).not.toContain("@supabase/");
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source).not.toContain("service_role");
      expect(source).not.toContain(".from(");
    }
    expect(read("src/components/admin/result-form.tsx")).not.toContain(
      "serializedReview",
    );
  });

  it("leaves public routes on the anonymous repository boundary", () => {
    for (const path of [
      "src/app/page.tsx",
      "src/app/dashboard/page.tsx",
      "src/app/awards/page.tsx",
      "src/app/tournament/page.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain("createPublicTournamentRepository");
      expect(source).not.toContain("auth-server");
      expect(source).not.toContain("cookies(");
    }
  });
});
