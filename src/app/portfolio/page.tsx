import type { Metadata } from "next";
import { PortfolioShell } from "@/components/portfolio/PortfolioShell";
import { DEFAULT_PORTFOLIO, type PortfolioConfig } from "@/lib/portfolioTypes";
import { normalizePortfolio } from "@/lib/portfolioStorage";
import holdingsJson from "@/data/portfolioHoldings.json";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Track your holdings in AUD — live quotes, allocation, and P&L vs your cost basis. Educational only; not financial advice.",
};

function loadSeed(): PortfolioConfig {
  const raw = holdingsJson as Partial<PortfolioConfig>;
  return normalizePortfolio({
    name: raw.name?.trim() || DEFAULT_PORTFOLIO.name,
    currency: "AUD",
    availableCashAud:
      raw.availableCashAud === undefined ? DEFAULT_PORTFOLIO.availableCashAud : raw.availableCashAud,
    holdings: Array.isArray(raw.holdings) ? raw.holdings : [],
  });
}

export default function PortfolioPage() {
  const seed = loadSeed();

  return (
    <div className="min-h-full bg-black">
      <PortfolioShell seed={seed} />
    </div>
  );
}
