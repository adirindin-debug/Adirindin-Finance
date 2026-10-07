import type { Metadata } from "next";
import Link from "next/link";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { CommodityChartsPanel } from "@/components/charts/CommodityChartsPanel";

export const metadata: Metadata = {
  title: "Commodity charts",
  description:
    "Gold, silver, copper, nickel, lithium and iron ore prices from public sources (Yahoo Finance futures closes, IMF Primary Commodity Prices, long-run gold history) — educational charts for Adirindin Finance (NFA).",
};

export default function CommodityChartsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Macro" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Commodity charts</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Gold, silver, copper, nickel, lithium and iron ore from public, attributed sources. Gold is
        the long-run US-dollar series (with the 15 Aug 1971 Nixon Shock marker) that pairs with the{" "}
        <Link href="/tools/gold-cycle" className="text-accent hover:underline">
          gold cycle sketch
        </Link>
        . Educational content only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <CommodityChartsPanel />
      </div>
    </div>
  );
}
