import type { Metadata } from "next";
import { Btc200wMaPanel } from "@/components/charts/Btc200wMaPanel";
import { FearGreedPanel } from "@/components/charts/FearGreedPanel";
import { MarketVolumePanel } from "@/components/charts/MarketVolumePanel";
import { WilshireM2Panel } from "@/components/charts/WilshireM2Panel";

export const metadata: Metadata = {
  title: "Charts",
  description:
    "US stock and crypto Fear & Greed, total market volume, Bitcoin 200-week MA, and Wilshire 5000 / US M2 — educational charts for Adirindin Finance (NFA).",
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
        Clean public-data charts for sentiment, market volume, Bitcoin’s
        200-week moving average, and a classic equity / money-supply ratio.
        Educational content only — not financial advice (NFA).
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <FearGreedPanel
          title="US Stock Fear & Greed Index"
          subtitle="CNN US stock market sentiment — educational only (NFA)."
          chartAriaLabel="US stock market Fear and Greed Index history. Hover for daily values. Drag to zoom."
          chartTitle="US stock market Fear and Greed Index history"
          timeframeAriaLabel="US stock Fear and Greed timeframe"
          defaultSource="CNN Fear & Greed Index (US stocks)"
          defaultSourceUrl="https://www.cnn.com/markets/fear-and-greed"
        />
        <FearGreedPanel
          endpoint="/api/fear-greed-crypto"
          title="Crypto Fear & Greed Index"
          subtitle="Alternative.me crypto market sentiment — educational only (NFA)."
          chartAriaLabel="Crypto Fear and Greed Index history. Hover for daily values. Drag to zoom."
          chartTitle="Crypto Fear and Greed Index history"
          timeframeAriaLabel="Crypto Fear and Greed timeframe"
          defaultSource="Alternative.me Crypto Fear & Greed Index"
          defaultSourceUrl="https://alternative.me/crypto/fear-and-greed-index/"
        />
        <MarketVolumePanel />
        <Btc200wMaPanel />
        <WilshireM2Panel />
      </div>

      <p className="mt-8 text-sm text-muted">
        Educational content only · not financial advice (NFA) · Adirindin Finance /
        Anthony.
      </p>
    </div>
  );
}
