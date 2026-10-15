import type { Metadata } from "next";
import { GlobalLiquidityPanel } from "@/components/charts/GlobalLiquidityPanel";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";

export const metadata: Metadata = {
  title: "Global liquidity",
  description: "Fed and ECB balance sheets and US net liquidity: how much money the big central banks are putting into the system, and whether it is growing or shrinking.",
};

export default function GlobalLiquidityPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Macro" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Global liquidity</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        How much money the big central banks are putting into the system, and whether it is growing or shrinking.
      </p>
      <div className="mt-6">
        <GlobalLiquidityPanel />
      </div>
    </div>
  );
}
