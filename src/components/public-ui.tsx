import Link from "next/link";
import type { ReactNode } from "react";

import { teamPath } from "../config/routes";
import type {
  AwardRankingEntry,
  BracketMatchModel,
  BracketSlotModel,
  CountryContributionModel,
  GroupCountryRowModel,
  MatchSummaryModel,
  PageModelResult,
  ParticipantStandingModel,
} from "../services/page-models/types";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="space-y-4 border-b border-slate-200 pb-7">
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-700">
          {eyebrow}
        </p>
      )}
      <div className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
          {title}
        </h1>
        <p className="text-base leading-7 text-slate-600 sm:text-lg">
          {description}
        </p>
      </div>
      {children}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-3xl leading-7 text-slate-600">{description}</p>
      )}
    </div>
  );
}

export function StatusBanner({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "warning" | "error" | "fictional";
  title: string;
  children: ReactNode;
}) {
  const style =
    kind === "error"
      ? "border-red-300 bg-red-50 text-red-950"
      : kind === "fictional"
        ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-950"
        : kind === "warning"
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-sky-300 bg-sky-50 text-sky-950";
  return (
    <aside role="status" className={`rounded-xl border p-4 ${style}`}>
      <p className="font-bold">{title}</p>
      <div className="mt-1 text-sm leading-6 opacity-90">{children}</div>
    </aside>
  );
}

export function DataIssueList({ issues }: { issues: readonly string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {issues.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
    </ul>
  );
}

export function ResultBoundary<T>({
  result,
  children,
  emptyMessage = "There is no data to show yet.",
  allowIncomplete = true,
}: {
  result: PageModelResult<T>;
  children: (data: T) => ReactNode;
  emptyMessage?: string;
  allowIncomplete?: boolean;
}) {
  if (result.status === "missing_tournament")
    return (
      <StatusBanner kind="warning" title="Tournament unavailable">
        The tournament record has not been configured yet. Please check again
        later.
      </StatusBanner>
    );
  if (result.status === "invalid")
    return (
      <StatusBanner kind="error" title="Data could not be displayed">
        The official dataset did not pass validation. No standings have been
        published.
        <DataIssueList issues={result.issues} />
      </StatusBanner>
    );
  if (result.status === "not_found")
    return (
      <StatusBanner kind="warning" title="Participant not found">
        No participant matches “{result.identifier}”.
      </StatusBanner>
    );
  if (result.status === "empty")
    return (
      <>
        <StatusBanner title="Awaiting data">{emptyMessage}</StatusBanner>
        {children(result.data)}
      </>
    );
  if (result.status === "incomplete")
    return (
      <>
        <StatusBanner kind="warning" title="Official data is incomplete">
          Available official information is shown below. Missing results are
          never replaced with fictional data.
          <DataIssueList issues={result.missing} />
        </StatusBanner>
        {allowIncomplete && children(result.data)}
      </>
    );
  return <>{children(result.data)}</>;
}

export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 border-t-2 border-t-brand-500 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="numeric mt-2 text-3xl font-black text-slate-950">{value}</p>
      {note && <p className="mt-1 text-sm text-slate-500">{note}</p>}
    </div>
  );
}
export function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className="numeric inline-grid min-w-9 place-items-center rounded-full bg-brand-500 px-2 py-1 text-xs font-bold text-white"
      aria-label={`Rank ${rank}`}
    >
      #{rank}
    </span>
  );
}
export function DraftValueBadge({ value }: { value: number }) {
  return (
    <span
      className="whitespace-nowrap rounded-md bg-brand-100 px-2 py-1 text-xs font-bold text-brand-950"
      aria-label={`Draft value ${value}`}
    >
      Value {value}
    </span>
  );
}
export function CountryLabel({
  name,
  fifaCode,
}: {
  name: string;
  fifaCode?: string;
}) {
  return (
    <span className="font-semibold text-slate-900">
      {name}
      {fifaCode && (
        <span className="ml-2 text-xs font-medium text-slate-500">
          {fifaCode}
        </span>
      )}
    </span>
  );
}
export function ParticipantLabel({
  participant,
}: {
  participant: Pick<ParticipantStandingModel, "slug" | "name" | "abbreviation">;
}) {
  return (
    <Link
      className="font-bold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:decoration-brand-500"
      href={teamPath(participant.slug)}
    >
      {participant.name}{" "}
      <span className="text-slate-500">({participant.abbreviation})</span>
    </Link>
  );
}

