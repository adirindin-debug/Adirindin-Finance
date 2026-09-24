import type { Metadata } from "next";
import Link from "next/link";
import { FearGreedPanel } from "@/components/charts/FearGreedPanel";

export const metadata: Metadata = {
  title: "Fear & Greed Index",
  description:
    "Independent US stock market Fear & Greed Index via FearGreedChart.com — educational chart for Adirindin Finance (NFA).",
};

export default function FearGreedChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        <Link href="/charts" className="hover:underline">
          ← Charts
        </Link>
        {" · "}Sentiment
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Fear &amp; Greed Index
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Independent US stock market sentiment gauge. Educational framing only —
        not financial advice (NFA).
      </p>

      <div className="mt-8">
        <FearGreedPanel
          title="Fear & Greed Index"
          subtitle="Independent US stock market sentiment via FearGreedChart.com — educational only (NFA)."
          chartAriaLabel="Fear and Greed Index history. Hover for daily values. Drag to zoom."
          chartTitle="Fear and Greed Index history"
          timeframeAriaLabel="Fear and Greed timeframe"
          defaultSource="FearGreedChart.com Fear & Greed Index (US stocks, independent)"
          defaultSourceUrl="https://feargreedchart.com/"
          defaultCompareUrl="https://www.cnn.com/markets/fear-and-greed"
          defaultCompareLabel="Compare with CNN Fear & Greed →"
        />
      </div>
    </div>
  );
}
