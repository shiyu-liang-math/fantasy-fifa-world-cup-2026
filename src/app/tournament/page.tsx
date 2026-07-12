import type { Metadata } from "next";
import Link from "next/link";
import {
  PageHeader,
  ResultBoundary,
  SectionHeader,
  StatCard,
  StatusBanner,
} from "@/components/public-ui";
import { createReferenceTournamentRepository } from "@/repositories/local-tournament-repository";
import { getTournamentOverviewPageModel } from "@/services/page-models/tournament";
export const metadata: Metadata = {
  title: "Tournament",
  description:
    "Official tournament coverage, format, groups, and knockout bracket.",
};
export default async function TournamentPage() {
  const result = await getTournamentOverviewPageModel(
    createReferenceTournamentRepository(),
  );
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Official competition"
        title="Tournament"
        description="A clear view of the loaded World Cup structure without filling gaps with invented fixtures."
      />
      <ResultBoundary result={result}>
        {(data) => (
          <div className="space-y-9">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Status" value={data.status} />
              <StatCard
                label="Current round"
                value={data.currentRoundName ?? "Not announced"}
              />
              <StatCard
                label="Country coverage"
                value={`${data.representedCountryCount} / ${data.expectedCountryCount}`}
              />
              <StatCard
                label="Knockout matches loaded"
                value={data.knockoutMatchCount}
              />
            </section>
            <StatusBanner
              kind={data.referenceDataComplete ? "info" : "warning"}
              title={
                data.referenceDataComplete
                  ? "Reference data complete"
                  : "Coverage is partial"
              }
            >
              The 2026 format expects 12 groups and a 32-team knockout stage.
              This tracker currently contains {data.groupCount} official group
              allocations and {data.knockoutMatchCount} knockout matches.
            </StatusBanner>
            <section className="space-y-4">
              <SectionHeader
                title="Competition structure"
                description="The group stage runs across Groups A–L. Qualifiers advance to the Round of 32, followed by five knockout rounds including the final."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  [
                    "Group stage",
                    "See official allocations, standings, qualification, and matches.",
                    "/tournament/groups",
                  ],
                  [
                    "Knockout bracket",
                    "Follow source slots, advancing countries, the third-place match, and final.",
                    "/tournament/bracket",
                  ],
                ].map(([title, desc, href]) => (
                  <Link
                    className="rounded-xl border border-slate-200 bg-white p-6 hover:border-brand-500"
                    href={href}
                    key={href}
                  >
                    <h3 className="font-black">
                      {title} <span aria-hidden="true">→</span>
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {desc}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
      </ResultBoundary>
    </div>
  );
}
