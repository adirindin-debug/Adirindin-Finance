import type { Metadata } from "next";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { EtfFlowsPanel } from "@/components/charts/EtfFlowsPanel";
import { MobileViewHint } from "@/components/ui/MobileViewHint";

export const metadata: Metadata = {
  title: "Crypto ETF flows · US spot net flows",
  description:
    "US spot Bitcoin, Ethereum, Solana and Zcash (ZCSH) ETF net flows — daily through yearly aggregation. Public Farside and SoSoValue-backed sources. Educational only (NFA).",
};

export default function EtfFlowsChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <MobileViewHint />
      <ChartsBackLink category="Crypto markets" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Crypto ETF flows
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        US spot crypto ETF net flows for Bitcoin, Ethereum, Solana and Zcash
        (ZCSH). Toggle the asset and aggregation (daily / weekly / monthly /
        quarterly / yearly). Public source tables only — we never invent
        figures. Educational framing only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <EtfFlowsPanel />
      </div>
    </div>
  );
}
