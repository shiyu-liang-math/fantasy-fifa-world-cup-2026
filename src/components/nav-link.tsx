"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = isActiveRoute(pathname, href);
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="block rounded-md px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-800"
      href={href}
    >
      {children}
    </Link>
  );
}

export function isActiveRoute(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}
