import type { Metadata } from "next";
import { FearGreedPanel } from "@/components/charts/FearGreedPanel";
import { MarketVolumePanel } from "@/components/charts/MarketVolumePanel";
import { WilshireM2Panel } from "@/components/charts/WilshireM2Panel";

export const metadata: Metadata = {
  title: "Charts",
  description:
    "Crypto Fear & Greed, total market volume, and Wilshire 5000 / US M2 — educational charts for Adirindin Finance (NFA).",
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
        Clean public-data charts for sentiment, market volume, and a classic equity /
        money-supply ratio. Educational content only — not financial advice (NFA).
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <FearGreedPanel />
        <MarketVolumePanel />
        <WilshireM2Panel />
      </div>

      <p className="mt-8 text-sm text-muted">
        Educational content only · not financial advice (NFA) · Adirindin Finance /
        Anthony.
      </p>
    </div>
  );
}
