/**
 * Global liquidity: Fed + ECB balance sheets and US net liquidity, from public FRED CSVs.
 * Shared by /api/global-liquidity, the Charts tile and the chart page.
 *
 * Bank of Japan assets are deliberately NOT used: the BoJ copyright terms
 * (https://www.boj.or.jp/en/about/copyright.htm) exclude commercial reproduction and
 * altering content without prior permission.
 */

export type Zone = { key: string; label: string; min: number; max: number; color: string };

export const LIQ_ZONES: Zone[] = [
  { key: "shrink-fast", label: "Shrinking fast", min: 0, max: 20, color: "#ef4444" },
  { key: "shrink", label: "Shrinking", min: 20, max: 40, color: "#fb923c" },
  { key: "flat", label: "Flat", min: 40, max: 60, color: "#60a5fa" },
  { key: "grow", label: "Growing", min: 60, max: 80, color: "#4ade80" },
  { key: "grow-fast", label: "Growing fast", min: 80, max: 100, color: "#10b981" },
];
export const LIQ_HYSTERESIS = 5;

export function liqZoneFor(p: number): Zone {
  for (const z of LIQ_ZONES) if (p < z.max) return z;
  return LIQ_ZONES[LIQ_ZONES.length - 1]!;
}

/** Zone per point; the label only moves once the percentile is LIQ_HYSTERESIS past the line it crossed. */
export function liqZonesWithHysteresis(ps: Array<number | null>, band = LIQ_HYSTERESIS): Array<Zone | null> {
  let cur: Zone | null = null;
  return ps.map((p) => {
    if (p == null) return cur;
    const z = liqZoneFor(p);
    if (!cur) cur = z;
    else if (z.key !== cur.key) {
      const boundary = z.min >= cur.max ? cur.max : cur.min;
      if (Math.abs(p - boundary) >= band) cur = z;
    }
    return cur;
  });
}

/** FRED series used. Units as published on FRED. */
export const SERIES = {
  WALCL: "Fed total assets (US$ m, weekly)",
  WTREGEN: "Treasury General Account (US$ m, weekly)",
  RRPONTSYD: "Overnight reverse repo (US$ bn, daily)",
  ECBASSETSW: "Eurosystem total assets (€ m, weekly)",
  DEXUSEU: "US$ per euro (Fed H.10, daily)",
  M2SL: "US M2 (US$ bn, monthly)",
} as const;
export type SeriesId = keyof typeof SERIES;
export const SERIES_IDS = Object.keys(SERIES) as SeriesId[];

/** Month-end values: [YYYY-MM, value]. The current month uses the latest print so far. */
export type MonthSeries = Array<[string, number]>;

export function parseFredCsv(text: string): Array<[string, number]> {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2 || !/date/i.test(lines[0]!)) throw new Error("not a FRED CSV");
  const out: Array<[string, number]> = [];
  for (let i = 1; i < lines.length; i++) {
    const [d, v] = lines[i]!.split(",");
    const n = Number(v);
    if (d && v && v !== "." && Number.isFinite(n)) out.push([d.trim(), n]);
  }
  if (out.length < 24) throw new Error("too few observations");
  return out;
}

export function toMonthly(obs: Array<[string, number]>): MonthSeries {
  const m = new Map<string, number>();
  for (const [d, v] of obs) m.set(d.slice(0, 7), v);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export type LiqRow = {
  /** YYYY-MM */
  d: string;
  /** Levels, US$ trillion */
  netliq: number | null;
  cbFx: number | null;
  cbUsd: number | null;
  m2: number | null;
  /** Growth, % (6m annualised, 12m) */
  g6: Record<LineKey, number | null>;
  g12: Record<LineKey, number | null>;
  /** Composite score (σ) and its 10y percentile */
  comp: number | null;
  pct: number | null;
};
export type LineKey = "netliq" | "cbFx" | "cbUsd" | "m2";

export type LiqResult = {
  rows: LiqRow[];
  fixedEurUsd: number;
  latest: {
    d: string;
    netliq: number | null;
    netliq12: number | null;
    cbFx12: number | null;
    cbUsd: number | null;
    cbUsd12: number | null;
    m2_12: number | null;
    comp: number | null;
    pct: number | null;
    zone: Zone | null;
  };
  lastTurn: { d: string; monthsAgo: number; dir: "up" | "down" } | null;
};

const monthsBetween = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));

const nextMonth = (d: string) => {
  let y = Number(d.slice(0, 4));
  let m = Number(d.slice(5, 7)) + 1;
  if (m > 12) {
    m = 1;
    y++;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
};

const START = "2003-01";
const Z_WIN = 60;
const Z_MIN = 36;
const P_WIN = 120;
const P_MIN = 36;

function zTrailing(xs: Array<number | null>): Array<number | null> {
  return xs.map((x, i) => {
    if (x == null) return null;
    const w = xs.slice(Math.max(0, i - Z_WIN + 1), i + 1).filter((v): v is number => v != null);
    if (w.length < Z_MIN) return null;
    const mean = w.reduce((a, b) => a + b, 0) / w.length;
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / (w.length - 1));
    return sd > 0 ? (x - mean) / sd : null;
  });
}

