import type { Metadata } from "next";
import { FearGreedPanel } from "@/components/charts/FearGreedPanel";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";

export const metadata: Metadata = {
  title: "Crypto Fear & Greed Index",
  description:
    "Alternative.me crypto market Fear & Greed Index — educational chart for Adirindin Finance (NFA).",
};

export default function CryptoFearGreedChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Sentiment" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Crypto Fear &amp; Greed Index
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Crypto market sentiment via Alternative.me. Educational framing only —
        not financial advice (NFA).
      </p>

      <div className="mt-8">
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
      </div>
    </div>
  );
}
