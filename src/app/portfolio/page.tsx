import type { Metadata } from "next";
import { PortfolioShell } from "@/components/portfolio/PortfolioShell";
import { DEFAULT_PORTFOLIO, type PortfolioConfig } from "@/lib/portfolioTypes";
import holdingsJson from "@/data/portfolioHoldings.json";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Empty portfolio tracker shell for Adirindin Finance — add holdings later. Educational only; not financial advice.",
};

function loadPortfolio(): PortfolioConfig {
  const raw = holdingsJson as Partial<PortfolioConfig>;
  return {
    name: raw.name?.trim() || DEFAULT_PORTFOLIO.name,
    currency: "AUD",
    availableCashAud:
      raw.availableCashAud === undefined ? DEFAULT_PORTFOLIO.availableCashAud : raw.availableCashAud,
    holdings: Array.isArray(raw.holdings) ? raw.holdings : [],
  };
}

export default function PortfolioPage() {
  const portfolio = loadPortfolio();

  return (
    <div className="min-h-full bg-black">
      <PortfolioShell portfolio={portfolio} />
    </div>
  );
}
