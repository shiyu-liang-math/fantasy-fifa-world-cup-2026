import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  AdminAccessDenied,
  AdminUnavailable,
} from "@/components/admin/access-state";
import { ResultEntryForm } from "@/components/admin/result-form";
import { PageHeader } from "@/components/public-ui";
import { listAdminMatches } from "@/services/administration/result-entry";
import { loadAdminPageContext } from "../../load-context";

export const dynamic = "force-dynamic";

export default async function AdminMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const result = await loadAdminPageContext();
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "forbidden") return <AdminAccessDenied />;
  if (result.status === "unavailable") return <AdminUnavailable />;
  if (result.status !== "authorized") return <AdminUnavailable />;

  const { matchId } = await params;
  const match = listAdminMatches(result.context.snapshot).find(
    ({ id }) => id === matchId,
  );
  if (match === undefined) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`Match ${match.matchNumber} · ${match.status}`}
        title={`${match.homeCountryName} vs. ${match.awayCountryName}`}
        description="Fixture identity and tournament stage are read-only in Milestone 7B. Preview and verify the calculated effects before applying a result."
      >
        <dl className="grid max-w-2xl gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-semibold text-slate-500">Stage</dt>
            <dd className="mt-1 font-bold">
              {match.stage.replaceAll("_", " ")}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Match number</dt>
            <dd className="mt-1 font-bold numeric">{match.matchNumber}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Scheduled</dt>
            <dd className="mt-1 font-bold">
              {match.scheduledAt
                ? formatTimestamp(match.scheduledAt)
                : "Not set"}
            </dd>
          </div>
        </dl>
      </PageHeader>
      <Link
        className="inline-flex min-h-11 items-center font-bold underline"
        href="/admin"
      >
        ← All fixtures
      </Link>
      <ResultEntryForm match={match} />
    </div>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
