/**
 * Market risk & sentiment gauge (Tools) — shared weights, zones and maths.
 *
 * A transparent 0–100 blend: higher = hotter / risk-on (euphoria-leaning),
 * lower = washout / fear. Every input is a public series; when an input has no
 * data for a date it is dropped and the remaining weights are re-scaled — never
 * filled with invented values.
 *
 * Equity price risk is led by URTH (iShares MSCI World ETF — developed-markets
 * proxy), with the S&P 500 as a lighter cross-check; on days one of them has no
 * data the other takes the pair's full weight (see EQUITY_PAIRS / dayWeights).
 * Before URTH history (~Jan 2012) the S&P pair logic fills the equity block.
 *
 * Seasonality (8%) scores the calendar month from that same equity base: the
 * month's historical average return and green-month odds, using only months
 * completed before the date (expanding window, no look-ahead). See
 * buildSeasonality below.
 *
 * Credit spreads (10%) score Moody's BAA minus the 10-year Treasury (FRED
 * BAA10Y): level and 3-month change, each as a percentile against all prior
 * completed months (expanding window, no look-ahead) — wide or widening = low.
 * Trend (10%) scores price vs its 200-day average and that average's slope,
 * URTH-led with the S&P 500 as the paired fallback (8% + 2%).
 * Adding them scaled every earlier weight by 0.8 (ratios unchanged).
 *
 * Theoretical estimation and study aid only. Not a signal, not a timing model,
 * not financial advice (NFA).
 */

import { btcLiveSilhouette } from "@/lib/cycles/btcSilhouette";
import { reLiveSilhouette } from "@/lib/cycles/reSilhouette";
import type { MonthClose } from "@/lib/seasonality";

/* -------------------------------------------------------------------------- */
/* Components & weights                                                       */
/* -------------------------------------------------------------------------- */

export type ComponentKey =
  | "wDd"
  | "wRsiW"
  | "wRsiD"
  | "dd"
  | "rsiW"
  | "rsiD"
  | "vix"
  | "usFng"
  | "cryptoFng"
  | "trends"
  | "btcCycle"
  | "reCycle"
  | "season"
  | "credit"
  | "wTrend"
  | "trend";

export type ComponentMeta = {
  key: ComponentKey;
  label: string;
  short: string;
  /**
   * Percent when every input has data (sums to 100). Credit spreads 10% and trend
   * 10% (v2); every earlier input keeps its ratio, scaled by 0.8 to share the other
   * 80% (seasonality 10 → 8).
   */
  weight: number;
  /**
   * Equity price inputs only: the weight this input takes when its URTH /
   * S&P 500 partner has no data that day (the pair's full share).
   */
  soloWeight?: number;
  group: "Price risk" | "Trend" | "Volatility" | "Credit" | "Sentiment" | "Attention" | "Cycle calendar" | "Seasonality";
  how: string;
  color: string;
};

