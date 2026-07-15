"use client";

export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-950">
      <h1 className="text-xl font-black">Something went wrong</h1>
      <p className="mt-2">The page could not be displayed. Please try again.</p>
      <button
        className="mt-4 rounded-lg bg-red-900 px-4 py-2 font-bold text-white"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
