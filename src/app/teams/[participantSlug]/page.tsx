import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CountryCard,
  PageHeader,
  ResultBoundary,
  StatCard,
  formatNumber,
} from "@/components/public-ui";
import { teamPath } from "@/config/routes";
import { createPublicTournamentRepository } from "@/repositories/public-tournament-repository";
import { getDashboardPageModel } from "@/services/page-models/dashboard";
import { getParticipantDetailPageModel } from "@/services/page-models/participant-detail";
type Props = { params: Promise<{ participantSlug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { participantSlug } = await params;
  const result = await getParticipantDetailPageModel(
    createPublicTournamentRepository(),
    participantSlug,
  );
  return "data" in result
    ? {
        title: result.data.participant.name,
        description: `${result.data.participant.name}'s fantasy World Cup team and drafted countries.`,
      }
    : { title: "Team not found" };
}
export default async function TeamPage({ params }: Props) {
  const { participantSlug } = await params;
  const repository = createPublicTournamentRepository();
  const [result, dashboard] = await Promise.all([
    getParticipantDetailPageModel(repository, participantSlug),
    getDashboardPageModel(repository),
  ]);
  if (result.status === "not_found") notFound();
  const participants = "data" in dashboard ? dashboard.data.participants : [];
  return (
    <div className="space-y-8">
      <ResultBoundary result={result}>
        {(data) => (
          <>
            <PageHeader
              eyebrow={`Team ${data.participant.abbreviation}`}
              title={data.participant.name}
              description="Drafted countries, contributions, and award positions from official tournament data."
            />
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Golden Star"
                value={formatNumber(data.stars)}
                note={`Rank #${data.starRank}`}
              />
              <StatCard
                label="Golden Goal"
                value={data.goals}
                note={`Rank #${data.goalRank}`}
              />
              <StatCard label="Golden Cup" value={data.goldenCupStatus} />
            </section>
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl font-bold">Drafted countries</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.countries.map((country) => (
                  <CountryCard country={country} key={country.countryId} />
                ))}
              </div>
            </section>
          </>
        )}
      </ResultBoundary>
      <nav
        aria-label="Fantasy teams"
        className="border-t border-slate-200 pt-6"
      >
        <p className="mb-3 text-sm font-bold text-slate-500">
          Browse all participants
        </p>
        <ul className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <li key={p.participantId}>
              <Link
                aria-current={p.slug === participantSlug ? "page" : undefined}
                className="inline-flex rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold aria-[current=page]:border-brand-500 aria-[current=page]:bg-brand-50"
                href={teamPath(p.slug)}
              >
                {p.name}{" "}
                <span className="ml-1 text-slate-500">{p.abbreviation}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
