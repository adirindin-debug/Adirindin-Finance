/**
 * Shared chart timeframe toggles for homepage compare + portfolio performance.
 * Canonical key is lowercase (API / localStorage). Labels are uppercase for UI chips.
 * Portfolio summary/holdings return window uses the same keys (via PortfolioTimeframe).
 * Educational — NFA.
 */

export const CHART_TIMEFRAME_STORAGE_KEY = "adirindin.chartTimeframe";

/** Canonical keys (homepage API + localStorage). */
export const CHART_TIMEFRAME_KEYS = [
  "1d",
  "1w",
  "1m",
  "ytd",
  "1y",
  "3y",
  "4y",
  "5y",
  "10y",
  "20y",
  "all",
] as const;

export type ChartTimeframeKey = (typeof CHART_TIMEFRAME_KEYS)[number];

export type ChartTimeframeDef = {
  key: ChartTimeframeKey;
  /** Chip label (1D, 1W, 1M, YTD, 1Y, …). */
  label: string;
  /** portfolio-history `?tf=` value (same as label for these windows). */
  portfolioTf: string;
};

export const CHART_TIMEFRAMES: readonly ChartTimeframeDef[] = [
  { key: "1d", label: "1D", portfolioTf: "1D" },
  { key: "1w", label: "1W", portfolioTf: "1W" },
  { key: "1m", label: "1M", portfolioTf: "1M" },
  { key: "ytd", label: "YTD", portfolioTf: "YTD" },
  { key: "1y", label: "1Y", portfolioTf: "1Y" },
  { key: "3y", label: "3Y", portfolioTf: "3Y" },
  { key: "4y", label: "4Y", portfolioTf: "4Y" },
  { key: "5y", label: "5Y", portfolioTf: "5Y" },
  { key: "10y", label: "10Y", portfolioTf: "10Y" },
  { key: "20y", label: "20Y", portfolioTf: "20Y" },
  { key: "all", label: "ALL", portfolioTf: "ALL" },
] as const;

/** Default when localStorage is empty / invalid. */
export const DEFAULT_CHART_TIMEFRAME: ChartTimeframeKey = "1y";

const KEY_SET = new Set<string>(CHART_TIMEFRAME_KEYS);

const LABEL_TO_KEY: Record<string, ChartTimeframeKey> = Object.fromEntries(
  CHART_TIMEFRAMES.map((t) => [t.label.toUpperCase(), t.key]),
) as Record<string, ChartTimeframeKey>;

/** Portfolio chip list (uppercase) — mirrors CHART_TIMEFRAMES. */
export const PORTFOLIO_CHART_TIMEFRAMES = [
  "1D",
  "1W",
  "1M",
  "YTD",
  "1Y",
  "3Y",
  "4Y",
  "5Y",
  "10Y",
  "20Y",
  "ALL",
] as const;

export type PortfolioChartTimeframe = (typeof PORTFOLIO_CHART_TIMEFRAMES)[number];

export function isChartTimeframeKey(raw: string | null | undefined): raw is ChartTimeframeKey {
  return typeof raw === "string" && KEY_SET.has(raw.toLowerCase());
}

/** Accept homepage key (`1y`) or portfolio label (`1Y` / `ytd`). */
export function parseChartTimeframe(
  raw: string | null | undefined,
  fallback: ChartTimeframeKey = DEFAULT_CHART_TIMEFRAME,
): ChartTimeframeKey {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (KEY_SET.has(lower)) return lower as ChartTimeframeKey;
  const fromLabel = LABEL_TO_KEY[trimmed.toUpperCase()];
  if (fromLabel) return fromLabel;
  return fallback;
}

export function toPortfolioTf(key: ChartTimeframeKey): PortfolioChartTimeframe {
  const found = CHART_TIMEFRAMES.find((t) => t.key === key);
  return (found?.portfolioTf as PortfolioChartTimeframe) ?? "1Y";
}

export function toHomepageKey(portfolioTf: string): ChartTimeframeKey {
  return parseChartTimeframe(portfolioTf, DEFAULT_CHART_TIMEFRAME);
}

export function readStoredChartTimeframe(
  fallback: ChartTimeframeKey = DEFAULT_CHART_TIMEFRAME,
): ChartTimeframeKey {
  if (typeof window === "undefined") return fallback;
  try {
    return parseChartTimeframe(
      window.localStorage.getItem(CHART_TIMEFRAME_STORAGE_KEY),
      fallback,
    );
  } catch {
    return fallback;
  }
}

export function writeStoredChartTimeframe(key: ChartTimeframeKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHART_TIMEFRAME_STORAGE_KEY, key);
  } catch {
    // ignore quota / private mode
  }
}

/** Human label for copy (e.g. "1-year", "year-to-date"). */
export function chartTimeframeLongLabel(key: ChartTimeframeKey): string {
  switch (key) {
    case "1d":
      return "1-day";
    case "1w":
      return "1-week";
    case "1m":
      return "1-month";
    case "ytd":
      return "year-to-date";
    case "1y":
      return "1-year";
    case "3y":
      return "3-year";
    case "4y":
      return "4-year";
    case "5y":
      return "5-year";
    case "10y":
      return "10-year";
    case "20y":
      return "20-year";
    case "all":
      return "All time";
  }
}

/** Portfolio-only: pin summary/holdings to ALL-time vs cost; lock Performance chart to 1Y. */
export const PORTFOLIO_RETURNS_VS_COST_KEY = "adirindin.portfolioReturnsVsCost";

export function readStoredReturnsVsCost(fallback = false): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_RETURNS_VS_COST_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredReturnsVsCost(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTFOLIO_RETURNS_VS_COST_KEY, on ? "1" : "0");
  } catch {
    // ignore quota / private mode
  }
}

/** Portfolio display currency (AUD bookkeeping; USD is display-only via AUDUSD). */
export const PORTFOLIO_DISPLAY_CURRENCY_KEY = "adirindin.portfolioDisplayCurrency";

export type PortfolioDisplayCurrency = "AUD" | "USD";

export function readStoredDisplayCurrency(
  fallback: PortfolioDisplayCurrency = "AUD",
): PortfolioDisplayCurrency {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PORTFOLIO_DISPLAY_CURRENCY_KEY);
    if (raw === "USD" || raw === "AUD") return raw;
    return fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredDisplayCurrency(c: PortfolioDisplayCurrency): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTFOLIO_DISPLAY_CURRENCY_KEY, c);
  } catch {
    // ignore quota / private mode
  }
}

