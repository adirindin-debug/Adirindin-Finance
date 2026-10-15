/**
 * Global liquidity: Fed + ECB balance sheets and US net liquidity, from public FRED CSVs.
 * Shared by /api/global-liquidity, the Charts tile and the chart page.
 *
 * Bank of Japan assets are deliberately NOT used: the BoJ copyright terms
 * (https://www.boj.or.jp/en/about/copyright.htm) exclude commercial reproduction and
 * altering content without prior permission.
 */

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

export type LineKey = "cbUsd" | "netliq" | "cbFx" | "m2";
export const LINE_KEYS: LineKey[] = ["cbUsd", "netliq", "cbFx", "m2"];

export type LiqRow = {
  /** YYYY-MM */
  d: string;
  /** Levels, US$ trillion (null before a series starts) */
  netliq: number | null;
  cbFx: number | null;
  cbUsd: number | null;
  m2: number | null;
  /** Rate of change, % (6m annualised, 12m) */
  g6: Record<LineKey, number | null>;
  g12: Record<LineKey, number | null>;
};

export type Turn = { d: string; monthsAgo: number; dir: "up" | "down" };

/** Last month the 12-month rate of change crossed zero (real data only). */
export function lastRocTurn(rows: LiqRow[], k: LineKey, view: "g6" | "g12" = "g12"): Turn | null {
  const end = rows[rows.length - 1]?.d;
  if (!end) return null;
  for (let i = rows.length - 1; i > 0; i--) {
    const a = rows[i - 1]![view][k];
    const b = rows[i]![view][k];
    if (a != null && b != null && a < 0 !== b < 0) {
      return { d: rows[i]!.d, monthsAgo: monthsBetween(rows[i]!.d, end), dir: b >= 0 ? "up" : "down" };
    }
  }
  return null;
}

export type LiqResult = {
  rows: LiqRow[];
  fixedEurUsd: number;
  /** First month with data per line. */
  starts: Record<LineKey, string | null>;
  latest: {
    d: string;
    cbUsd: number | null;
    cbUsd12: number | null;
    netliq: number | null;
    netliq12: number | null;
    cbFx12: number | null;
    m2: number | null;
    m2_12: number | null;
  };
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

/** US M2 runs from 1959; Fed and ECB lines start Dec 2002 (WALCL). */
const START = "1959-01";

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
  const keys = LINE_KEYS;
  const growth = (k: LineKey, i: number, n: number) => {
    const a = lv[i - n]?.[k];
    const b = lv[i]![k];
    if (a == null || b == null || a <= 0) return null;
    return n === 6 ? ((b / a) ** 2 - 1) * 100 : (b / a - 1) * 100;
  };
  const g6s = lv.map((_, i) => Object.fromEntries(keys.map((k) => [k, growth(k, i, 6)])) as Record<LineKey, number | null>);
  const g12s = lv.map((_, i) => Object.fromEntries(keys.map((k) => [k, growth(k, i, 12)])) as Record<LineKey, number | null>);
  const rows: LiqRow[] = lv.map((r, i) => ({ ...r, g6: g6s[i]!, g12: g12s[i]! }));
  const starts = Object.fromEntries(keys.map((k) => [k, rows.find((r) => r[k] != null)?.d ?? null])) as Record<LineKey, string | null>;
  const L = rows[rows.length - 1]!;
  return {
    rows,
    fixedEurUsd,
    starts,
    latest: {
      d: L.d,
      cbUsd: L.cbUsd,
      cbUsd12: L.g12.cbUsd,
      netliq: L.netliq,
      netliq12: L.g12.netliq,
      cbFx12: L.g12.cbFx,
      m2: L.m2,
      m2_12: L.g12.m2,
    },
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
