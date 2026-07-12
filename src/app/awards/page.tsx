import type { Metadata } from "next";
import {
  AwardLeaderboard,
  PageHeader,
  ResultBoundary,
  SectionHeader,
  StatusBanner,
} from "@/components/public-ui";
import { createReferenceTournamentRepository } from "@/repositories/local-tournament-repository";
import { getAwardsPageModel } from "@/services/page-models/awards";
export const metadata: Metadata = {
  title: "Awards",
  description: "Golden Star, Golden Goal, and Golden Cup standings.",
};
export default async function AwardsPage() {
  const result = await getAwardsPageModel(
    createReferenceTournamentRepository(),
  );
  const rankingsAwaitingResults =
    result.status === "incomplete" &&
    result.data.goldenStar.every(({ value }) => value === 0) &&
    result.data.goldenGoal.every(({ value }) => value === 0);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Three ways to win"
        title="Awards"
        description="Tie-aware standings use standard competition ranking. Equal totals share a rank, and the next rank skips ahead."
      />
      <ResultBoundary result={result}>
        {(data) => (
          <div className="grid gap-10">
            <section className="space-y-4">
              <SectionHeader
                title="Golden Star"
                description="Accumulated Stars reward tournament progress and are multiplied by each country’s draft value."
              />
              {rankingsAwaitingResults ? (
                <StatusBanner title="Golden Star unresolved">
                  Official completed-match and advancement data is not yet
                  available, so no leader is shown.
                </StatusBanner>
              ) : (
                <AwardLeaderboard
                  caption="Golden Star standings"
                  entries={data.goldenStar}
                  unit="Stars"
                />
              )}
            </section>
            <section className="space-y-4">
              <SectionHeader
                title="Golden Goal"
                description="All official match goals in completed matches count; shootout kicks do not."
              />
              {rankingsAwaitingResults ? (
                <StatusBanner title="Golden Goal unresolved">
                  Official completed-match scores are not yet available, so no
                  leader is shown.
                </StatusBanner>
              ) : (
                <AwardLeaderboard
                  caption="Golden Goal standings"
                  entries={data.goldenGoal}
                  unit="Goals"
                />
              )}
            </section>
            <section className="space-y-4">
              <SectionHeader
                title="Golden Cup"
                description="Awarded to whoever drafted the World Cup champion."
              />
              <StatusBanner
                title={
                  data.goldenCup.status === "resolved"
                    ? "Golden Cup decided"
                    : "Golden Cup unresolved"
                }
              >
                {data.goldenCup.status === "resolved"
                  ? "The official champion has determined the winner."
                  : `${data.goldenCup.contenders.reduce((n, x) => n + x.countryIds.length, 0)} drafted countries remain listed as contenders in the available data.`}
              </StatusBanner>
            </section>
          </div>
        )}
      </ResultBoundary>
    </div>
  );
}
