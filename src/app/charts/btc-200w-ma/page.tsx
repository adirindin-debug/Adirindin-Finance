import type { Metadata } from "next";
import { Btc200wMaPanel } from "@/components/charts/Btc200wMaPanel";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";

export const metadata: Metadata = {
  title: "Bitcoin 200-week MA",
  description:
    "Bitcoin price versus the 200-week simple moving average — educational chart for Adirindin Finance (NFA).",
};

export default function Btc200wMaChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Crypto markets" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        BTC 200-week MA
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Bitcoin spot versus the 200-week simple moving average. Educational
        framing only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <Btc200wMaPanel />
      </div>
    </div>
  );
}
