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

export function formatAud(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "A$—";
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString("en-AU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (n < 0) return `-A$${formatted}`;
  return `A$${formatted}`;
}

export function formatGain(gain: number | null, pct: number | null): string {
  if (gain == null || pct == null) return "— · —%";
  const sign = gain >= 0 ? "+" : "";
  const g = Math.abs(gain).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const p = Math.abs(pct).toFixed(2);
  const pctSign = pct >= 0 ? "+" : "−";
  return `${sign}A$${g} · ${pctSign}${p}%`;
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
 * Overlay period price returns onto live holdings.
 * ALL → keep cost-basis gains. Other windows → AUD P&L from start→end unit price × qty.
 * Collectables / missing history → gainAud/gainPct null (UI shows —).
 */
export function applyPeriodReturns(
  holdings: HoldingLive[],
  periodReturns: PeriodTickerReturn[] | null,
  window: PositionReturnWindow,
): HoldingLive[] {
  if (window === "ALL" || !periodReturns) return holdings;
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
 * Portfolio-level period P&L from current quantities × start/end AUD unit prices.
 * Cash and collectables are flat (0 contribution). Missing history skipped.
 */
export function computePeriodSummary(
  holdings: HoldingLive[],
  periodReturns: PeriodTickerReturn[] | null,
  window: PositionReturnWindow,
  costSummary: PortfolioLiveSummary,
): PeriodSummary {
  if (window === "ALL") {
    return {
      totalGainAud: costSummary.totalGainAud,
      totalGainPct: costSummary.totalGainPct,
      available: costSummary.totalGainPct != null,
    };
  }
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
      return "ALL · vs cost";
  }
}
