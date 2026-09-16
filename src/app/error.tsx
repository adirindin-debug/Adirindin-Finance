"use client";

import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="text-3xl font-semibold text-foreground">Page didn’t load</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        {error.message || "Something failed in this view."}
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
