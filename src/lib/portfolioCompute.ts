import {
  CASH_COLOR,
  HOLDING_COLORS,
  type CostCurrency,
  type HoldingLive,
  type PortfolioConfig,
  type PortfolioLiveSummary,
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
