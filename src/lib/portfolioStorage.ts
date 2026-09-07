import {
  DEFAULT_PORTFOLIO,
  HOLDING_COLORS,
  PORTFOLIO_STORAGE_KEY,
  type AssetKind,
  type CostCurrency,
  type PortfolioConfig,
  type PortfolioHolding,
} from "./portfolioTypes";

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function asCurrency(raw: unknown, fallback: CostCurrency = "AUD"): CostCurrency {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return s === "USD" ? "USD" : fallback;
}

function asKind(raw: unknown): AssetKind {
  return raw === "collectable" ? "collectable" : "security";
}

/** Short display code for collectables (not a Yahoo ticker). */
export function collectableTickerFromName(name: string): string {
  const cleaned = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  return cleaned || "ITEM";
}

/**
 * Normalize one holding. Migrates legacy rows that only had `costBasisAud`
 * (treated as AUD) and no `kind` (defaults to security). Does not wipe data.
 */
function normalizeHolding(raw: Record<string, unknown>, index: number): PortfolioHolding | null {
  const kind = asKind(raw.kind);
  const costCurrency = asCurrency(raw.costCurrency, "AUD");

  // Legacy: costBasisAud → costBasis (AUD). Prefer explicit costBasis when present.
  const legacyAud = Number(raw.costBasisAud);
  const explicitCost = Number(raw.costBasis);
  let costBasis: number;
  if (Number.isFinite(explicitCost) && explicitCost >= 0) {
    costBasis = explicitCost;
  } else if (Number.isFinite(legacyAud) && legacyAud >= 0) {
    costBasis = legacyAud;
  } else {
    costBasis = 0;
  }

  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : undefined;
  const notes =
    typeof raw.notes === "string" && raw.notes.trim() ? raw.notes.trim() : undefined;
  const acquiredAt =
    typeof raw.acquiredAt === "string" && raw.acquiredAt.trim()
      ? raw.acquiredAt.trim()
      : undefined;
  const color =
    typeof raw.color === "string" && raw.color
      ? raw.color
      : HOLDING_COLORS[index % HOLDING_COLORS.length];

  if (kind === "collectable") {
    if (!name) return null;
    const estimatedValue = Number(raw.estimatedValue);
    if (!Number.isFinite(estimatedValue) || estimatedValue < 0) return null;
    const estimatedValueCurrency = asCurrency(
      raw.estimatedValueCurrency,
      "AUD",
    );
    const quantityRaw = Number(raw.quantity);
    const quantity =
      Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
    const tickerRaw =
      typeof raw.ticker === "string" && raw.ticker.trim()
        ? raw.ticker.trim().toUpperCase()
        : collectableTickerFromName(name);

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
      kind: "collectable",
      ticker: tickerRaw,
      name,
      quantity,
      costBasis,
      costCurrency,
      estimatedValue,
      estimatedValueCurrency,
      notes,
      color,
      acquiredAt,
    };
  }

  // Security
  const ticker = typeof raw.ticker === "string" ? raw.ticker.trim().toUpperCase() : "";
  const quantity = Number(raw.quantity);
  if (!ticker || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(costBasis) || costBasis < 0) return null;

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
    kind: "security",
    ticker,
    name,
    quantity,
    costBasis,
    costCurrency,
    color,
    acquiredAt,
  };
}

export function normalizePortfolio(raw: Partial<PortfolioConfig> | null | undefined): PortfolioConfig {
  const holdingsIn = Array.isArray(raw?.holdings) ? raw!.holdings : [];
  const holdings: PortfolioHolding[] = [];
  holdingsIn.forEach((h, i) => {
    const n = normalizeHolding(h as unknown as Record<string, unknown>, i);
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
