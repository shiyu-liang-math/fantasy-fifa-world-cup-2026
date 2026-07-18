import { logoutAction } from "@/app/admin/login/actions";

export function AdminAccessDenied() {
  return (
    <section aria-labelledby="admin-access-title" className="space-y-5">
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
        <h1 className="text-2xl font-black" id="admin-access-title">
          Administrator access required
        </h1>
        <p className="mt-2 leading-7">
          This signed-in account is not authorized to administer the tournament.
        </p>
      </div>
      <form action={logoutAction}>
        <button
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-900"
          type="submit"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}

export function AdminUnavailable() {
  return (
    <section
      aria-labelledby="admin-unavailable-title"
      className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-950"
    >
      <h1 className="text-2xl font-black" id="admin-unavailable-title">
        Administration unavailable
      </h1>
      <p className="mt-2 leading-7">
        The administration service could not be reached. No tournament change
        was made.
      </p>
    </section>
  );
}
