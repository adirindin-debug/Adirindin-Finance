import type { Metadata } from "next";
import { ChartsHub } from "@/components/charts/ChartsHub";

export const metadata: Metadata = {
  title: "Charts",
  description:
    "Live tiled dashboard of Fear & Greed, crypto Fear & Greed, market volume, Bitcoin 200-week MA, and Wilshire 5000 / US M2 — educational charts for Adirindin Finance (NFA).",
};

export default function ChartsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Desk · Charts
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Charts
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Live snapshots of public sentiment, crypto market, and macro charts.
        Tap a tile for the full interactive view. Educational content only —
        not financial advice (NFA).
      </p>

      <ChartsHub />

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
        More charts can be added over time. Live numbers come from each chart’s
        public API when available — tiles show “—” if a fetch fails (never
        invented). Educational · not financial advice (NFA) · Adirindin Finance
        / Anthony.
      </p>
    </div>
  );
}