export const COMPONENTS: ComponentMeta[] = [
  {
    key: "wDd",
    label: "URTH distance from all-time high",
    short: "URTH drawdown",
    weight: 14.4,
    soloWeight: 18,
    group: "Price risk",
    how: "100 at a fresh all-time high, falling in a straight line to 0 at −30% or worse (URTH adjusted close vs running high). Primary equity input — iShares MSCI World ETF as a developed-markets proxy (not the licensed MSCI index series).",
    color: "#3dcc9a",
  },
  {
    key: "wRsiW",
    label: "URTH weekly RSI (14)",
    short: "URTH RSI weekly",
    weight: 8.64,
    soloWeight: 10.8,
    group: "Price risk",
    how: "Wilder 14-week RSI on URTH weekly adjusted closes; the current week uses the latest daily close. Used as-is (0–100).",
    color: "#4c9fff",
  },
  {
    key: "wRsiD",
    label: "URTH daily RSI (14)",
    short: "URTH RSI daily",
    weight: 5.76,
    soloWeight: 7.2,
    group: "Price risk",
    how: "Wilder 14-day RSI on URTH daily adjusted closes. Used as-is (0–100).",
    color: "#38bdf8",
  },
  {
    key: "dd",
    label: "S&P 500 distance from all-time high (confirmation)",
    short: "SPX drawdown",
    weight: 3.6,
    soloWeight: 18,
    group: "Price risk",
    how: "Same rule as URTH (0% → 100, −30% or worse → 0) on the S&P 500 daily close. Secondary check; takes the full 18% on any day URTH has no data (including before URTH history ~Jan 2012).",
    color: "#1f9e74",
  },
  {
    key: "rsiW",
    label: "S&P 500 weekly RSI (14) (confirmation)",
    short: "SPX RSI weekly",
    weight: 2.16,
    soloWeight: 10.8,
    group: "Price risk",
    how: "Wilder 14-week RSI on S&P 500 weekly closes. Secondary check; takes the full 10.8% on any day URTH has no data.",
    color: "#3672b8",
  },
  {
    key: "rsiD",
    label: "S&P 500 daily RSI (14) (confirmation)",
    short: "SPX RSI daily",
    weight: 1.44,
    soloWeight: 7.2,
    group: "Price risk",
    how: "Wilder 14-day RSI on S&P 500 daily closes. Secondary check; takes the full 7.2% on any day URTH has no data.",
    color: "#2a87ad",
  },
  {
    key: "wTrend",
    label: "URTH 200-day trend",
    short: "URTH trend",
    weight: 8,
    soloWeight: 10,
    group: "Trend",
    how: "Half from distance to the 200-day simple moving average (−10% → 0, at the average → 50, +10% → 100) and half from that average's slope over the last 21 sessions (−2% → 0, flat → 50, +2% a month → 100), each capped 0–100. URTH adjusted close; takes the full 10% on any day the S&P 500 has no data.",
    color: "#facc15",
  },
  {
    key: "trend",
    label: "S&P 500 200-day trend (confirmation)",
    short: "SPX trend",
    weight: 2,
    soloWeight: 10,
    group: "Trend",
    how: "Same rule as URTH on the S&P 500 daily close. Secondary check; takes the full 10% on any day URTH has no data (including before URTH history ~Jan 2012).",
    color: "#ca8a04",
  },
  {
    key: "vix",
    label: "VIX calm (inverse 5-year percentile)",
    short: "VIX calm",
    weight: 10.8,
    group: "Volatility",
    how: "100 − the VIX close's percentile against the prior 5 years of closes. Low vol = hotter, vol spike = colder.",
    color: "#a78bfa",
  },
  {
    key: "credit",
    label: "Credit spreads (Moody's BAA − 10-year Treasury)",
    short: "Credit spreads",
    weight: 10,
    group: "Credit",
    how: "FRED BAA10Y, previous session's value. Two percentiles, each against every prior completed month (expanding window, no look-ahead; monthly BAA − long Treasury history from 1925 before daily data starts in 1986): the spread's level and its 3-month change. Sub-score = 100 − their average, so wide or widening spreads read cold and tight or tightening spreads read hot.",
    color: "#fb923c",
  },
  {
    key: "usFng",
    label: "US stocks Fear & Greed (FearGreedChart.com)",
    short: "US F&G",
    weight: 7.2,
    group: "Sentiment",
    how: "Independent daily US stock Fear & Greed score, used as-is (0–100). Not CNN's index.",
    color: "#84cc16",
  },
  {
    key: "cryptoFng",
    label: "Crypto Fear & Greed (Alternative.me)",
    short: "Crypto F&G",
    weight: 7.2,
    group: "Sentiment",
    how: "Alternative.me daily crypto Fear & Greed score, used as-is (0–100).",
    color: "#f7931a",
  },
  {
    key: "trends",
    label: 'Google Trends "bitcoin" attention',
    short: "BTC search attention",
    weight: 3.6,
    group: "Attention",
    how: "Percentile of last completed month's worldwide search interest vs the prior 60 months. Applied to the following month (no look-ahead).",
    color: "#f472b6",
  },
  {
    key: "btcCycle",
    label: "BTC 4-year cycle theory position (calendar)",
    short: "BTC 4y calendar",
    weight: 3.6,
    group: "Cycle calendar",
    how: "Height of the date on the Adirindin BTC 4y theory silhouette (trough 0 → theory peak 100). Calendar framework only — no price.",
    color: "#fbbf24",
  },
  {
    key: "reCycle",
    label: "Real estate 18-year cycle position (calendar)",
    short: "RE 18y calendar",
    weight: 3.6,
    group: "Cycle calendar",
    how: "Height of the date on the Adirindin real estate (Anderson-style) silhouette (low 0 → major peak 100). Calendar framework only.",
    color: "#2dd4bf",
  },
  {
    key: "season",
    label: "Seasonality (calendar month, URTH / S&P 500 history)",
    short: "Seasonality",
    weight: 8,
    group: "Seasonality",
    how: "This calendar month's average return and green-month odds on the gauge's equity base (URTH adjusted-close monthly returns from Feb 2012, S&P 500 before that, back to 1950), using only months completed before the date. Each is compared with the all-month average in standard errors (so thin or noisy records count less): 50 = an average month, ±12.5 points per standard error on each half, capped 0–100. Needs at least 10 prior years of that month.",
    color: "#e879f9",
  },
];

