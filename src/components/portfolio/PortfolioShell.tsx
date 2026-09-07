"use client";

import type { PortfolioConfig } from "@/lib/portfolioTypes";
import { PortfolioSummary } from "./PortfolioSummary";
import { PerformanceChartEmpty } from "./PerformanceChartEmpty";
import { AllocationDonutEmpty } from "./AllocationDonutEmpty";
import { HoldingsListEmpty } from "./HoldingsListEmpty";

type Props = {
  portfolio: PortfolioConfig;
};

export function PortfolioShell({ portfolio }: Props) {
  const hasHoldings = portfolio.holdings.length > 0;

  return (
    <div className="mx-auto max-w-2xl bg-black px-4 py-8 sm:px-6 sm:py-10">
      <PortfolioSummary portfolioName={portfolio.name} hasHoldings={hasHoldings} />
      <PerformanceChartEmpty hasHoldings={hasHoldings} />
      <AllocationDonutEmpty holdings={portfolio.holdings} />
      <HoldingsListEmpty
        holdings={portfolio.holdings}
        availableCashAud={portfolio.availableCashAud}
      />

      <p className="mt-10 text-center text-[11px] leading-relaxed text-zinc-600">
        NFA: Educational tracker only · Not financial advice.
      </p>
    </div>
  );
}
