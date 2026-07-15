import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const consumers = [
  "src/app/page.tsx",
  "src/app/dashboard/page.tsx",
  "src/app/awards/page.tsx",
  "src/app/teams/[participantSlug]/page.tsx",
  "src/app/tournament/page.tsx",
  "src/app/tournament/groups/page.tsx",
  "src/app/tournament/bracket/page.tsx",
  "src/app/rules/page.tsx",
  "src/components/site-header.tsx",
];

describe("public Supabase route integration", () => {
  it("routes every canonical consumer through the public repository factory", () => {
    for (const path of consumers) {
      const source = read(path);
      expect(source, path).toContain("createPublicTournamentRepository");
      expect(source, path).not.toContain("createReferenceTournamentRepository");
      expect(source, path).not.toContain("@supabase/supabase-js");
    }
  });

  it("keeps canonical fetching out of client components", () => {
    for (const path of [
      "src/app/error.tsx",
      "src/components/nav-link.tsx",
      "src/components/teams-menu.tsx",
    ]) {
      const source = read(path);
      expect(source, path).not.toContain("@supabase/supabase-js");
      expect(source, path).not.toMatch(/\bfetch\s*\(/);
    }
  });
});

function read(path: string): string {
  return readFileSync(`${process.cwd()}/${path}`, "utf8");
}