export function computeLiquidity(series: Record<SeriesId, MonthSeries>): LiqResult {
  const maps = Object.fromEntries(SERIES_IDS.map((id) => [id, new Map(series[id])])) as Record<SeriesId, Map<string, number>>;
  const end = series.WALCL[series.WALCL.length - 1]![0];
  // Forward-fill each series up to 3 months (monthly M2 and weekly prints publish with a lag).
  const last: Partial<Record<SeriesId, { d: string; v: number }>> = {};
  const months: string[] = [];
  for (let d = START; d <= end; d = nextMonth(d)) months.push(d);
  const val = (id: SeriesId, d: string): number | null => {
    const v = maps[id].get(d);
    if (v != null) {
      last[id] = { d, v };
      return v;
    }
    const l = last[id];
    return l && monthsBetween(l.d, d) <= 3 ? l.v : null;
  };
  const raw = months.map((d) => {
    const o = {} as Record<SeriesId, number | null>;
    for (const id of SERIES_IDS) o[id] = val(id, d);
    return { d, ...o };
  });
  const fx15 = raw.filter((r) => r.d.startsWith("2015") && r.DEXUSEU != null).map((r) => r.DEXUSEU!);
  const fixedEurUsd = fx15.reduce((a, b) => a + b, 0) / fx15.length;

  const lv = raw.map((r) => {
    const fed = r.WALCL != null ? r.WALCL / 1e6 : null;
    const tga = r.WTREGEN != null ? r.WTREGEN / 1e6 : null;
    const rrp = r.RRPONTSYD != null ? r.RRPONTSYD / 1e3 : 0; // no RRP print = facility unused
    const ecb = r.ECBASSETSW != null ? r.ECBASSETSW / 1e6 : null;
    return {
      d: r.d,
      netliq: fed != null && tga != null ? fed - tga - rrp : null,
      cbFx: fed != null && ecb != null ? fed + ecb * fixedEurUsd : null,
      cbUsd: fed != null && ecb != null && r.DEXUSEU != null ? fed + ecb * r.DEXUSEU : null,
      m2: r.M2SL != null ? r.M2SL / 1e3 : null,
    };
  });
  const keys: LineKey[] = ["netliq", "cbFx", "cbUsd", "m2"];
  const growth = (k: LineKey, i: number, n: number) => {
    const a = lv[i - n]?.[k];
    const b = lv[i]![k];
    if (a == null || b == null || a <= 0) return null;
    return n === 6 ? ((b / a) ** 2 - 1) * 100 : (b / a - 1) * 100;
  };
  const g6s = lv.map((_, i) => Object.fromEntries(keys.map((k) => [k, growth(k, i, 6)])) as Record<LineKey, number | null>);
  const g12s = lv.map((_, i) => Object.fromEntries(keys.map((k) => [k, growth(k, i, 12)])) as Record<LineKey, number | null>);
  const zFx = zTrailing(g12s.map((g) => g.cbFx));
  const zNl = zTrailing(g12s.map((g) => g.netliq));
  const comp = zFx.map((a, i) => (a != null && zNl[i] != null ? 0.5 * a + 0.5 * zNl[i]! : null));
  const pct = comp.map((c, i) => {
    if (c == null) return null;
    const w = comp.slice(Math.max(0, i - P_WIN + 1), i + 1).filter((v): v is number => v != null);
    if (w.length < P_MIN) return null;
    return (w.filter((v) => v <= c).length / w.length) * 100;
  });
  const zones = liqZonesWithHysteresis(pct);
  const rows: LiqRow[] = lv.map((r, i) => ({ ...r, g6: g6s[i]!, g12: g12s[i]!, comp: comp[i]!, pct: pct[i]! }));

  // Last zero-crossing of the composite (real data only).
  let lastTurn: LiqResult["lastTurn"] = null;
  for (let i = rows.length - 1; i > 0; i--) {
    const a = rows[i - 1]!.comp;
    const b = rows[i]!.comp;
    if (a != null && b != null && (a < 0) !== (b < 0)) {
      lastTurn = { d: rows[i]!.d, monthsAgo: monthsBetween(rows[i]!.d, end), dir: b >= 0 ? "up" : "down" };
      break;
    }
  }
  const L = rows[rows.length - 1]!;
  return {
    rows,
    fixedEurUsd,
    latest: {
      d: L.d,
      netliq: L.netliq,
      netliq12: L.g12.netliq,
      cbFx12: L.g12.cbFx,
      cbUsd: L.cbUsd,
      cbUsd12: L.g12.cbUsd,
      m2_12: L.g12.m2,
      comp: L.comp,
      pct: L.pct,
      zone: zones[zones.length - 1] ?? null,
    },
    lastTurn,
  };
}

export type LiqPayload = {
  ok: boolean;
  error?: string;
  /** Latest observation date per series (YYYY-MM-DD). */
  lastObs: Partial<Record<SeriesId, string>>;
  /** Live fetch time (ISO). */
  generated: string;
  /** true when one or more series came from the stored copy. */
  stored: boolean;
  storedTo: string | null;
  storedSeries: SeriesId[];
} & Partial<LiqResult>;
