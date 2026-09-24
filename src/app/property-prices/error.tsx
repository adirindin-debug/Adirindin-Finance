"use client";

import Link from "next/link";

export default function PropertyPricesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Tools · Real estate
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-foreground">
        Australian Property Prices didn’t load
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        {error.message || "The chart threw while drawing. The rest of the site is fine."}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
        <Link href="/" className="rounded-md border border-border px-4 py-2 text-sm">
          Home
        </Link>
      </div>
    </div>
  );
}
