import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAccessDenied,
  AdminUnavailable,
} from "@/components/admin/access-state";
import { PageHeader } from "@/components/public-ui";
import { logoutAction } from "./login/actions";
import { loadAdminPageContext } from "./load-context";
import { listAdminMatches } from "@/services/administration/result-entry";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const result = await loadAdminPageContext();
  if (result.status === "unauthenticated") redirect("/admin/login");
  if (result.status === "forbidden") return <AdminAccessDenied />;
  if (result.status === "unavailable") return <AdminUnavailable />;
  if (result.status !== "authorized") return <AdminUnavailable />;

  const matches = listAdminMatches(result.context.snapshot);
  const unresolved = matches.filter(({ status }) => status !== "completed");
  const completed = matches.filter(({ status }) => status === "completed");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Protected administration"
        title="Tournament results"
        description="Enter or correct results for existing official fixtures. Every change must be previewed before it can be applied."
      >
        <form action={logoutAction}>
          <button
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-900"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </PageHeader>

      <MatchSection
        description="These fixtures do not yet have a completed result."
        matches={unresolved}
        title="Results awaiting entry"
      />
      <MatchSection
        description="Choose a completed fixture only when its official result needs correction."
        matches={completed}
        title="Completed results"
      />
    </div>
  );
}

function MatchSection({
  title,
  description,
  matches,
}: {
  title: string;
  description: string;
  matches: ReturnType<typeof listAdminMatches>;
}) {
  return (
    <section
      className="space-y-4"
      aria-labelledby={`${title.replaceAll(" ", "-")}-title`}
    >
      <div>
        <h2
          className="text-2xl font-black text-slate-950"
          id={`${title.replaceAll(" ", "-")}-title`}
        >
          {title}
        </h2>
        <p className="mt-1 text-slate-600">{description}</p>
      </div>
      {matches.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600">
          No fixtures in this section.
        </p>
      ) : (
        <ul className="grid gap-3">
          {matches.map((match) => (
            <li key={match.id}>
              <Link
                className="flex min-h-11 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500 sm:flex-row sm:items-center sm:justify-between"
                href={`/admin/matches/${encodeURIComponent(match.id)}`}
              >
                <span>
                  <span className="block font-bold text-slate-950">
                    Match {match.matchNumber}: {match.homeCountryName} vs.{" "}
                    {match.awayCountryName}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">
                    {formatStage(match.stage)} · Status: {match.status}
                  </span>
                </span>
                <span className="font-bold text-brand-800">
                  {match.status === "completed"
                    ? "Correct result"
                    : "Enter result"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatStage(stage: string): string {
  return stage.replaceAll("_", " ");
}
