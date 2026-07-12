import Link from "next/link";

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-title" className="space-y-4">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
        404
      </p>
      <h1
        id="not-found-title"
        className="text-3xl font-bold tracking-tight text-slate-950"
      >
        Page not found
      </h1>
      <p className="max-w-xl leading-7 text-slate-600">
        The requested page does not exist or has not been added to the project
        yet.
      </p>
      <Link
        className="inline-flex min-h-11 items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        href="/"
      >
        Return home
      </Link>
    </section>
  );
}
