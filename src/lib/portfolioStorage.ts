import {
  DEFAULT_PORTFOLIO,
  HOLDING_COLORS,
  PORTFOLIO_STORAGE_KEY,
  type PortfolioConfig,
  type PortfolioHolding,
} from "./portfolioTypes";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeHolding(raw: Partial<PortfolioHolding>, index: number): PortfolioHolding | null {
  const ticker = typeof raw.ticker === "string" ? raw.ticker.trim().toUpperCase() : "";
  const quantity = Number(raw.quantity);
  const costBasisAud = Number(raw.costBasisAud);
  if (!ticker || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(costBasisAud) || costBasisAud < 0) return null;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
    ticker,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : undefined,
    quantity,
    costBasisAud,
    color:
      typeof raw.color === "string" && raw.color
        ? raw.color
        : HOLDING_COLORS[index % HOLDING_COLORS.length],
    acquiredAt:
      typeof raw.acquiredAt === "string" && raw.acquiredAt.trim()
        ? raw.acquiredAt.trim()
        : undefined,
  };
}

export function normalizePortfolio(raw: Partial<PortfolioConfig> | null | undefined): PortfolioConfig {
  const holdingsIn = Array.isArray(raw?.holdings) ? raw!.holdings : [];
  const holdings: PortfolioHolding[] = [];
  holdingsIn.forEach((h, i) => {
    const n = normalizeHolding(h as Partial<PortfolioHolding>, i);
    if (n) holdings.push(n);
  });

  const cash = raw?.availableCashAud;
  const availableCashAud =
    cash === null || cash === undefined
      ? null
      : Number.isFinite(Number(cash))
        ? Number(cash)
        : null;

  return {
    name:
      typeof raw?.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : DEFAULT_PORTFOLIO.name,
    currency: "AUD",
    availableCashAud,
    holdings,
  };
}

/** Merge seed JSON defaults with localStorage overlay (browser only). */
export function loadPortfolioFromSources(seed: Partial<PortfolioConfig>): PortfolioConfig {
  const base = normalizePortfolio({ ...DEFAULT_PORTFOLIO, ...seed, holdings: seed.holdings ?? [] });

  if (typeof window === "undefined") return base;

  try {
    const raw = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<PortfolioConfig>;
    return normalizePortfolio(parsed);
  } catch {
    return base;
  }
}

export function savePortfolioToStorage(portfolio: PortfolioConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(normalizePortfolio(portfolio)));
  } catch {
    /* quota / private mode */
  }
}

export function clearPortfolioStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function createHoldingId(): string {
  return newId();
}

export function exportPortfolioJson(portfolio: PortfolioConfig): string {
  return JSON.stringify(normalizePortfolio(portfolio), null, 2);
}

export function importPortfolioJson(text: string): PortfolioConfig {
  const parsed = JSON.parse(text) as Partial<PortfolioConfig>;
  return normalizePortfolio(parsed);
}
