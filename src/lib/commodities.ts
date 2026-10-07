/**
 * Commodity charts — shared (client-safe) types, metadata and helpers.
 * Every series is a public, attributable source; nothing here is invented.
 * Educational · NFA.
 */

export type CommodityId = "gold" | "silver" | "copper" | "nickel" | "lithium" | "ironOre";

export type CommodityPoint = { t: number; c: number };

export type CommoditySeries = {
  id: CommodityId;
  label: string;
  unit: string;
  frequency: "daily" | "monthly";
  source: string;
  sourceUrl: string;
  /** Short benchmark description (e.g. "LME nickel, melting grade, CIF European ports"). */
  benchmark: string;
  points: CommodityPoint[];
  /** false = served from the dated snapshot or last-good memory. */
  live: boolean;
  snapshot?: boolean;
  stale?: boolean;
  asOf: string;
};

export type CommoditiesPayload = {
  ok: boolean;
  asOf?: string;
  series?: Partial<Record<CommodityId, CommoditySeries>>;
  errors?: string[];
  note?: string;
  error?: string;
};

export type CommodityTileLine = {
  id: CommodityId;
  label: string;
  color: string;
  /** Rebased to 100 at the first month of the window. */
  points: { t: number; v: number }[];
};

export type CommodityTilePayload = {
  ok: boolean;
  asOf?: string;
  windowYears?: number;
  lines?: CommodityTileLine[];
  gold?: { c: number; t: number; unit: string } | null;
  live?: boolean;
  error?: string;
};

export const COMMODITY_ORDER: CommodityId[] = [
  "gold",
  "silver",
  "copper",
  "nickel",
  "lithium",
  "ironOre",
];

export const COMMODITY_META: Record<
  CommodityId,
  { label: string; color: string; defaultLog: boolean; decimals: number }
> = {
  gold: { label: "Gold", color: "#f0c14a", defaultLog: true, decimals: 0 },
  silver: { label: "Silver", color: "#c9d1dc", defaultLog: false, decimals: 2 },
  copper: { label: "Copper", color: "#e8834a", defaultLog: false, decimals: 3 },
  nickel: { label: "Nickel", color: "#5fc4a8", defaultLog: false, decimals: 0 },
  lithium: { label: "Lithium", color: "#a78bfa", defaultLog: false, decimals: 0 },
  ironOre: { label: "Iron ore", color: "#d0644f", defaultLog: false, decimals: 2 },
};

export const TILE_WINDOW_YEARS = 5;

function monthKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Last print in each calendar month (monthly series pass through unchanged). */
export function toMonthly(points: CommodityPoint[]): CommodityPoint[] {
  const map = new Map<string, CommodityPoint>();
  for (const p of points) map.set(monthKey(p.t), p);
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/** Monthly lines rebased to 100 at each series' first month inside the window. */
export function buildTileLines(
  series: Partial<Record<CommodityId, CommoditySeries>>,
  windowYears: number = TILE_WINDOW_YEARS,
  nowSec: number = Math.floor(Date.now() / 1000),
): CommodityTileLine[] {
  const start = nowSec - Math.round(windowYears * 365.2425 * 86400);
  const out: CommodityTileLine[] = [];
  for (const id of COMMODITY_ORDER) {
    const s = series[id];
    if (!s || s.points.length < 2) continue;
    const monthly = toMonthly(s.points).filter((p) => p.t >= start && p.c > 0);
    if (monthly.length < 6) continue;
    const base = monthly[0]!.c;
    out.push({
      id,
      label: COMMODITY_META[id].label,
      color: COMMODITY_META[id].color,
      points: monthly.map((p) => ({ t: p.t, v: Math.round((p.c / base) * 1000) / 10 })),
    });
  }
  return out;
}

export function fmtCommodityValue(id: CommodityId, c: number): string {
  if (!Number.isFinite(c)) return "—";
  const d = COMMODITY_META[id].decimals;
  return `$${c.toLocaleString("en-AU", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
