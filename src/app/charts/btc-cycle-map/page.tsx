import type { Metadata } from "next";
import Link from "next/link";
import { BtcCycleFrame } from "@/components/BtcCycleFrame";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";

export const metadata: Metadata = {
  title: "BTC cycle map",
  description:
    "Live Bitcoin cycle map with price, 50-week / 200-week moving averages, and desk cycle tops/bottoms — educational study aid for Adirindin Finance (NFA).",
};

export default function BtcCycleMapChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Crypto markets" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        BTC cycle map
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Live Bitcoin price with 50-week and 200-week moving averages, plus desk
        markers for historical cycle tops and bottoms. Built as a{" "}
        <strong className="font-medium text-foreground">study aid</strong> for
        observing how price rhymes with prior epochs — not a forecast, timing
        model, or trade signal. Educational only · not financial advice (NFA).
      </p>
      <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
        For the stylised 4-year cycle theory schematic (Live-dot loop, year
        stacks), see{" "}
        <Link href="/dashboard/btc-cycle" className="text-accent hover:underline">
          BTC 4 year cycle theory
        </Link>
        .
      </p>

      <div className="mt-8">
        <BtcCycleFrame />
      </div>
    </div>
  );
}
