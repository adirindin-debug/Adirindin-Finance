/**
 * Market risk & sentiment gauge (Tools · PREVIEW) — shared weights, zones and maths.
 *
 * A transparent 0–100 blend: higher = hotter / risk-on (euphoria-leaning),
 * lower = washout / fear. Every input is a public series; when an input has no
 * data for a date it is dropped and the remaining weights are re-scaled — never
 * filled with invented values.
 *
 * Theoretical estimation and study aid only. Not a signal, not a timing model,
 * not financial advice (NFA).
 */

import { btcLiveSilhouette } from "@/lib/cycles/btcSilhouette";
import { reLiveSilhouette } from "@/lib/cycles/reSilhouette";

/* -------------------------------------------------------------------------- */
/* Components & weights                                                       */
/* -------------------------------------------------------------------------- */

export type ComponentKey =
  | "dd"
  | "rsiW"
  | "rsiD"
  | "vix"
  | "usFng"
  | "cryptoFng"
  | "trends"
  | "btcCycle"
  | "reCycle";

export type ComponentMeta = {
  key: ComponentKey;
  label: string;
  short: string;
  weight: number; // percent, sums to 100
  group: "Price risk" | "Volatility" | "Sentiment" | "Attention" | "Cycle calendar";
  how: string;
  color: string;
};

export const COMPONENTS: ComponentMeta[] = [
  {
    key: "dd",
    label: "S&P 500 distance from all-time high",
    short: "SPX drawdown",
    weight: 25,
    group: "Price risk",
    how: "100 at a fresh all-time high, falling in a straight line to 0 at −30% or worse (S&P 500 daily close vs running high).",
    color: "#3dcc9a",
  },
  {
    key: "rsiW",
    label: "S&P 500 weekly RSI (14)",
    short: "SPX RSI weekly",
    weight: 15,
    group: "Price risk",
    how: "Wilder 14-week RSI on weekly closes; the current week uses the latest daily close. Used as-is (0–100).",
    color: "#4c9fff",
  },
  {
    key: "rsiD",
    label: "S&P 500 daily RSI (14)",
    short: "SPX RSI daily",
    weight: 10,
    group: "Price risk",
    how: "Wilder 14-day RSI on daily closes. Used as-is (0–100).",
    color: "#38bdf8",
  },
  {
    key: "vix",
    label: "VIX calm (inverse 5-year percentile)",
    short: "VIX calm",
    weight: 15,
    group: "Volatility",
    how: "100 − the VIX close's percentile against the prior 5 years of closes. Low vol = hotter, vol spike = colder.",
    color: "#a78bfa",
  },
  {
    key: "usFng",
    label: "US stocks Fear & Greed (FearGreedChart.com)",
    short: "US F&G",
    weight: 10,
    group: "Sentiment",
    how: "Independent daily US stock Fear & Greed score, used as-is (0–100). Not CNN's index.",
    color: "#84cc16",
  },
  {
    key: "cryptoFng",
    label: "Crypto Fear & Greed (Alternative.me)",
    short: "Crypto F&G",
    weight: 10,
    group: "Sentiment",
    how: "Alternative.me daily crypto Fear & Greed score, used as-is (0–100).",
    color: "#f7931a",
  },
  {
    key: "trends",
    label: 'Google Trends "bitcoin" attention',
    short: "BTC search attention",
    weight: 5,
    group: "Attention",
    how: "Percentile of last completed month's worldwide search interest vs the prior 60 months. Applied to the following month (no look-ahead).",
    color: "#f472b6",
  },
  {
    key: "btcCycle",
    label: "BTC 4-year cycle theory position (calendar)",
    short: "BTC 4y calendar",
    weight: 5,
    group: "Cycle calendar",
    how: "Height of the date on the Adirindin BTC 4y theory silhouette (trough 0 → theory peak 100). Calendar framework only — no price.",
    color: "#fbbf24",
  },
  {
    key: "reCycle",
    label: "Real estate 18-year cycle position (calendar)",
    short: "RE 18y calendar",
    weight: 5,
    group: "Cycle calendar",
    how: "Height of the date on the Adirindin real estate (Anderson-style) silhouette (low 0 → major peak 100). Calendar framework only.",
    color: "#2dd4bf",
  },
];

export const COMPONENT_KEYS = COMPONENTS.map((c) => c.key);

/** Score is withheld when less than this share of the total weight has data. */
export const MIN_WEIGHT_FOR_SCORE = 40;

