import type { Metadata } from "next";
import {
  CountryCard,
  PageHeader,
  ParticipantLabel,
  RankBadge,
  ResultBoundary,
  StatCard,
  formatDate,
  formatNumber,
} from "@/components/public-ui";
import { createReferenceTournamentRepository } from "@/repositories/local-tournament-repository";
import { getDashboardPageModel } from "@/services/page-models/dashboard";
export const metadata: Metadata = {
  title: "Dashboard",
  description: "Fantasy team standings, draft picks, and tournament status.",
};
export default async function DashboardPage() {
  const result = await getDashboardPageModel(
    createReferenceTournamentRepository(),
  );
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Competition overview"
        title="Dashboard"
        description="Every participant’s draft, award totals, and country status in one place."
      />
      <ResultBoundary result={result}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="Tournament stage"
                value={data.currentRoundName ?? "Not started"}
              />
              <StatCard
                label="Last official update"
                value={formatDate(data.lastUpdatedAt)}
              />
            </div>
            {data.participants.map((p) => (
              <section
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6"
                key={p.participantId}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl">
                      <ParticipantLabel participant={p} />
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {p.activeCountryCount} countries not eliminated · Golden
                      Cup: {p.goldenCupStatus}
                    </p>
                  </div>
                  <div className="flex gap-5 text-sm">
                    <div>
                      <span className="block text-slate-500">Stars</span>
                      <strong className="numeric text-xl">
                        {formatNumber(p.stars)}
                      </strong>{" "}
                      <RankBadge rank={p.starRank} />
                    </div>
                    <div>
                      <span className="block text-slate-500">Goals</span>
                      <strong className="numeric text-xl">
                        {p.goals}
                      </strong>{" "}
                      <RankBadge rank={p.goalRank} />
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {p.countries.map((c) => (
                    <CountryCard country={c} key={c.countryId} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </ResultBoundary>
    </div>
  );
}
