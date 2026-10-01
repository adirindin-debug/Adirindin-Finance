import {
  CASH_COLOR,
  HOLDING_COLORS,
  type CostCurrency,
  type HoldingLive,
  type PortfolioConfig,
  type PortfolioLiveSummary,
  type PositionReturnWindow,
  type QuoteResult,
} from "./portfolioTypes";

/** Convert an amount in costCurrency to AUD using audPerUsd (AUD per 1 USD). */
export function toAud(
  amount: number,
  currency: CostCurrency | string,
  audPerUsd: number | null,
): number {
  const c = (currency || "AUD").toUpperCase();
  if (c === "AUD") return amount;
  if (c === "USD") {
    if (audPerUsd == null || !(audPerUsd > 0)) return amount; // fallback 1:1 if FX missing
    return amount * audPerUsd;
  }
  if (audPerUsd == null || !(audPerUsd > 0)) return amount;
  return amount * audPerUsd;
}

export function computeLiveHoldings(
  portfolio: PortfolioConfig,
  quotes: QuoteResult[],
  audPerUsd: number | null = null,
): { holdings: HoldingLive[]; summary: PortfolioLiveSummary } {
  const quoteMap = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

  const base: HoldingLive[] = portfolio.holdings.map((h, i) => {
    const color = h.color ?? HOLDING_COLORS[i % HOLDING_COLORS.length];

    if (h.kind === "collectable") {
      const estCur = h.estimatedValueCurrency ?? "AUD";
      const est = h.estimatedValue ?? 0;
      const unitAud = toAud(est, estCur, audPerUsd);
      const marketValueAud = unitAud * h.quantity;
      const costTotalAud = toAud(h.costBasis, h.costCurrency, audPerUsd) * h.quantity;
      const hasCost = h.costBasis > 0;
      const gainAud = hasCost ? marketValueAud - costTotalAud : null;
      const gainPct =
        hasCost && costTotalAud > 0 ? (gainAud! / costTotalAud) * 100 : null;

      return {
        ...h,
        color,
        priceAud: unitAud,
        marketValueAud,
        costTotalAud: hasCost ? costTotalAud : 0,
        gainAud,
        gainPct,
        weightPct: null,
      };
    }

    // Security
    const q = quoteMap.get(h.ticker.toUpperCase());
    const priceAud = q?.priceAud ?? null;
    const costPerUnitAud = toAud(h.costBasis, h.costCurrency, audPerUsd);
    const costTotalAud = h.quantity * costPerUnitAud;
    const marketValueAud =
      priceAud != null && Number.isFinite(priceAud) ? h.quantity * priceAud : null;
    const gainAud =
      marketValueAud != null ? marketValueAud - costTotalAud : null;
    const gainPct =
      gainAud != null && costTotalAud > 0 ? (gainAud / costTotalAud) * 100 : null;

    return {
      ...h,
      color,
      priceAud,
      marketValueAud,
      costTotalAud,
      gainAud,
      gainPct,
      weightPct: null,
    };
  });

  const investedValueAud = base.reduce(
    (s, h) => s + (h.marketValueAud ?? 0),
    0,
  );
  const totalCostAud = base.reduce((s, h) => s + h.costTotalAud, 0);
  const cashAud =
    portfolio.availableCashAud != null && Number.isFinite(portfolio.availableCashAud)
      ? Math.max(0, portfolio.availableCashAud)
      : 0;
  const totalMarketValueAud = investedValueAud + cashAud;
  const totalGainAud = investedValueAud - totalCostAud;
  const totalGainPct = totalCostAud > 0 ? (totalGainAud / totalCostAud) * 100 : null;

  // Weights vs full portfolio (invested + cash) so cash can appear as a slice
  const weightBase = totalMarketValueAud > 0 ? totalMarketValueAud : 0;
  const holdings = base.map((h) => ({
    ...h,
    weightPct:
      weightBase > 0 && h.marketValueAud != null
        ? (h.marketValueAud / weightBase) * 100
        : null,
  }));

  holdings.sort((a, b) => (b.marketValueAud ?? 0) - (a.marketValueAud ?? 0));

  return {
    holdings,
    summary: {
      totalMarketValueAud,
      totalCostAud,
      totalGainAud,
      totalGainPct,
      investedValueAud,
      cashAud,
    },
  };
}

