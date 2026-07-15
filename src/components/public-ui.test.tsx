import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PageModelResult } from "@/services/page-models/types";
import {
  AwardLeaderboard,
  DraftValueBadge,
  GroupTable,
  ResultBoundary,
  StatusBanner,
} from "./public-ui";

describe("public UI semantics", () => {
  it("renders safe recoverable repository states without internal details", () => {
    const configuration = renderToStaticMarkup(
      <ResultBoundary result={{ status: "configuration_error" }}>
        {() => <p>hidden</p>}
      </ResultBoundary>,
    );
    const unavailable = renderToStaticMarkup(
      <ResultBoundary result={{ status: "unavailable" }}>
        {() => <p>hidden</p>}
      </ResultBoundary>,
    );
    expect(configuration).toContain("Tournament data is not configured");
    expect(unavailable).toContain("temporarily unavailable");
    expect(`${configuration}${unavailable}`).not.toContain("SUPABASE_ANON_KEY");
  });

  it("renders partial data with official missing-data notices and no fictional warning", () => {
    const result: PageModelResult<{ label: string }> = {
      status: "incomplete",
      data: { label: "Available draft" },
      missing: ["Official matches are not loaded."],
    };
    const html = renderToStaticMarkup(
      <ResultBoundary result={result}>
        {(data) => <p>{data.label}</p>}
      </ResultBoundary>,
    );
    expect(html).toContain("Official data is incomplete");
    expect(html).toContain("Available draft");
    expect(html).not.toContain("Fictional development data");
  });

  it("gives explicitly fictional data a prominent warning style", () => {
    const html = renderToStaticMarkup(
      <StatusBanner kind="fictional" title="Fictional development data">
        Preview only
      </StatusBanner>,
    );
    expect(html).toContain("Fictional development data");
    expect(html).toContain("border-fuchsia-400");
  });

  it("renders tie-aware award ranks in an accessible table", () => {
    const html = renderToStaticMarkup(
      <AwardLeaderboard
        caption="Golden Star standings"
        unit="Stars"
        entries={[
          {
            participantId: "a",
            name: "A",
            abbreviation: "A",
            rank: 1,
            value: 0,
          },
          {
            participantId: "b",
            name: "B",
            abbreviation: "B",
            rank: 1,
            value: 0,
          },
        ]}
      />,
    );
    expect(html).toContain(
      '<caption class="sr-only">Golden Star standings</caption>',
    );
    expect(html.match(/aria-label=\"Rank 1\"/g)).toHaveLength(2);
    expect(html).toContain('scope="row"');
  });

  it("keeps draft values and owner labels meaningful without color", () => {
    const badge = renderToStaticMarkup(<DraftValueBadge value={3} />);
    expect(badge).toContain("Draft value 3");
    expect(badge).toContain("Value 3");
    const table = renderToStaticMarkup(
      <GroupTable
        code="A"
        rows={[
          {
            countryId: "france",
            name: "France",
            fifaCode: "FRA",
            owner: { participantId: "lyla", name: "Lyla", abbreviation: "L" },
            standing: {
              countryId: "france",
              played: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              goalsFor: 0,
              goalsAgainst: 0,
              goalDifference: 0,
              points: 0,
            },
            calculatedRank: 1,
            qualificationStatus: "unresolved",
            resolutionSource: "calculated",
          },
        ]}
      />,
    );
    expect(table).toContain("Lyla (L)");
    expect(table).toContain("Group A standings");
  });
});
