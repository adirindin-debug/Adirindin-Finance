import type { Metadata } from "next";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { SeasonalityPanel } from "@/components/charts/SeasonalityPanel";

export const metadata: Metadata = {
  title: "Equities seasonality · monthly & quarterly returns",
  description:
    "Year-by-month heatmap of MSCI World (URTH) and S&P 500 returns with the share of past years each month or quarter closed green. History, not a forecast. Not financial advice.",
};

export default function EquitiesSeasonalityPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Seasonality" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Equities seasonality</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Every month (or quarter) of global equities, tracked by MSCI World, as a green or red tile, with how often each
        one has closed higher in past years. Switch to the S&amp;P 500 above the grid. A record of what happened, not a
        forecast. Research tool only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <SeasonalityPanel market="equities" />
      </div>
    </div>
  );
}
