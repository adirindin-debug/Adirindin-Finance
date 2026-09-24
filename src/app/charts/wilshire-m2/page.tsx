import type { Metadata } from "next";
import Link from "next/link";
import { WilshireM2Panel } from "@/components/charts/WilshireM2Panel";

export const metadata: Metadata = {
  title: "Wilshire 5000 / US M2",
  description:
    "Wilshire 5000 index divided by US M2 money supply — educational macro ratio chart for Adirindin Finance (NFA).",
};

export default function WilshireM2ChartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        <Link href="/charts" className="hover:underline">
          ← Charts
        </Link>
        {" · "}Macro
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Wilshire 5000 / US M2
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Classic equity / money-supply ratio framing. Educational content only —
        not financial advice (NFA).
      </p>

      <div className="mt-8">
        <WilshireM2Panel />
      </div>
    </div>
  );
}
