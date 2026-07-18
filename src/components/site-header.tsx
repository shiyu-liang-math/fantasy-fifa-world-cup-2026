import Link from "next/link";

import { createPublicTournamentRepository } from "@/repositories/public-tournament-repository";
import { getDashboardPageModel } from "@/services/page-models/dashboard";
import { ResponsiveNavigation } from "./responsive-navigation";

export async function SiteHeader() {
  const result = await getDashboardPageModel(
    createPublicTournamentRepository(),
  );
  const participants = "data" in result ? result.data.participants : [];
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="flex min-w-0 items-center gap-3 rounded-md" href="/">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-brand-500 text-sm font-black text-white"
          >
            26
          </span>
          <span className="leading-tight">
            <span className="block font-bold text-slate-950">
              Fantasy World Cup
            </span>
            <span className="block text-xs font-medium text-slate-500">
              Friends league · 2026
            </span>
          </span>
        </Link>
        <ResponsiveNavigation participants={participants} />
      </div>
    </header>
  );
}
