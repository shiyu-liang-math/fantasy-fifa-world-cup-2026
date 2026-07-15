import type { Metadata } from "next";
import {
  MatchCard,
  PageHeader,
  ResultBoundary,
  StatusBanner,
} from "@/components/public-ui";
import { createPublicTournamentRepository } from "@/repositories/public-tournament-repository";
import { getBracketPageModel } from "@/services/page-models/bracket";
export const metadata: Metadata = {
  title: "Bracket",
  description: "The official World Cup knockout bracket and source slots.",
};
export default async function BracketPage() {
  const result = await getBracketPageModel(createPublicTournamentRepository());
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tournament"
        title="Knockout bracket"
        description="Round-by-round fixtures, source slots, advancing countries, third-place match, and final."
      />
      <ResultBoundary
        result={result}
        emptyMessage="The official bracket mapping has not been published in the reference dataset."
      >
        {(data) =>
          data.rounds.every((round) => round.matches.length === 0) ? (
            <StatusBanner title="Awaiting official bracket">
              Round structure is ready, but no official knockout pairings or
              source-slot mapping are loaded.
            </StatusBanner>
          ) : (
            <div className="table-scroll pb-4">
              <div className="flex min-w-max items-start gap-5">
                {data.rounds.map((round) => (
                  <section className="w-72 space-y-3" key={round.roundId}>
                    <h2 className="sticky left-0 text-lg font-black">
                      {round.name}
                    </h2>
                    {round.matches.length ? (
                      round.matches.map((match) => (
                        <MatchCard match={match} key={match.id} />
                      ))
                    ) : (
                      <StatusBanner title="Awaiting fixtures">
                        No official matches loaded.
                      </StatusBanner>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )
        }
      </ResultBoundary>
    </div>
  );
}
