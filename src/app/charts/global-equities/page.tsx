import type { Metadata } from "next";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { GlobalEquitiesPanel } from "@/components/charts/GlobalEquitiesPanel";

export const metadata: Metadata = {
  title: "World equities drawdown",
  description:
    "Heuristic phase for developed-world equities from drawdown off the all-time high (URTH, MSCI World proxy) with a one-notch VIX tilt. Educational only (NFA).",
};

export default function GlobalEquitiesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Macro" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        World equities drawdown
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Where developed-world shares sit on the path from a hot market to washout and repair, from
        price drawdown plus public volatility data. Research tool only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <GlobalEquitiesPanel />
      </div>
    </div>
  );
}
