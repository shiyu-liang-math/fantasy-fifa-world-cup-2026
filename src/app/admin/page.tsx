import Link from "next/link";

import { PagePlaceholder } from "@/components/page-placeholder";
import { adminNavigation } from "@/config/routes";

export default function AdminPage() {
  const loginRoute = adminNavigation.find(
    (route) => route.href === "/admin/login",
  );

  return (
    <PagePlaceholder
      title="Administration"
      description="Administrator authentication and tournament editing are intentionally not implemented in this scaffold."
    >
      {loginRoute ? (
        <Link
          className="inline-flex min-h-11 items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          href={loginRoute.href}
        >
          {loginRoute.label} placeholder
        </Link>
      ) : null}
    </PagePlaceholder>
  );
}
