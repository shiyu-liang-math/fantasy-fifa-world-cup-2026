import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/admin/actions", () => ({
  previewResultAction: vi.fn(),
  applyResultAction: vi.fn(),
}));

import { ResultEntryForm } from "./result-form";

const match = {
  id: "match-104",
  matchNumber: 104,
  stage: "final" as const,
  status: "scheduled" as const,
  scheduledAt: "2026-07-19T19:00:00.000Z",
  homeCountryId: "spain",
  homeCountryName: "Spain",
  awayCountryId: "argentina",
  awayCountryName: "Argentina",
  homeGoals: null,
  awayGoals: null,
  wentToExtraTime: false,
  homeShootoutGoals: null,
  awayShootoutGoals: null,
  advancingCountryId: null,
};

describe("accessible administrator result form", () => {
  it("renders explicit result groups, input help, and a separate preview action", () => {
    const html = renderToStaticMarkup(<ResultEntryForm match={match} />);
    expect(html).toContain("<legend");
    expect(html).toContain("Official score");
    expect(html).toContain("Penalty shootout");
    expect(html).toContain("Advancing country");
    expect(html).toContain('min="0"');
    expect(html).toContain('step="1"');
    expect(html).toContain("Preview changes");
    expect(html).not.toContain("Apply reviewed result");
    expect(html).not.toContain("@supabase");
  });
});