/**
 * Equity price pairs: [URTH key, S&P 500 key]. With both present they split
 * the pair's share 80/20 (URTH dominant); with one missing the other takes it all.
 */
export const EQUITY_PAIRS: Array<[ComponentKey, ComponentKey]> = [
  ["wDd", "dd"],
  ["wRsiW", "rsiW"],
  ["wRsiD", "rsiD"],
  ["wTrend", "trend"],
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
 * [date, score,
 *  spxClose, spxDdPct, spxRsiD, spxRsiW,
 *  worldClose, worldDdPct, worldRsiD, worldRsiW,
 *  vixClose, vixPct5y, usFng, cryptoFng, trendsRaw, trendsPct, btcCycle, reCycle,
 *  seasonScore,
 *  baa10y, baa10yChg3m, creditScore,
 *  spxGapPct, spxSlopePct, worldGapPct, worldSlopePct]
 * seasonScore is the 0–100 seasonality sub-score for the row's calendar month
 * (details per month in RsPayload.season). baa10y is the BAA − 10y spread (pp)
 * as of the previous session, baa10yChg3m its change over 3 months (pp) and
 * creditScore the credit sub-score. Gap = % from the 200-day average; slope = %
 * change in that average over 21 sessions.
 * Equity values are the latest close on or before the row date (≤ 4 days old),
 * null when that series has none.
 */
export type RsRow = [
  string,
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

/**
 * Base chart overlay — the equity price line drawn under the score history.
 * Visual context only: the overlay choice never changes the score or its weights.
 */
export type BaseOverlayKey = "spx" | "ixic" | "urth";

export type BaseOverlayMeta = {
  key: BaseOverlayKey;
  /** Toggle chip label. */
  label: string;
  /** Tooltip / legend label. */
  name: string;
  symbol: string;
  color: string;
  note: string;
};

export const BASE_OVERLAYS: BaseOverlayMeta[] = [
  {
    key: "spx",
    label: "S&P 500",
    name: "S&P 500",
    symbol: "^GSPC",
    color: "#8b9bb4",
    note: "Yahoo Finance ^GSPC daily close — price index, no dividends.",
  },
  {
    key: "ixic",
    label: "Nasdaq",
    name: "Nasdaq Composite",
    symbol: "^IXIC",
    color: "#8b93e0",
    note: "Yahoo Finance ^IXIC daily close — price index, no dividends. Chart overlay only, not a score input.",
  },
  {
    key: "urth",
    label: "URTH",
    name: "URTH (MSCI World ETF)",
    symbol: "URTH",
    color: "#5fb3a6",
    note: "Yahoo Finance URTH adjusted close — iShares MSCI World ETF, developed-markets proxy from Jan 2012. Not the licensed MSCI index.",
  },
];

export const DEFAULT_BASE_OVERLAY: BaseOverlayKey = "spx";
export const BASE_OVERLAY_STORAGE_KEY = "adirindin.riskSentiment.baseChart";
export const BASE_OVERLAY_SHOW_STORAGE_KEY = "adirindin.riskSentiment.baseChartShow";

export function isBaseOverlayKey(v: unknown): v is BaseOverlayKey {
  return v === "spx" || v === "ixic" || v === "urth";
}

/* -------------------------------------------------------------------------- */
/* Display smoothing (client-side, never changes inputs or weights)           */
/* -------------------------------------------------------------------------- */

/**
 * Score line smoothing. "raw" is each day's blend exactly as computed; the EMA
 * options are an exponential moving average of that daily composite over N
 * trading sessions. Smoothing is display-only: inputs, weights and each day's
 * raw composite are untouched (the breakdown table always shows the raw day).
 */
export type SmoothKey = "raw" | "ema5" | "ema10" | "ema21";

export type SmoothMeta = { key: SmoothKey; label: string; span: number | null; name: string };

export const SMOOTH_OPTIONS: SmoothMeta[] = [
  { key: "raw", label: "Raw", span: null, name: "Raw daily score" },
  { key: "ema5", label: "5-day", span: 5, name: "5-day average (EMA)" },
  { key: "ema10", label: "10-day", span: 10, name: "10-day average (EMA)" },
  { key: "ema21", label: "21-day", span: 21, name: "21-day average (EMA)" },
];

export const DEFAULT_SMOOTH: SmoothKey = "ema10";
export const SMOOTH_STORAGE_KEY = "adirindin.riskSentiment.smoothing";

export function isSmoothKey(v: unknown): v is SmoothKey {
  return v === "raw" || v === "ema5" || v === "ema10" || v === "ema21";
}

/** Weekdays in (a, b] — trading sessions elapsed between two row dates (holidays ignored). */
function weekdaysBetween(a: string, b: string): number {
  const d0 = Date.parse(`${a}T00:00:00Z`) / 86_400_000;
  const d1 = Date.parse(`${b}T00:00:00Z`) / 86_400_000;
  let n = 0;
  for (let d = d0 + 1; d <= d1; d++) {
    const dow = new Date(d * 86_400_000).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return Math.max(1, n);
}

/**
 * Session-aware EMA of the composite (row[1]). Alpha = 2 / (span + 1) per
 * session; when rows are more than one session apart (older history is thinned
 * to weekly) the decay is compounded over the sessions elapsed, so a 10-day
 * average means ~10 trading days on weekly rows too. A missing score breaks the
 * line and restarts the average — no values are carried across gaps.
 */
export function smoothScores(rows: RsRow[], span: number | null): Array<number | null> {
  if (span == null || span <= 1) return rows.map((r) => r[1]);
  const keep = 1 - 2 / (span + 1);
  const out: Array<number | null> = new Array(rows.length).fill(null);
  let ema: number | null = null;
  let prevDate: string | null = null;
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]![1];
    if (v == null || !Number.isFinite(v)) {
      ema = null;
      prevDate = null;
      continue;
    }
    if (ema == null || prevDate == null) ema = v;
    else {
      const k = Math.pow(keep, weekdaysBetween(prevDate, rows[i]![0]));
      ema = k * ema + (1 - k) * v;
    }
    prevDate = rows[i]![0];
    out[i] = Math.round(ema * 10) / 10;
  }
  return out;
}

export type RsPayload = {
  ok: boolean;
  rows: RsRow[];
  /**
   * Nasdaq Composite (^IXIC) close aligned 1:1 with `rows` (null when no close
   * within a few days). Base chart overlay only — not part of the score.
   */
  ixic?: Array<number | null>;
  /**
   * Seasonality detail per calendar month key (YYYY-MM) that appears in `rows`.
   * Missing / null when that month has too little prior history.
   */
  season?: Record<string, SeasonStat | null>;
  asOf: string | null;
  sources: SourceStatus[];
  warnings?: string[];
  error?: string;
  generated: string;
};

const ddScore = (ddPct: number | null) => (ddPct == null ? null : clamp(100 * (1 + ddPct / 30), 0, 100));

/** Trend scale: ±10% from the 200-day average and ±2% a month of slope map to 0 / 100. */
export const TREND_GAP_PTS = 5;
export const TREND_SLOPE_PTS = 25;
export const TREND_MA = 200;
export const TREND_SLOPE_SESSIONS = 21;

/** Trend sub-score from % gap to the 200-day average and its 21-session slope (%). */
export function trendScore(gapPct: number | null, slopePct: number | null): number | null {
  if (gapPct == null || slopePct == null) return null;
  const s = 0.5 * clamp(50 + TREND_GAP_PTS * gapPct, 0, 100) + 0.5 * clamp(50 + TREND_SLOPE_PTS * slopePct, 0, 100);
  return Math.round(s * 10) / 10;
}

export function subScores(r: RsRow): Record<ComponentKey, number | null> {
  const [, , , spxDd, spxRsiD, spxRsiW, , wDd, wRsiD, wRsiW, , vixPct, usFng, cryptoFng, , trendsPct, btcCycle, reCycle, season, , , credit, spxGap, spxSlope, wGap, wSlope] = r;
  return {
    wDd: ddScore(wDd),
    wRsiW,
    wRsiD,
    dd: ddScore(spxDd),
    rsiW: spxRsiW,
    rsiD: spxRsiD,
    vix: vixPct == null ? null : 100 - vixPct,
    usFng,
    cryptoFng,
    trends: trendsPct,
    btcCycle,
    reCycle,
    season: season ?? null,
    credit: credit ?? null,
    wTrend: trendScore(wGap ?? null, wSlope ?? null),
    trend: trendScore(spxGap ?? null, spxSlope ?? null),
  };
}

const has = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const META = new Map(COMPONENTS.map((c) => [c.key, c]));

/**
 * Nominal weight each input carries on a given day before re-scaling: 0 without
 * data; an equity input whose World / S&P partner is missing takes the pair's
 * full share (soloWeight), so the equity block keeps its size either way.
 */
export function dayWeights(subs: Record<ComponentKey, number | null>): Record<ComponentKey, number> {
  const out = {} as Record<ComponentKey, number>;
  for (const c of COMPONENTS) out[c.key] = has(subs[c.key]) ? c.weight : 0;
  for (const [w, s] of EQUITY_PAIRS) {
    const hw = has(subs[w]);
    const hs = has(subs[s]);
    if (hw && !hs) out[w] = META.get(w)!.soloWeight ?? out[w];
    if (hs && !hw) out[s] = META.get(s)!.soloWeight ?? out[s];
  }
  return out;
}

/** Weighted blend with re-scaled weights over the inputs that have data. */
export function blend(subs: Record<ComponentKey, number | null>): { score: number | null; weight: number } {
  const w = dayWeights(subs);
  let wSum = 0;
  let acc = 0;
  for (const c of COMPONENTS) {
    const v = subs[c.key];
    if (!has(v) || !w[c.key]) continue;
    wSum += w[c.key];
    acc += w[c.key] * v;
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
  /** S&P 500 daily closes (secondary equity input). */
  spx: Series | null;
  /** URTH (iShares MSCI World ETF) adjusted closes — primary equity input. */
  world: Series | null;
  vix: Series | null;
  usFng: Series | null;
  cryptoFng: Series | null;
  /** [YYYY-MM, value] completed months only. */
  trends: Series | null;
  /**
   * Older S&P 500 month-end closes ([YYYY-MM, last trading date, close]) from the
   * site's Seasonality data (src/data/seasonality-snapshot.json, Yahoo ^GSPC from
   * Dec 1949). Extends the seasonality history before the daily `spx` series;
   * month-ends from `spx` win wherever both exist.
   */
  spxMonths?: MonthClose[] | null;
  /** FRED BAA10Y daily (Moody's BAA − 10-year Treasury, pp), 2 Jan 1986 →. */
  baa10y?: Series | null;
  /**
   * Static monthly BAA − long Treasury (pp), [YYYY-MM, value], Jan 1925 – Dec 1985
   * (src/data/credit-spread-history.json). Reference history before BAA10Y.
   */
  creditMonths?: Series | null;
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

/** Per-date equity metrics for one price series (ATH distance, daily + weekly RSI). */
type EqMetrics = { px: number; dd: number; rsiD: number | null; rsiW: number | null; gap: number | null; slope: number | null };

function equityMetrics(series: Series | null): Array<[string, EqMetrics]> | null {
  if (!series?.length) return null;
  const dates = series.map((r) => r[0]);
  const closes = series.map((r) => r[1]);
  const rsiD = wilderRsi(closes);
  const rsiW = weeklyRsiDaily(dates, closes);
  // 200-day simple moving average (sessions of this series) for the trend input.
  const ma: Array<number | null> = new Array(series.length).fill(null);
  let run = 0;
  for (let i = 0; i < series.length; i++) {
    run += closes[i]!;
    if (i >= TREND_MA) run -= closes[i - TREND_MA]!;
    if (i >= TREND_MA - 1) ma[i] = run / TREND_MA;
  }
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const out: Array<[string, EqMetrics]> = [];
  let ath = 0;
  for (let i = 0; i < series.length; i++) {
    const px = closes[i]!;
    if (px > ath) ath = px;
    const m = ma[i];
    const m0 = i >= TREND_SLOPE_SESSIONS ? ma[i - TREND_SLOPE_SESSIONS] : null;
    out.push([
      dates[i]!,
      {
        px,
        dd: Math.round((px / ath - 1) * 10_000) / 100,
        rsiD: r1(rsiD[i] ?? null),
        rsiW: r1(rsiW[i] ?? null),
        gap: m == null ? null : r3((px / m - 1) * 100),
        slope: m == null || m0 == null ? null : r3((m / m0 - 1) * 100),
      },
    ]);
  }
  return out;
}

/** As-of lookup over metric rows (same cursor walk as makeAsOf). */
function makeMetricAsOf(rows: Array<[string, EqMetrics]> | null, maxGapDays: number) {
  let j = -1;
  return (d: string): EqMetrics | null => {
    if (!rows?.length) return null;
    while (j + 1 < rows.length && rows[j + 1]![0] <= d) j++;
    if (j < 0) return null;
    const gap = (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${rows[j]![0]}T00:00:00Z`)) / 86_400_000;
    return gap > maxGapDays ? null : rows[j]![1];
  };
}

/* -------------------------------------------------------------------------- */
/* Seasonality (expanding window, no look-ahead)                              */
/* -------------------------------------------------------------------------- */

/** Fewest prior years of a calendar month before it gets a seasonality score. */
export const SEASON_MIN_YEARS = 10;
/** Sub-score points per standard error on each half (return, odds). */
export const SEASON_POINTS_PER_SE = 12.5;
/** Tag bands on the seasonality sub-score. */
export const SEASON_TAILWIND_AT = 60;
export const SEASON_HEADWIND_AT = 40;

export type SeasonStat = {
  /** Calendar month 1–12. */
  month: number;
  /** Prior years of this calendar month in the window. */
  n: number;
  /** Of those, years measured on URTH (the rest are S&P 500). */
  nUrth: number;
  firstYear: number;
  lastYear: number;
  /** Average monthly return, % (close-to-close, last trading day vs previous month's). */
  avg: number;
  /** Share of those months that closed up, %. */
  pctGreen: number;
  /** All completed months in the same window (baseline). */
  baseN: number;
  baseAvg: number;
  basePctGreen: number;
  /** Standard errors from the baseline. */
  tRet: number;
  tOdds: number;
  /** 0–100 sub-score (50 = an average month). */
  score: number;
};

export type SeasonTag = { key: "tailwind" | "headwind" | "neutral"; label: string; color: string };

export function seasonTag(score: number): SeasonTag {
  if (score >= SEASON_TAILWIND_AT) return { key: "tailwind", label: "Seasonal tailwind", color: "#3dcc9a" };
  if (score <= SEASON_HEADWIND_AT) return { key: "headwind", label: "Seasonal headwind", color: "#f0883e" };
  return { key: "neutral", label: "Seasonally neutral", color: "#94a3b8" };
}

function prevMonthOf(key: string): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Month-end close per YYYY-MM from a daily series (last trading day in each month). */
function monthEnds(daily: Series | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const [d, c] of daily ?? []) out.set(d.slice(0, 7), c);
  return out;
}

export type BaseMonthReturn = { key: string; ret: number; src: "urth" | "spx" };

/**
 * Monthly returns on the gauge's equity base: URTH where it has both month-end
 * closes, else the S&P 500 (S&P daily closes, extended back with the
 * Seasonality month-end history). Every month returned is from real closes.
 */
export function baseMonthlyReturns(inp: Pick<RawInputs, "spx" | "world" | "spxMonths">): BaseMonthReturn[] {
  const spx = new Map<string, number>();
  for (const [k, , c] of inp.spxMonths ?? []) spx.set(k, c);
  for (const [k, c] of monthEnds(inp.spx)) spx.set(k, c);
  const urth = monthEnds(inp.world);
  const keys = [...new Set([...spx.keys(), ...urth.keys()])].sort();
  const out: BaseMonthReturn[] = [];
  for (const k of keys) {
    const p = prevMonthOf(k);
    const u0 = urth.get(p);
    const u1 = urth.get(k);
    if (u0 != null && u1 != null) {
      out.push({ key: k, ret: (u1 / u0 - 1) * 100, src: "urth" });
      continue;
    }
    const s0 = spx.get(p);
    const s1 = spx.get(k);
    if (s0 != null && s1 != null) out.push({ key: k, ret: (s1 / s0 - 1) * 100, src: "spx" });
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Seasonality stats for each requested month key, each built only from base
 * months strictly before it (all already complete on any date in that month).
 * The month being scored never sees its own return or anything later.
 */
export function buildSeasonality(rets: BaseMonthReturn[], monthKeys: string[]): Map<string, SeasonStat | null> {
  const out = new Map<string, SeasonStat | null>();
  const keys = [...new Set(monthKeys)].sort();
  const cal = Array.from({ length: 12 }, () => ({ n: 0, sum: 0, green: 0, urth: 0, first: 0, last: 0 }));
  let bN = 0;
  let bSum = 0;
  let bSq = 0;
  let bGreen = 0;
  let j = 0;
  for (const key of keys) {
    while (j < rets.length && rets[j]!.key < key) {
      const { key: k, ret, src } = rets[j]!;
      const c = cal[Number(k.slice(5, 7)) - 1]!;
      const y = Number(k.slice(0, 4));
      if (!c.n) c.first = y;
      c.last = y;
      c.n++;
      c.sum += ret;
      if (ret > 0) c.green++;
      if (src === "urth") c.urth++;
      bN++;
      bSum += ret;
      bSq += ret * ret;
      if (ret > 0) bGreen++;
      j++;
    }
    const month = Number(key.slice(5, 7));
    const c = cal[month - 1]!;
    if (c.n < SEASON_MIN_YEARS || bN < 2) {
      out.set(key, null);
      continue;
    }
    const avg = c.sum / c.n;
    const pg = c.green / c.n;
    const bAvg = bSum / bN;
    const bP = bGreen / bN;
    const bSd = Math.sqrt(Math.max(0, (bSq - bN * bAvg * bAvg) / (bN - 1)));
    const seRet = bSd / Math.sqrt(c.n);
    const seOdds = Math.sqrt((bP * (1 - bP)) / c.n);
    const tRet = seRet > 0 ? (avg - bAvg) / seRet : 0;
    const tOdds = seOdds > 0 ? (pg - bP) / seOdds : 0;
    const half = (t: number) => clamp(50 + SEASON_POINTS_PER_SE * t, 0, 100);
    out.set(key, {
      month,
      n: c.n,
      nUrth: c.urth,
      firstYear: c.first,
      lastYear: c.last,
      avg: r2(avg),
      pctGreen: Math.round(pg * 1000) / 10,
      baseN: bN,
      baseAvg: r2(bAvg),
      basePctGreen: Math.round(bP * 1000) / 10,
      tRet: r2(tRet),
      tOdds: r2(tOdds),
      score: Math.round(((half(tRet) + half(tOdds)) / 2) * 10) / 10,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Credit spreads (expanding-window percentiles, no look-ahead)               */
/* -------------------------------------------------------------------------- */

/** Fewest prior completed months (level, 3-month change) before a credit score. */
export const CREDIT_MIN_MONTHS = 60;
/** First date the daily BAA10Y value is used (series starts 2 Jan 1986). */
const CREDIT_DAILY_FROM = "1986-01-03";
/** Daily spread may be at most this many calendar days old. */
const CREDIT_MAX_GAP = 10;

/** Same calendar date `n` months earlier, day clamped to that month's length. */
function minusMonths(d: string, n: number): string {
  let y = Number(d.slice(0, 4));
  let m = Number(d.slice(5, 7)) - n;
  while (m < 1) {
    m += 12;
    y--;
  }
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Number(d.slice(8, 10)), dim);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type CreditPoint = { level: number; chg3m: number; score: number };

/**
 * Credit spreads sub-score per row date. Reference = monthly spread history:
 * the static BAA − long Treasury months to Dec 1985, then monthly means of daily
 * BAA10Y. For a date: level = BAA10Y on the previous session (strictly before the
 * date); 3-month change = level − the same lookup 3 calendar months earlier. Each
 * is ranked against every month completed before the date's month (levels vs
 * monthly levels, changes vs monthly 3-month changes); needs CREDIT_MIN_MONTHS of
 * each. Score = 100 − mean(level pct, change pct): wide / widening = low.
 */
export function creditScores(
  dates: string[],
  daily: Series | null | undefined,
  hist: Series | null | undefined,
): Map<string, CreditPoint> {
  const out = new Map<string, CreditPoint>();
  if (!daily?.length) return out;
  const mon = new Map<string, number>();
  for (const [k, v] of hist ?? []) if (k <= "1985-12") mon.set(k, v);
  const acc = new Map<string, { s: number; n: number }>();
  for (const [d, v] of daily) {
    const k = d.slice(0, 7);
    if (k < "1986-01") continue;
    const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += v;
    a.n++;
    acc.set(k, a);
  }
  for (const [k, a] of acc) mon.set(k, a.s / a.n);
  const mKeys = [...mon.keys()].sort();
  const mVals = mKeys.map((k) => mon.get(k)!);
  const cKeys = mKeys.slice(3);
  const cVals = mVals.slice(3).map((v, i) => v - mVals[i]!);
  const countLe = (keys: string[], key: string) => {
    let lo = 0;
    let hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid]! <= key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const levelAt = (d: string): number | null => {
    if (d < CREDIT_DAILY_FROM) {
      const v = mon.get(monthKeyPrev(d));
      return v == null ? null : v;
    }
    const j = lowerBound(daily, d) - 1; // strictly before d
    if (j < 0) return null;
    const gap = (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${daily[j]![0]}T00:00:00Z`)) / 86_400_000;
    return gap > CREDIT_MAX_GAP ? null : daily[j]![1];
  };
  for (const d of dates) {
    const lvl = levelAt(d);
    const lvl3 = levelAt(minusMonths(d, 3));
    if (lvl == null || lvl3 == null) continue;
    const chg = lvl - lvl3;
    const last = monthKeyPrev(d);
    const n = countLe(mKeys, last);
    const k = countLe(cKeys, last);
    if (n < CREDIT_MIN_MONTHS || k < CREDIT_MIN_MONTHS) continue;
    let le = 0;
    for (let i = 0; i < n; i++) if (mVals[i]! <= lvl) le++;
    let ce = 0;
    for (let i = 0; i < k; i++) if (cVals[i]! <= chg) ce++;
    const lp = (100 * le) / n;
    const cp = (100 * ce) / k;
    out.set(d, { level: lvl, chg3m: Math.round(chg * 100) / 100, score: Math.round((100 - (lp + cp) / 2) * 10) / 10 });
  }
  return out;
}

/** Equity close may be at most this many calendar days old for a row (long weekends). */
const EQUITY_MAX_GAP = 4;

/**
 * Daily rows. `season` (from buildSeasonality) supplies each row's seasonality
 * sub-score by calendar month; without it the input is simply missing.
 */
export function computeRows(inp: RawInputs, season?: Map<string, SeasonStat | null>): RsRow[] {
  const spxM = equityMetrics(inp.spx);
  const worldM = equityMetrics(inp.world);
  // Row dates: every session of either equity series (World trades some US holidays).
  const dateSet = new Set<string>();
  for (const r of inp.spx ?? []) if (r[0] >= DISPLAY_FROM) dateSet.add(r[0]);
  for (const r of inp.world ?? []) if (r[0] >= DISPLAY_FROM) dateSet.add(r[0]);
  const dates = [...dateSet].sort();

  const spxAt = makeMetricAsOf(spxM, EQUITY_MAX_GAP);
  const worldAt = makeMetricAsOf(worldM, EQUITY_MAX_GAP);
  const vixAt = makeAsOf(inp.vix, 5);
  const usAt = makeAsOf(inp.usFng, 4);
  const crAt = makeAsOf(inp.cryptoFng, 3);
  const tp = trendsPercentiles(inp.trends);
  const vixPctCache = new Map<number, number>();
  const credit = creditScores(dates, inp.baa10y, inp.creditMonths);

  const rows: RsRow[] = [];
  for (const d of dates) {
    const sp = spxAt(d);
    const wo = worldAt(d);
    if (!sp && !wo) continue;
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
      sp ? sp.px : null,
      sp ? sp.dd : null,
      sp ? sp.rsiD : null,
      sp ? sp.rsiW : null,
      wo ? wo.px : null,
      wo ? wo.dd : null,
      wo ? wo.rsiD : null,
      wo ? wo.rsiW : null,
      vx ? vx.v : null,
      vixPct,
      us ? us.v : null,
      cr ? cr.v : null,
      tr ? tr.raw : null,
      tr ? tr.pct : null,
      btc,
      re,
      season?.get(d.slice(0, 7))?.score ?? null,
      credit.get(d)?.level ?? null,
      credit.get(d)?.chg3m ?? null,
      credit.get(d)?.score ?? null,
      sp ? sp.gap : null,
      sp ? sp.slope : null,
      wo ? wo.gap : null,
      wo ? wo.slope : null,
    ];
    row[1] = blend(subScores(row)).score;
    rows.push(row);
  }
  return rows;
}

/** Calendar month keys a computeRows call will produce (for buildSeasonality). */
export function rowMonthKeys(inp: Pick<RawInputs, "spx" | "world">): string[] {
  const set = new Set<string>();
  for (const r of inp.spx ?? []) if (r[0] >= DISPLAY_FROM) set.add(r[0].slice(0, 7));
  for (const r of inp.world ?? []) if (r[0] >= DISPLAY_FROM) set.add(r[0].slice(0, 7));
  return [...set].sort();
}

/** Align a daily close series to row dates (latest close ≤ row date, at most EQUITY_MAX_GAP days old). */
export function alignToRows(rows: RsRow[], series: Series | null): Array<number | null> | undefined {
  if (!series?.length) return undefined;
  const at = makeAsOf(series, EQUITY_MAX_GAP);
  return rows.map((r) => {
    const hit = at(r[0]);
    return hit ? hit.v : null;
  });
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