export function cashWeightPct(cashAud: number, totalMarketValueAud: number): number | null {
  if (!(totalMarketValueAud > 0) || !(cashAud > 0)) return null;
  return (cashAud / totalMarketValueAud) * 100;
}

export { CASH_COLOR };

/** Display currency for portfolio UI (bookkeeping stays AUD). */
/** Portfolio value denominations (bookkeeping stays AUD; display only). */
export const DISPLAY_CURRENCIES = [
  "USD",
  "AUD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "CHF",
  "NZD",
  "CNY",
  "BTC",
] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export function isDisplayCurrency(v: unknown): v is DisplayCurrency {
  return typeof v === "string" && (DISPLAY_CURRENCIES as readonly string[]).includes(v);
}

/**
 * Convert an AUD amount to the selected display currency.
 * displayPerAud = units of the display currency per 1 AUD (ignored for AUD).
 */
export function audToDisplay(
  amountAud: number | null | undefined,
  display: DisplayCurrency,
  displayPerAud: number | null,
): number | null {
  if (amountAud == null || !Number.isFinite(amountAud)) return null;
  if (display === "AUD") return amountAud;
  if (displayPerAud == null || !(displayPerAud > 0)) return null;
  return amountAud * displayPerAud;
}

/** Prefix symbol: A$ / US$ as before, ₿ for BTC, Intl symbols for the rest (€, £, ¥, CA$, NZ$, CN¥, CHF). */
export function currencySymbol(currency: DisplayCurrency): string {
  if (currency === "AUD") return "A$";
  if (currency === "USD") return "US$";
  if (currency === "BTC") return "₿";
  try {
    const sym = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value;
    if (sym) return /[A-Za-z]$/.test(sym) ? `${sym} ` : sym;
  } catch {
    // fall through
  }
  return `${currency} `;
}

/** Unsigned BTC amount: ₿ with up to 8 dp, or sats below ₿0.001. */
function formatBtcAbs(abs: number): string {
  if (abs > 0 && abs < 0.001) return `${Math.round(abs * 1e8).toLocaleString("en-AU")} sats`;
  return `₿${abs.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`;
}

