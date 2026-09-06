import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BTC 4-Year Cycle Map",
  description: "Observation-only Bitcoin 4-year cycle map. Educational — not investment advice.",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Tools</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">BTC 4-Year Cycle Map</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted">Observation-only cycle chart — educational framing, not forecasts or personal financial advice.</p>
        </div>
        <Link href="/btc-cycle-map.html" className="inline-flex shrink-0 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:border-accent/50">Open full page</Link>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-black">
        <iframe src="/btc-cycle-map.html?embed=1" title="BTC 4-Year Cycle Map" className="block w-full border-0" style={{ height: 980, width: "100%", border: 0 }} loading="lazy" />
      </div>
      <p className="mt-4 text-xs text-muted">Map retains its own data sources and disclaimers.</p>
    </div>
  );
}
