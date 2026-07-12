import Link from "next/link";

import { PagePlaceholder } from "@/components/page-placeholder";

export default function HomePage() {
  return (
    <PagePlaceholder
      title="Fantasy FIFA World Cup 2026"
      description="The public tournament tracker is under development. Results, standings, and award leaders will be added in later reviewed milestones."
    >
      <Link
        className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        href="/tournament"
      >
        View tournament placeholder
      </Link>
    </PagePlaceholder>
  );
}