/** Unsigned money string (JPY always 0 dp; BTC per formatBtcAbs). */
export function formatMoneyAbs(abs: number, currency: DisplayCurrency, digits = 2): string {
  if (currency === "BTC") return formatBtcAbs(abs);
  const d = currency === "JPY" ? 0 : digits;
  return `${currencySymbol(currency)}${abs.toLocaleString("en-AU", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}

/** Format money in the display currency (en-AU numerals; A$ / US$ unchanged). */
export function formatMoney(
  n: number | null | undefined,
  currency: DisplayCurrency = "AUD",
  digits = 2,
): string {
  if (n == null || !Number.isFinite(n)) return `${currencySymbol(currency)}—`;
  const body = formatMoneyAbs(Math.abs(n), currency, digits);
  return n < 0 ? `-${body}` : body;
}

/** Holdings-row unit price: "$" for AUD and "US$" for USD as before. */
export function formatUnitPrice(n: number | null | undefined, currency: DisplayCurrency): string {
  if (currency === "BTC") {
    return n == null || !Number.isFinite(n) ? "₿—" : formatBtcAbs(Math.abs(n));
  }
  const prefix = currency === "AUD" ? "$" : currencySymbol(currency);
  if (currency === "JPY" && n != null && Number.isFinite(n) && Math.abs(n) >= 100) {
    return `${prefix}${Math.round(n).toLocaleString("en-AU")}`;
  }
  return `${prefix}${formatPrice(n)}`;
}

export function formatAud(n: number | null | undefined, digits = 2): string {
  return formatMoney(n, "AUD", digits);
}

export function formatGain(
  gain: number | null,
  pct: number | null,
  currency: DisplayCurrency = "AUD",
): string {
  if (gain == null || pct == null) return "— · —%";
  const sign = gain >= 0 ? "+" : "";
  const g = formatMoneyAbs(Math.abs(gain), currency, 2);
  const p = Math.abs(pct).toFixed(2);
  const pctSign = pct >= 0 ? "+" : "−";
  return `${sign}${g} · ${pctSign}${p}%`;
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1000) {
    return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (n >= 1) {
    return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export type PeriodTickerReturn = {
  ticker: string;
  startPriceAud: number | null;
  endPriceAud: number | null;
  returnPct: number | null;
};

/**
 * Overlay period price returns onto live holdings (including ALL = asset all-time).
 * Cost-basis mode is handled by the caller (skip overlay when Vs cost is on).
 * Collectables / missing history → gainAud/gainPct null (UI shows —).
 */
export function applyPeriodReturns(
  holdings: HoldingLive[],
  periodReturns: PeriodTickerReturn[] | null,
  _window: PositionReturnWindow,
): HoldingLive[] {
  if (!periodReturns) return holdings;
  const map = new Map(
    periodReturns.map((r) => [r.ticker.toUpperCase(), r]),
  );
  return holdings.map((h) => {
    if (h.kind === "collectable") {
      return { ...h, gainAud: null, gainPct: null };
    }
    const r = map.get(h.ticker.toUpperCase());
    if (
      !r ||
      r.startPriceAud == null ||
      r.endPriceAud == null ||
      r.returnPct == null ||
      !(r.startPriceAud > 0)
    ) {
      return { ...h, gainAud: null, gainPct: null };
    }
    const gainAud = h.quantity * (r.endPriceAud - r.startPriceAud);
    return {
      ...h,
      gainAud,
      gainPct: r.returnPct,
    };
  });
}

export type PeriodSummary = {
  totalGainAud: number | null;
  totalGainPct: number | null;
  /** True when at least one security contributed period P&L */
  available: boolean;
};

/**
 * Portfolio-level period P&L from current quantities × start/end AUD unit prices
 * (including ALL = asset all-time). Cost-basis summary is supplied by the caller
 * when Vs cost is on — do not branch on window === "ALL" here.
 * Cash and collectables are flat (0 contribution). Missing history skipped.
 */
export function computePeriodSummary(
  holdings: HoldingLive[],
  periodReturns: PeriodTickerReturn[] | null,
  _window: PositionReturnWindow,
  _costSummary: PortfolioLiveSummary,
): PeriodSummary {
  if (!periodReturns) {
    return { totalGainAud: null, totalGainPct: null, available: false };
  }
  const map = new Map(
    periodReturns.map((r) => [r.ticker.toUpperCase(), r]),
  );
  let startTotal = 0;
  let endTotal = 0;
  let any = false;
  for (const h of holdings) {
    if (h.kind !== "security") continue;
    const r = map.get(h.ticker.toUpperCase());
    if (
      !r ||
      r.startPriceAud == null ||
      r.endPriceAud == null ||
      !(r.startPriceAud > 0)
    ) {
      continue;
    }
    startTotal += h.quantity * r.startPriceAud;
    endTotal += h.quantity * r.endPriceAud;
    any = true;
  }
  if (!any || !(startTotal > 0)) {
    return { totalGainAud: null, totalGainPct: null, available: false };
  }
  const totalGainAud = endTotal - startTotal;
  const totalGainPct = (totalGainAud / startTotal) * 100;
  return { totalGainAud, totalGainPct, available: true };
}

export function returnWindowHint(window: PositionReturnWindow): string {
  switch (window) {
    case "1D":
      return "1D · price change";
    case "1W":
      return "1W · price change";
    case "1M":
      return "1M · price change";
    case "YTD":
      return "YTD · price change";
    case "1Y":
      return "1Y · price change";
    case "3Y":
      return "3Y · price change";
    case "4Y":
      return "4Y · price change";
    case "5Y":
      return "5Y · price change";
    case "10Y":
      return "10Y · price change";
    case "20Y":
      return "20Y · price change";
    case "ALL":
      return "ALL · asset price";
  }
}

/** Hint when the Vs cost toggle is on (personal cost-basis gains). */
export function returnWindowHintVsCost(): string {
  return "ALL · vs cost";
}
