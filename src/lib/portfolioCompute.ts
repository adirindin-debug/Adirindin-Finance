import {
  HOLDING_COLORS,
  type HoldingLive,
  type PortfolioConfig,
  type PortfolioLiveSummary,
  type QuoteResult,
} from "./portfolioTypes";

export function computeLiveHoldings(
  portfolio: PortfolioConfig,
  quotes: QuoteResult[],
): { holdings: HoldingLive[]; summary: PortfolioLiveSummary } {
  const quoteMap = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

  const base: HoldingLive[] = portfolio.holdings.map((h, i) => {
    const q = quoteMap.get(h.ticker.toUpperCase());
    const priceAud = q?.priceAud ?? null;
    const costTotalAud = h.quantity * h.costBasisAud;
    const marketValueAud =
      priceAud != null && Number.isFinite(priceAud) ? h.quantity * priceAud : null;
    const gainAud =
      marketValueAud != null ? marketValueAud - costTotalAud : null;
    const gainPct =
      gainAud != null && costTotalAud > 0 ? (gainAud / costTotalAud) * 100 : null;

    return {
      ...h,
      color: h.color ?? HOLDING_COLORS[i % HOLDING_COLORS.length],
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
      ? portfolio.availableCashAud
      : 0;
  const totalMarketValueAud = investedValueAud + cashAud;
  const totalGainAud = investedValueAud - totalCostAud;
  const totalGainPct = totalCostAud > 0 ? (totalGainAud / totalCostAud) * 100 : null;

  const weightBase = investedValueAud > 0 ? investedValueAud : 0;
  const holdings = base.map((h) => ({
    ...h,
    weightPct:
      weightBase > 0 && h.marketValueAud != null
        ? (h.marketValueAud / weightBase) * 100
        : null,
  }));

  // Sort by market value desc (highest holdings)
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
