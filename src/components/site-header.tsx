import Link from "next/link";

import { publicNavigation } from "@/config/routes";

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Link className="text-lg font-semibold text-slate-950" href="/">
          Fantasy FIFA World Cup 2026
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-slate-700">
            {publicNavigation.map((route) => (
              <li key={route.href}>
                <Link
                  className="rounded-sm underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-950"
                  href={route.href}
                >
                  {route.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
