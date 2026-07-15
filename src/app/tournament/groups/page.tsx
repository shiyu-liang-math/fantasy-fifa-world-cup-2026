import type { Metadata } from "next";
import {
  GroupTable,
  MatchCard,
  PageHeader,
  ResultBoundary,
} from "@/components/public-ui";
import { createPublicTournamentRepository } from "@/repositories/public-tournament-repository";
import { getGroupsPageModel } from "@/services/page-models/groups";
export const metadata: Metadata = {
  title: "Groups",
  description: "Groups A through L, official standings, owners, and matches.",
};
export default async function GroupsPage() {
  const result = await getGroupsPageModel(createPublicTournamentRepository());
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tournament"
        title="Group stage"
        description="Groups A through L. Tables appear only when official country allocations are available."
      />
      <ResultBoundary
        result={result}
        emptyMessage="Official group allocations have not been loaded yet."
      >
        {(data) => (
          <div className="grid gap-8">
            {data.groups.map((group) => (
              <section className="space-y-4" key={group.code}>
                <h2 className="text-2xl font-black">Group {group.code}</h2>
                <GroupTable code={group.code} rows={group.countries} />
                {(group.completedMatches.length > 0 ||
                  group.upcomingMatches.length > 0) && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[...group.completedMatches, ...group.upcomingMatches].map(
                      (match) => (
                        <MatchCard match={match} key={match.id} />
                      ),
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </ResultBoundary>
    </div>
  );
}
