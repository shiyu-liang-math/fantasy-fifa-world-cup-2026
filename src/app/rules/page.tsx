import type { Metadata } from "next";
import {
  DraftValueBadge,
  PageHeader,
  ResultBoundary,
  SectionHeader,
  formatDate,
  formatNumber,
} from "@/components/public-ui";
import { createPublicTournamentRepository } from "@/repositories/public-tournament-repository";
import { getRulesPageModel } from "@/services/page-models/rules";
export const metadata: Metadata = {
  title: "Rules",
  description:
    "Draft values and Golden Star, Golden Goal, and Golden Cup rules.",
};
export default async function RulesPage() {
  const result = await getRulesPageModel(createPublicTournamentRepository());
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Versioned rules"
        title="Game rules"
        description="The scoring rules used by the calculation layer and displayed here from the same page model."
      />
      <ResultBoundary result={result}>
        {(data) => (
          <div className="space-y-10">
            <section className="space-y-4">
              <SectionHeader
                title="Draft values"
                description={data.draftValueExplanation}
              />
              <div className="flex gap-3">
                {data.draftValues.map((value) => (
                  <DraftValueBadge value={value} key={value} />
                ))}
              </div>
            </section>
            <section className="space-y-4">
              <SectionHeader
                title="Golden Star"
                description="Stars are current accumulated totals, not a sum of every prior stage. Values below are for a Value 1 country; multiply by the draft value."
              />
              <div className="table-scroll rounded-xl border border-slate-200 bg-white">
                <table className="w-full min-w-96 text-left">
                  <caption className="sr-only">
                    Golden Star scoring by tournament result
                  </caption>
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3" scope="col">
                        Furthest result
                      </th>
                      <th className="px-4 py-3 text-right" scope="col">
                        Value 1 Stars
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.starStages.map((stage) => (
                      <tr key={stage.result}>
                        <th className="px-4 py-3" scope="row">
                          {stage.label}
                        </th>
                        <td className="numeric px-4 py-3 text-right font-bold">
                          {formatNumber(stage.valueOneStars)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold">Golden Goal</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
                  <li>
                    {data.goldenGoal.completedMatchesOnly
                      ? "Only completed matches count."
                      : "All match states count."}
                  </li>
                  <li>
                    {data.goldenGoal.includesGroupStage
                      ? "Group-stage goals are included."
                      : "Group-stage goals are excluded."}
                  </li>
                  <li>
                    {data.goldenGoal.shootoutKicksExcluded
                      ? "Penalty-shootout kicks are excluded."
                      : "Shootout kicks are included."}
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-xl font-bold">Golden Cup</h2>
                <p className="mt-3 leading-7 text-slate-600">
                  {data.goldenCupRule}
                </p>
              </div>
            </section>
            <section className="rounded-xl bg-slate-900 p-6 text-white">
              <h2 className="text-xl font-bold">Ranking and version</h2>
              <p className="mt-2 text-slate-300">
                {data.rankingMethod === "standard_competition"
                  ? "Standard competition ranking is used: tied participants share a rank and the next rank skips positions."
                  : data.rankingMethod}
              </p>
              <p className="mt-4 text-sm text-slate-400">
                Rules version {data.version} · Updated{" "}
                {formatDate(data.updatedAt)} · Star tie tolerance{" "}
                {data.starRankingTolerance}
              </p>
            </section>
          </div>
        )}
      </ResultBoundary>
    </div>
  );
}
