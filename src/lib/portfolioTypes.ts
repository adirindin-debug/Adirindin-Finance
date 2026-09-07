/** Portfolio tracker types — user-entered holdings + live quotes (AUD). */

export type AssetKind = "security" | "collectable";
export type CostCurrency = "AUD" | "USD";

export type PortfolioHolding = {
  /** Stable id for edit/delete (generated client-side) */
  id: string;
  /** Security (Yahoo ticker) vs collectable (manual estimate) */
  kind: AssetKind;
  /**
   * Exchange ticker for securities, e.g. "CBA.AX" / "MSTR" / "BTC-USD".
   * For collectables: a short display code derived from the label (not a Yahoo symbol).
   */
  ticker: string;
  /** Display name (optional for securities; required label for collectables) */
  name?: string;
  /** Units held (collectables typically 1) */
  quantity: number;
  /**
   * Cost basis in `costCurrency`.
   * Securities: average cost per unit.
   * Collectables: optional total cost (gains shown only when set > 0).
   */
  costBasis: number;
  /** Currency the costBasis was entered in */
  costCurrency: CostCurrency;
  /** Collectable: estimated current value in estimatedValueCurrency */
  estimatedValue?: number;
  estimatedValueCurrency?: CostCurrency;
  /** Collectable notes */
  notes?: string;
  /** Optional brand/accent color for allocation legend */
  color?: string;
  /**
   * Optional purchase date (ISO YYYY-MM-DD).
   * Used to reconstruct performance history: qty held from this date onward.
   * If missing, holding is assumed held for the full chart window from the
   * earlier of window start or first available price for that ticker.
   */
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

/** Cash slice colour in allocation donut / list */
export const CASH_COLOR = "#71717a";

export type QuoteResult = {
  ticker: string;
  price: number;
  currency: string;
  priceAud: number;
  name?: string;
};

export type HoldingLive = PortfolioHolding & {
  /** Live AUD unit price (securities) or estimated AUD unit value (collectables) */
  priceAud: number | null;
  marketValueAud: number | null;
  /** Cost total converted to AUD using live FX when costCurrency is USD */
  costTotalAud: number;
  gainAud: number | null;
  gainPct: number | null;
  /** Weight vs total portfolio (invested + cash) */
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
