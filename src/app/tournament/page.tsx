import Link from "next/link";

import { PagePlaceholder } from "@/components/page-placeholder";
import { tournamentNavigation } from "@/config/routes";

export default function TournamentPage() {
  return (
    <PagePlaceholder
      title="Tournament"
      description="Tournament fixtures, results, group tables, and progression are under development."
    >
      <nav aria-label="Tournament sections">
        <ul className="flex flex-col gap-3 sm:flex-row">
          {tournamentNavigation.map((route) => (
            <li key={route.href}>
              <Link
                className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                href={route.href}
              >
                {route.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </PagePlaceholder>
  );
}
