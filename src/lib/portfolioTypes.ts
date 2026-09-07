/** Portfolio tracker types — empty shell until the user pastes real holdings. */

export type PortfolioHolding = {
  /** Exchange ticker, e.g. "CBA.AX" or "MSTR" */
  ticker: string;
  /** Display name (optional) */
  name?: string;
  /** Units held */
  quantity: number;
  /** Average cost basis per unit in AUD */
  costBasisAud: number;
  /** Optional last price in AUD — leave unset for empty/live-later */
  lastPriceAud?: number;
  /** Optional brand/accent color for allocation legend */
  color?: string;
};

export type PortfolioConfig = {
  /** User-facing portfolio name */
  name: string;
  /** ISO currency code for display */
  currency: "AUD";
  /** Cash balance placeholder (AUD) */
  availableCashAud: number | null;
  holdings: PortfolioHolding[];
};

/** Edit this later — keep empty for the v1 shell (no fabricated positions). */
export const DEFAULT_PORTFOLIO: PortfolioConfig = {
  name: "Long term strategy",
  currency: "AUD",
  availableCashAud: null,
  holdings: [],
};

export const PERFORMANCE_BENCHMARKS = [
  { id: "portfolio", label: "This portfolio", color: "#4ade80" },
  { id: "ndx", label: "Nasdaq 100", color: "#9ca3af" },
  { id: "spx", label: "S&P 500", color: "#d1d5db" },
  { id: "aord", label: "All Ords", color: "#6b7280" },
] as const;

export const PORTFOLIO_TIMEFRAMES = ["1M", "YTD", "1Y", "ALL"] as const;
export type PortfolioTimeframe = (typeof PORTFOLIO_TIMEFRAMES)[number];
