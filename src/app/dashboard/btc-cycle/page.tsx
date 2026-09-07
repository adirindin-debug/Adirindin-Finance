import type { Metadata } from "next";
import Link from "next/link";
import { BtcCycleFrame } from "@/components/BtcCycleFrame";

export const metadata: Metadata = {
  title: "BTC 4-Year Cycle Map",
  description:
    "Observation-only Bitcoin 4-year cycle map with optional MSTR overlay. Educational — not investment advice.",
};

export default function BtcCyclePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <Link href="/dashboard" className="hover:underline">
              Cycle desk
            </Link>{" "}
            · BTC
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            BTC + MSTR 4-Year Cycle Map
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            Detailed observation-only cycle chart with live feeds and optional Strategy (MSTR) overlay.
            Educational framing for study — not forecasts or personal financial advice (NFA). For a simple
            4-year overview, see the home page chart.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href="/dashboard"
            className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:border-accent/50"
          >
            All tools
          </Link>
          <Link
            href="/btc-cycle-map.html"
            className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:border-accent/50"
          >
            Open full page
          </Link>
        </div>
      </div>
      <BtcCycleFrame />
      <p className="mt-4 text-xs text-muted">
        Map retains its own data sources and disclaimers. @Dirindin533 · educational only.
      </p>
    </div>
  );
}
