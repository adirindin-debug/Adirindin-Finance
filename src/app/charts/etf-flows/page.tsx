import type { Metadata } from "next";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { EtfFlowsPanel } from "@/components/charts/EtfFlowsPanel";
import { MobileViewHint } from "@/components/ui/MobileViewHint";

export const metadata: Metadata = {
  title: "Crypto ETF flows · quarterly net creations (SEC EDGAR)",
  description:
    "Quarterly net creations and redemptions for US spot Bitcoin, Ethereum and Solana ETFs, taken from each trust's 10-Q and 10-K filings on SEC EDGAR. Educational only.",
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
        Quarterly net creations minus redemptions for US spot Bitcoin,
        Ethereum and Solana ETFs, as reported in each trust&apos;s 10-Q and
        10-K filings on SEC EDGAR. Filings arrive about 5–6 weeks after each
        quarter ends, so the latest quarter lags. Funds we can&apos;t derive
        from the filings are listed below, never estimated.
      </p>

      <div className="mt-8">
        <EtfFlowsPanel />
      </div>
    </div>
  );
}