/** Cycle-calendar inputs start once the frameworks have a full lap behind them. */
export const CYCLE_FROM = "2013-01-01";
/** Trends attention starts once the 60-month look-back is meaningful for "bitcoin". */
export const TRENDS_FROM = "2013-01-01";
/** First date shown on the Max window (VIX history starts 2 Jan 1990). */
export const DISPLAY_FROM = "1990-01-02";
/** Rows older than this many years are thinned to weekly in the API payload. */
export const DAILY_YEARS = 10;

/* -------------------------------------------------------------------------- */
/* Zones                                                                      */
/* -------------------------------------------------------------------------- */

export type Zone = { key: string; label: string; min: number; max: number; color: string; blurb: string };

export const ZONES: Zone[] = [
  {
    key: "washout",
    label: "Washout",
    min: 0,
    max: 20,
    color: "#a78bfa",
    blurb: "Deep drawdown, stretched-low momentum, vol spiking, fear readings pinned low.",
  },
  {
    key: "repair",
    label: "Repair",
    min: 20,
    max: 40,
    color: "#2dd4bf",
    blurb: "Still bruised. Readings off the floor but well below average.",
  },
  {
    key: "neutral",
    label: "Neutral",
    min: 40,
    max: 60,
    color: "#94a3b8",
    blurb: "Mixed inputs. Nothing stretched either way.",
  },
  {
    key: "hot",
    label: "Hot market",
    min: 60,
    max: 80,
    color: "#fbbf24",
    blurb: "Near highs, firm momentum, calm vol, greedy sentiment.",
  },
  {
    key: "euphoria",
    label: "Euphoria-leaning",
    min: 80,
    max: 100,
    color: "#ff5d5d",
    blurb: "Most inputs stretched hot at once. Historically uncommon.",
  },
];

export function zoneFor(score: number): Zone {
  for (const z of ZONES) if (score < z.max) return z;
  return ZONES[ZONES.length - 1]!;
}

/* -------------------------------------------------------------------------- */
/* Mood arc (original Adirindin stages, not a reproduction of any chart)      */
/* -------------------------------------------------------------------------- */

/** Look-back (sessions) for the arc's rising/falling side. ~3 months. */
export const ARC_LOOKBACK = 63;

export type ArcStage = { label: string; side: "up" | "down" | "floor" | "top" };

/** Stage name from score level + whether the score is above its level ~3 months ago. */
export function arcStage(score: number, rising: boolean): ArcStage {
  if (score >= 80) return { label: "Euphoria-leaning", side: "top" };
  if (score < 20) return { label: "Washout", side: "floor" };
  if (rising) {
    if (score < 40) return { label: "Repair", side: "up" };
    if (score < 60) return { label: "Grind higher", side: "up" };
    return { label: "Hot market", side: "up" };
  }
  if (score >= 60) return { label: "Cracks show", side: "down" };
  if (score >= 40) return { label: "Cooling", side: "down" };
  return { label: "Unwind", side: "down" };
}

/**
 * Position along a cosine bell (0 → 1 across, height = score): rising readings sit
 * on the left limb, falling readings on the right limb.
 */
export function arcFraction(score: number, rising: boolean): number {
  const s = Math.min(100, Math.max(0, score));
  const half = Math.acos(1 - s / 50) / (2 * Math.PI); // 0 … 0.5
  return rising ? half : 1 - half;
}

export function arcHeight(frac: number): number {
  return 50 * (1 - Math.cos(2 * Math.PI * frac));
}

/* -------------------------------------------------------------------------- */
/* Row format (API ⇄ client)                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One row (raw inputs kept so the UI can show them):
 * [date, score, spxClose, ddPct, rsiD, rsiW, vixClose, vixPct5y, usFng, cryptoFng,
 *  trendsRaw, trendsPct, btcCycle, reCycle]
 */
