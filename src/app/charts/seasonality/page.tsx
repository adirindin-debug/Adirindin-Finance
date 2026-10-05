import type { Metadata } from "next";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { SeasonalityPanel } from "@/components/charts/SeasonalityPanel";

export const metadata: Metadata = {
  title: "Monthly & quarterly returns · BTC and S&P 500",
  description:
    "Year-by-month heatmap of BTC and S&P 500 returns with the share of past years each month or quarter closed green. History, not a forecast. Not financial advice.",
};

export default function SeasonalityPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Seasonality" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Monthly &amp; quarterly returns
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Every month (or quarter) of BTC and the S&amp;P 500 as a green or red tile, with how often each one has closed
        higher in past years. A record of what happened, not a forecast. Research tool only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <SeasonalityPanel />
      </div>
    </div>
  );
}
