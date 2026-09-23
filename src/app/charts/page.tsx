import type { Metadata } from "next";
import { Btc200wMaPanel } from "@/components/charts/Btc200wMaPanel";
import { FearGreedPanel } from "@/components/charts/FearGreedPanel";
import { MarketVolumePanel } from "@/components/charts/MarketVolumePanel";
import { WilshireM2Panel } from "@/components/charts/WilshireM2Panel";

export const metadata: Metadata = {
  title: "Charts",
  description:
    "Fear & Greed and crypto Fear & Greed, total market volume, Bitcoin 200-week MA, and Wilshire 5000 / US M2 — educational charts for Adirindin Finance (NFA).",
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
        <FearGreedPanel
          endpoint="/api/fear-greed-crypto"
          title="Crypto Fear & Greed Index"
          subtitle="Alternative.me crypto market sentiment — educational only (NFA)."
          chartAriaLabel="Crypto Fear and Greed Index history. Hover for daily values. Drag to zoom."
          chartTitle="Crypto Fear and Greed Index history"
          timeframeAriaLabel="Crypto Fear and Greed timeframe"
          defaultSource="Alternative.me Crypto Fear & Greed Index"
          defaultSourceUrl="https://alternative.me/crypto/fear-and-greed-index/"
          defaultCompareUrl=""
          defaultCompareLabel=""
        />
        <MarketVolumePanel />
        <Btc200wMaPanel />
        <WilshireM2Panel />
      </div>

      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted">
        Sources on this page: FearGreedChart.com independent stock Fear &amp; Greed
        (documented public API; CNN link-out for comparison only); Alternative.me Crypto
        Fear &amp; Greed; CoinGecko global volume (with labelled fallbacks); Yahoo Finance / Coinbase
        BTC-USD for the 200-week MA; FRED® / Yahoo Finance (delayed third-party
        quotes) for Wilshire 5000 ÷ US M2. Each panel carries its own source line.
        Educational content only · not financial advice (NFA) · Adirindin Finance / Anthony.
      </p>
    </div>
  );
}