export type RsRow = [
  string,
  number | null,
  number,
  number,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

export type SourceStatus = {
  key: string;
  label: string;
  origin: "live" | "snapshot" | "missing";
  from: string | null;
  asOf: string | null;
  note?: string;
};

export type RsPayload = {
  ok: boolean;
  rows: RsRow[];
  asOf: string | null;
  sources: SourceStatus[];
  warnings?: string[];
  error?: string;
  generated: string;
};

export function subScores(r: RsRow): Record<ComponentKey, number | null> {
  const [, , , ddPct, rsiD, rsiW, , vixPct, usFng, cryptoFng, , trendsPct, btcCycle, reCycle] = r;
  return {
    dd: clamp(100 * (1 + ddPct / 30), 0, 100),
    rsiW,
    rsiD,
    vix: vixPct == null ? null : 100 - vixPct,
    usFng,
    cryptoFng,
    trends: trendsPct,
    btcCycle,
    reCycle,
  };
}

/** Weighted blend with re-scaled weights over the inputs that have data. */
export function blend(subs: Record<ComponentKey, number | null>): { score: number | null; weight: number } {
  let wSum = 0;
  let acc = 0;
  for (const c of COMPONENTS) {
    const v = subs[c.key];
    if (v == null || !Number.isFinite(v)) continue;
    wSum += c.weight;
    acc += c.weight * v;
  }
  if (wSum < MIN_WEIGHT_FOR_SCORE) return { score: null, weight: wSum };
  return { score: Math.round((acc / wSum) * 10) / 10, weight: wSum };
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/* -------------------------------------------------------------------------- */
/* Server-side compute                                                        */
/* -------------------------------------------------------------------------- */

export type Series = Array<[string, number]>;

export type RawInputs = {
  spx: Series;
  vix: Series | null;
  usFng: Series | null;
  cryptoFng: Series | null;
  /** [YYYY-MM, value] completed months only. */
  trends: Series | null;
};

function wilderRsi(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    if (ch > 0) g += ch;
    else l -= ch;
  }
  let ag = g / period;
  let al = l / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i]! - closes[i - 1]!;
    ag = (ag * (period - 1) + Math.max(ch, 0)) / period;
    al = (al * (period - 1) + Math.max(-ch, 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

/** Monday (UTC) of the ISO week for a YYYY-MM-DD date — week key. */
function weekKey(d: string): string {
  const ms = Date.parse(`${d}T00:00:00Z`);
  const dow = (new Date(ms).getUTCDay() + 6) % 7; // Mon=0
  return new Date(ms - dow * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Weekly RSI for every daily row. Completed weeks drive the Wilder averages;
 * the in-progress week uses that day's close as a provisional weekly close.
 */
function weeklyRsiDaily(dates: string[], closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = new Array(dates.length).fill(null);
  // Completed weekly closes (last trading day of each week).
  const weekly: number[] = [];
  let ag = 0;
  let al = 0;
  let seeded = false;
  let seedG = 0;
  let seedL = 0;
  const pushWeek = (close: number) => {
    const n = weekly.length;
    if (n > 0) {
      const ch = close - weekly[n - 1]!;
      if (!seeded) {
        if (ch > 0) seedG += ch;
        else seedL -= ch;
        if (n === period) {
          ag = seedG / period;
          al = seedL / period;
          seeded = true;
        }
      } else {
        ag = (ag * (period - 1) + Math.max(ch, 0)) / period;
        al = (al * (period - 1) + Math.max(-ch, 0)) / period;
      }
    }
    weekly.push(close);
  };
  for (let i = 0; i < dates.length; i++) {
    const wk = weekKey(dates[i]!);
    if (i > 0 && weekKey(dates[i - 1]!) !== wk) pushWeek(closes[i - 1]!);
    if (seeded && weekly.length) {
      const ch = closes[i]! - weekly[weekly.length - 1]!;
      const pag = (ag * (period - 1) + Math.max(ch, 0)) / period;
      const pal = (al * (period - 1) + Math.max(-ch, 0)) / period;
      out[i] = pal === 0 ? 100 : 100 - 100 / (1 + pag / pal);
    }
  }
  return out;
}

/** Value at or before `d` within `maxGapDays`, walking a sorted series with a cursor. */
function makeAsOf(series: Series | null, maxGapDays: number) {
  let j = -1;
  return (d: string): { v: number; idx: number } | null => {
    if (!series?.length) return null;
    while (j + 1 < series.length && series[j + 1]![0] <= d) j++;
    if (j < 0) return null;
    const gap = (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${series[j]![0]}T00:00:00Z`)) / 86_400_000;
    if (gap > maxGapDays) return null;
    return { v: series[j]![1], idx: j };
  };
}

function minusYears(d: string, y: number): string {
  return `${String(Number(d.slice(0, 4)) - y).padStart(4, "0")}${d.slice(4)}`;
}

function lowerBound(arr: Series, d: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]![0] < d) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Percentile (0–100) of series[j] vs closes in the 5 years up to and including j. */
function vixPercentile(vix: Series, j: number): number {
  const v = vix[j]![1];
  const lo = lowerBound(vix, minusYears(vix[j]![0], 5));
  let le = 0;
  for (let k = lo; k <= j; k++) if (vix[k]![1] <= v) le++;
  return Math.round((1000 * le) / (j - lo + 1)) / 10;
}

function monthKeyPrev(d: string): string {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

/** Trends percentile per month key (value vs the 60 months before it, inclusive). */
function trendsPercentiles(trends: Series | null): Map<string, { raw: number; pct: number }> {
  const out = new Map<string, { raw: number; pct: number }>();
  if (!trends) return out;
  for (let i = 0; i < trends.length; i++) {
    const lo = Math.max(0, i - 59);
    if (i - lo < 59) continue; // need a full 60-month window
    const v = trends[i]![1];
    let le = 0;
    for (let k = lo; k <= i; k++) if (trends[k]![1] <= v) le++;
    out.set(trends[i]![0], { raw: v, pct: Math.round((1000 * le) / (i - lo + 1)) / 10 });
  }
  return out;
}

/** Height (0–100) of a calendar date on a theory silhouette (SVG y: trough → peak). */
function silhouetteHeat(y: number, troughY: number, peakY: number): number {
  return Math.round(clamp(((troughY - y) / (troughY - peakY)) * 100, 0, 100) * 10) / 10;
}

const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export function computeRows(inp: RawInputs): RsRow[] {
  const spx = inp.spx;
  const dates = spx.map((r) => r[0]);
  const closes = spx.map((r) => r[1]);
  const rsiD = wilderRsi(closes);
  const rsiW = weeklyRsiDaily(dates, closes);
  const vixAt = makeAsOf(inp.vix, 5);
  const usAt = makeAsOf(inp.usFng, 4);
  const crAt = makeAsOf(inp.cryptoFng, 3);
  const tp = trendsPercentiles(inp.trends);
  const vixPctCache = new Map<number, number>();

  const rows: RsRow[] = [];
  let ath = 0;
  for (let i = 0; i < spx.length; i++) {
    const d = dates[i]!;
    const px = closes[i]!;
    if (px > ath) ath = px;
    if (d < DISPLAY_FROM) {
      vixAt(d);
      usAt(d);
      crAt(d);
      continue;
    }
    const ddPct = (px / ath - 1) * 100;
    const vx = vixAt(d);
    let vixPct: number | null = null;
    if (vx) {
      if (!vixPctCache.has(vx.idx)) vixPctCache.set(vx.idx, vixPercentile(inp.vix!, vx.idx));
      vixPct = vixPctCache.get(vx.idx)!;
    }
    const us = usAt(d);
    const cr = crAt(d);
    const tr = d >= TRENDS_FROM ? tp.get(monthKeyPrev(d)) ?? null : null;
    let btc: number | null = null;
    let re: number | null = null;
    if (d >= CYCLE_FROM) {
      const ms = Date.parse(`${d}T12:00:00Z`);
      btc = silhouetteHeat(btcLiveSilhouette(ms).pt.y, 300, 48);
      re = silhouetteHeat(reLiveSilhouette(ms).pt.y, 305, 42);
    }
    const row: RsRow = [
      d,
      null,
      px,
      Math.round(ddPct * 100) / 100,
      r1(rsiD[i] ?? null),
      r1(rsiW[i] ?? null),
      vx ? vx.v : null,
      vixPct,
      us ? us.v : null,
      cr ? cr.v : null,
      tr ? tr.raw : null,
      tr ? tr.pct : null,
      btc,
      re,
    ];
    row[1] = blend(subScores(row)).score;
    rows.push(row);
  }
  return rows;
}

/** Keep the last DAILY_YEARS daily; thin older rows to the last session of each week. */
export function thinRows(rows: RsRow[]): RsRow[] {
  if (!rows.length) return rows;
  const cutoff = minusYears(rows[rows.length - 1]![0], DAILY_YEARS);
  const out: RsRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const d = rows[i]![0];
    if (d >= cutoff) {
      out.push(rows[i]!);
      continue;
    }
    const next = rows[i + 1];
    if (!next || weekKey(next[0]) !== weekKey(d)) out.push(rows[i]!);
  }
  return out;
}