export function AwardLeaderboard({
  caption,
  entries,
  unit,
}: {
  caption: string;
  entries: readonly AwardRankingEntry[];
  unit: string;
}) {
  return (
    <div className="table-scroll rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-96 text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3" scope="col">
              Rank
            </th>
            <th className="px-4 py-3" scope="col">
              Participant
            </th>
            <th className="px-4 py-3 text-right" scope="col">
              {unit}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {entries.map((entry) => (
            <tr key={entry.participantId}>
              <td className="px-4 py-3">
                <RankBadge rank={entry.rank} />
              </td>
              <th className="px-4 py-3" scope="row">
                {entry.name}{" "}
                <span className="text-slate-500">({entry.abbreviation})</span>
              </th>
              <td className="numeric px-4 py-3 text-right text-lg font-black">
                {formatNumber(entry.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CountryCard({
  country,
}: {
  country: CountryContributionModel;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CountryLabel name={country.name} fifaCode={country.fifaCode} />
        <DraftValueBadge value={country.draftValue} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-slate-500">Stars</dt>
          <dd className="numeric font-bold">{formatNumber(country.stars)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Goals</dt>
          <dd className="numeric font-bold">{country.goals}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className="font-bold">
            {country.isEliminated
              ? "Eliminated"
              : country.result === "before_round_of_32"
                ? "Awaiting play"
                : labelize(country.result)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function GroupTable({
  code,
  rows,
}: {
  code: string;
  rows: readonly GroupCountryRowModel[];
}) {
  if (rows.length === 0)
    return (
      <StatusBanner title={`Group ${code} awaiting allocation`}>
        No official country allocation has been loaded for this group.
      </StatusBanner>
    );
  return (
    <div className="table-scroll rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">Group {code} standings</caption>
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-3" scope="col">
              Pos
            </th>
            <th className="px-3 py-3" scope="col">
              Country
            </th>
            <th className="px-3 py-3" scope="col">
              Fantasy owner
            </th>
            {["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
              <th className="px-3 py-3 text-right" scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.countryId}>
              <td className="numeric px-3 py-3 font-bold">
                {row.officialRank ?? row.calculatedRank}
              </td>
              <th className="px-3 py-3" scope="row">
                <CountryLabel name={row.name} fifaCode={row.fifaCode} />
              </th>
              <td className="px-3 py-3">
                {row.owner
                  ? `${row.owner.name} (${row.owner.abbreviation})`
                  : "Not drafted"}
              </td>
              {[
                row.standing.played,
                row.standing.wins,
                row.standing.draws,
                row.standing.losses,
                row.standing.goalsFor,
                row.standing.goalsAgainst,
                row.standing.goalDifference,
                row.standing.points,
              ].map((v, i) => (
                <td className="numeric px-3 py-3 text-right" key={i}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function slotLabel(slot: BracketSlotModel) {
  return slot.kind === "country"
    ? slot.name
    : slot.kind === "source"
      ? `${labelize(slot.outcome)} of match ${slot.sourceMatchId}`
      : "Country to be confirmed";
}
export function MatchCard({
  match,
}: {
  match: BracketMatchModel | MatchSummaryModel;
}) {
  const home =
    "homeSlot" in match
      ? slotLabel(match.homeSlot)
      : (match.homeCountryId ?? "To be confirmed");
  const away =
    "awaySlot" in match
      ? slotLabel(match.awaySlot)
      : (match.awayCountryId ?? "To be confirmed");
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
        <span>Match {match.matchNumber}</span>
        <span>{labelize(match.status)}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex justify-between gap-3">
          <span>{home}</span>
          <strong className="numeric">{match.homeGoals ?? "—"}</strong>
        </div>
        <div className="flex justify-between gap-3">
          <span>{away}</span>
          <strong className="numeric">{match.awayGoals ?? "—"}</strong>
        </div>
      </div>
    </article>
  );
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}
export function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}
