import type { Metadata } from "next";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { GlobalEquitiesPanel } from "@/components/charts/GlobalEquitiesPanel";
import { MobileViewHint } from "@/components/ui/MobileViewHint";

export const metadata: Metadata = {
  title: "World equities drawdown",
  description:
    "Heuristic phase for developed-world equities from drawdown off the all-time high (URTH, MSCI World proxy) with a volatility note from the OFR Financial Stress Index.",
};

export default function GlobalEquitiesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <MobileViewHint />
      <ChartsBackLink category="Macro" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        World equities drawdown
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        How far developed-world shares sit below their all-time high, with a volatility note from
        the OFR Financial Stress Index.
      </p>

      <div className="mt-8">
        <GlobalEquitiesPanel />
      </div>
    </div>
  );
}
