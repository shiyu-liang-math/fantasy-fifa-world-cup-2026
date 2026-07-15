import Link from "next/link";
import {
  PageHeader,
  ResultBoundary,
  SectionHeader,
  StatCard,
  formatDate,
  formatNumber,
} from "@/components/public-ui";
import { teamPath } from "@/config/routes";
import { createPublicTournamentRepository } from "@/repositories/public-tournament-repository";
import { getDashboardPageModel } from "@/services/page-models/dashboard";
import { getHomePageModel } from "@/services/page-models/home";

const awards = [
  [
    "Golden Star",
    "Rewards how far your drafted countries advance, multiplied by draft value.",
  ],
  [
    "Golden Goal",
    "Counts official goals scored by your drafted countries in completed matches.",
  ],
  ["Golden Cup", "Goes to the participant who drafted the World Cup champion."],
] as const;

export default async function HomePage() {
  const repository = createPublicTournamentRepository();
  const [result, dashboardResult] = await Promise.all([
    getHomePageModel(repository),
    getDashboardPageModel(repository),
  ]);
  const participants =
    "data" in dashboardResult ? dashboardResult.data.participants : [];
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Friends league · 2026"
        title="Five teams. Three awards. One World Cup."
        description="A private fantasy competition where every drafted country can earn Stars, goals, and a shot at the Golden Cup."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-lg bg-brand-500 px-5 py-3 font-bold text-white hover:bg-brand-700"
            href="/dashboard"
          >
            View dashboard
          </Link>
          <Link
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-bold hover:bg-slate-50"
            href="/tournament"
          >
            View tournament
          </Link>
        </div>
      </PageHeader>
      <ResultBoundary result={result}>
        {(data) => (
          <div className="space-y-10">
            <section
              className="grid gap-4 sm:grid-cols-3"
              aria-label="Tournament snapshot"
            >
              <StatCard
                label="Current stage"
                value={data.currentRoundName ?? "Not started"}
                note={data.tournamentName}
              />
              <StatCard
                label="Golden Cup contenders"
                value={data.goldenCup.contenderCountryCount}
                note="drafted countries currently eligible"
              />
              <StatCard
                label="Official data updated"
                value={formatDate(data.lastUpdatedAt)}
              />
            </section>
            <section className="space-y-5">
              <SectionHeader
                title="The three awards"
                description="Each award recognizes a different kind of tournament success."
              />
              <div className="grid gap-4 md:grid-cols-3">
                {awards.map(([title, description]) => (
                  <article
                    className="rounded-xl border border-slate-200 bg-white p-6"
                    key={title}
                  >
                    <h3 className="text-lg font-black">{title}</h3>
                    <p className="mt-2 leading-7 text-slate-600">
                      {description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
            <section className="space-y-5">
              <SectionHeader
                title="The five participants"
                description="Each fantasy team drafted five countries across three draft-value tiers."
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {participants.map((participant) => (
                  <Link
                    className="rounded-xl border border-slate-200 bg-white p-5 hover:border-brand-500"
                    href={teamPath(participant.slug)}
                    key={participant.participantId}
                  >
                    <span className="block font-black text-slate-950">
                      {participant.name}
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      Team {participant.abbreviation} ·{" "}
                      {participant.countries.length} countries
                    </span>
                  </Link>
                ))}
              </div>
            </section>
            <section className="space-y-5">
              <SectionHeader
                title="Current leaders"
                description="Rankings appear only from the official reference dataset."
              />
              {result.status === "incomplete" &&
              data.goldenStarLeaders.every(({ stars }) => stars === 0) &&
              data.goldenGoalLeaders.every(({ goals }) => goals === 0) ? (
                <p className="rounded-xl border border-sky-300 bg-sky-50 p-5 font-semibold text-sky-950">
                  Award leaders are unresolved until official completed-match
                  results are loaded.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <StatCard
                    label="Golden Star"
                    value={
                      data.goldenStarLeaders.map((x) => x.name).join(", ") ||
                      "Unresolved"
                    }
                    note={`${formatNumber(data.goldenStarLeaders[0]?.stars ?? 0)} Stars`}
                  />
                  <StatCard
                    label="Golden Goal"
                    value={
                      data.goldenGoalLeaders.map((x) => x.name).join(", ") ||
                      "Unresolved"
                    }
                    note={`${data.goldenGoalLeaders[0]?.goals ?? 0} goals`}
                  />
                </div>
              )}
            </section>
            <nav
              aria-label="Explore the fantasy competition"
              className="grid gap-3 sm:grid-cols-3"
            >
              {[
                ["Awards", "/awards"],
                ["Tournament", "/tournament"],
                ["Rules", "/rules"],
              ].map(([label, href]) => (
                <Link
                  className="rounded-xl border border-slate-200 bg-white p-5 font-bold hover:border-brand-500"
                  href={href}
                  key={href}
                >
                  {label} <span aria-hidden="true">→</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </ResultBoundary>
    </div>
  );
}
