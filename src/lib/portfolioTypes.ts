/** Portfolio tracker types — user-entered holdings + live quotes (AUD). */

export type PortfolioHolding = {
  /** Stable id for edit/delete (generated client-side) */
  id: string;
  /** Exchange ticker, e.g. "CBA.AX" or "MSTR" or "BTC-USD" */
  ticker: string;
  /** Display name (optional) */
  name?: string;
  /** Units held */
  quantity: number;
  /** Average cost basis per unit in AUD */
  costBasisAud: number;
  /** Optional brand/accent color for allocation legend */
  color?: string;
  /** Optional purchase date (ISO) — reserved for performance history */
  acquiredAt?: string;
};

export type PortfolioConfig = {
  /** User-facing portfolio name */
  name: string;
  /** ISO currency code for display */
  currency: "AUD";
  /** Cash balance (AUD); null = unset */
  availableCashAud: number | null;
  holdings: PortfolioHolding[];
};

/** Seed when JSON + localStorage are empty — no fabricated positions. */
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

export const PORTFOLIO_STORAGE_KEY = "adirindin-portfolio-v1";

/** Palette for donut / legend when holding has no color */
export const HOLDING_COLORS = [
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#fbbf24",
  "#a78bfa",
  "#34d399",
  "#fb7185",
  "#38bdf8",
  "#c084fc",
  "#facc15",
];

export type QuoteResult = {
  ticker: string;
  price: number;
  currency: string;
  priceAud: number;
  name?: string;
};

export type HoldingLive = PortfolioHolding & {
  priceAud: number | null;
  marketValueAud: number | null;
  costTotalAud: number;
  gainAud: number | null;
  gainPct: number | null;
  weightPct: number | null;
  color: string;
};

export type PortfolioLiveSummary = {
  totalMarketValueAud: number;
  totalCostAud: number;
  totalGainAud: number;
  totalGainPct: number | null;
  investedValueAud: number;
  cashAud: number;
};
