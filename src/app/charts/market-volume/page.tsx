import type { Metadata } from "next";
import Link from "next/link";
import { MarketVolumePanel } from "@/components/charts/MarketVolumePanel";

export const metadata: Metadata = {
  title: "Crypto market volume",
  description:
    "Total crypto market volume as a 7-day moving average — educational chart for Adirindin Finance (NFA).",
};

export default function MarketVolumeChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        <Link href="/charts" className="hover:underline">
          ← Charts
        </Link>
        {" · "}Crypto markets
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Market volume
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Total crypto market volume (7-day moving average when available).
        Educational framing only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <MarketVolumePanel />
      </div>
    </div>
  );
}
