import type { Metadata } from "next";
import Link from "next/link";
import { Btc200wMaPanel } from "@/components/charts/Btc200wMaPanel";

export const metadata: Metadata = {
  title: "Bitcoin 200-week MA",
  description:
    "Bitcoin price versus the 200-week simple moving average — educational chart for Adirindin Finance (NFA).",
};

export default function Btc200wMaChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        <Link href="/charts" className="hover:underline">
          ← Charts
        </Link>
        {" · "}Crypto markets
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
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
