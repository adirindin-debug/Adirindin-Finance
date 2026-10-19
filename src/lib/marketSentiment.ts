/**
 * Market sentiment gauge (v2) — a calm, rough-overview 0–100 blend built only
 * from publicly available, openly displayable sources:
 *  - OFR Financial Stress Index (US Treasury, Office of Financial Research) —
 *    overall index plus its volatility, equity-valuation and credit categories
 *  - Chicago Fed National Financial Conditions Index (NFCI), weekly
 *  - St. Louis Fed Financial Stress Index (STLFSI4), weekly
 *  - Alternative.me Crypto Fear & Greed (attribution shown beside it)
 *  - Seasonality of the calendar month (derived monthly statistic)
 *  - Global breadth: share of 17 country share-price indices (OECD, via FRED)
 *    above their 10-month average (v3)
 * Stress readings are ranked against their own prior history (no look-ahead) and
 * flipped so that low stress = hotter. Missing inputs drop out and the rest
 * re-scale; nothing is filled in. Educational only.
 */
import { ZONES, zoneFor, seasonTag, type Zone } from "@/lib/riskSentiment";

export { ZONES, zoneFor, seasonTag };

export type InputKey = "ofr" | "ofrVol" | "ofrEq" | "ofrCredit" | "nfci" | "stlfsi" | "cryptoFng" | "season" | "breadth";

export type InputMeta = {
  key: InputKey;
  label: string;
  short: string;
  weight: number;
  color: string;
  how: string;
  source: string;
  sourceUrl: string;
  licence: string;
  credit: string;
};

export const INPUTS: InputMeta[] = [
  {
    key: "ofr",
    label: "Financial stress (OFR FSI, overall)",
    short: "OFR stress",
    weight: 20.9,
    color: "#4ade80",
    how: "Daily OFR Financial Stress Index, ranked against the prior 5 years. Score = 100 − percentile, so low stress reads hotter.",
    source: "Office of Financial Research (US Treasury) — OFR Financial Stress Index (overall)",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index.",
  },
  {
    key: "ofrVol",
    label: "Market volatility (OFR FSI volatility category)",
    short: "Volatility",
    weight: 13.3,
    color: "#a78bfa",
    how: "The volatility category of the OFR index (implied and realised volatility across markets), ranked against the prior 5 years and flipped.",
    source: "Office of Financial Research — OFR Financial Stress Index, volatility category",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index (volatility category).",
  },
  {
    key: "ofrEq",
    label: "Equity valuation (OFR FSI equity category)",
    short: "Equity valuation",
    weight: 13.3,
    color: "#38bdf8",
    how: "The equity-valuation category of the OFR index (stock valuations across regions), ranked against the prior 5 years and flipped — rich valuations read hotter.",
    source: "Office of Financial Research — OFR Financial Stress Index, equity valuation category",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index (equity valuation category).",
  },
  {
    key: "ofrCredit",
    label: "Credit conditions (OFR FSI credit category)",
    short: "Credit",
    weight: 9.5,
    color: "#fb923c",
    how: "The credit category of the OFR index (corporate bond spreads), ranked against the prior 5 years and flipped — tight spreads read hotter.",
    source: "Office of Financial Research — OFR Financial Stress Index, credit category",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index (credit category).",
  },
  {
    key: "nfci",
    label: "US financial conditions (Chicago Fed NFCI)",
    short: "Chicago Fed NFCI",
    weight: 11.4,
    color: "#2dd4bf",
    how: "Weekly NFCI, ranked against the prior 10 years and flipped — looser conditions read hotter. Each week is used from about 6 days after its date (when it is published).",
    source: "Federal Reserve Bank of Chicago — National Financial Conditions Index, via FRED",
    sourceUrl: "https://www.chicagofed.org/research/data/nfci/current-data",
    licence: "No third-party copyright notice on FRED; free to use with citation.",
    credit: "Source: Federal Reserve Bank of Chicago, National Financial Conditions Index (NFCI); data retrieved via FRED.",
  },
  {
    key: "stlfsi",
    label: "Financial stress (St. Louis Fed STLFSI4)",
    short: "St. Louis Fed stress",
    weight: 7.6,
    color: "#94a3b8",
    how: "Weekly St. Louis Fed Financial Stress Index, ranked against the prior 10 years and flipped. Used from about 6 days after its date.",
    source: "Federal Reserve Bank of St. Louis — STLFSI4, via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/STLFSI4",
    licence: "St. Louis Fed's own series; no third-party copyright notice; free to use with citation.",
    credit: "Source: Federal Reserve Bank of St. Louis, St. Louis Fed Financial Stress Index (STLFSI4), retrieved from FRED.",
  },
  {
    key: "cryptoFng",
    label: "Crypto Fear & Greed (Alternative.me)",
    short: "Crypto F&G",
    weight: 11.4,
    color: "#f7931a",
    how: "Alternative.me daily Crypto Fear & Greed score, used as-is (0–100).",
    source: "Alternative.me — Crypto Fear & Greed Index API",
    sourceUrl: "https://alternative.me/crypto/fear-and-greed-index/",
    licence: "Free to use, including commercially, with attribution shown next to the data.",
    credit: "Source: Crypto Fear & Greed Index by Alternative.me.",
  },
  {
    key: "season",
    label: "Seasonality (calendar month)",
    short: "Seasonality",
    weight: 7.6,
    color: "#e879f9",
    how: "This calendar month's average S&P 500 return and green-month odds vs an average month (in standard errors), using only months completed before the date. 50 = an average month.",
    source: "Adirindin calculation from monthly S&P 500 index returns (month-end closes originally sourced from Yahoo Finance)",
    sourceUrl: "/charts/seasonality/equities",
    licence: "Derived monthly statistic only — no prices are shown. Underlying price data licence under review.",
    credit: "Seasonality: Adirindin calculation from monthly S&P 500 returns; underlying price data: Yahoo Finance.",
  },
  {
    key: "breadth",
    label: "Global breadth (share of 17 country markets above their 10-month average)",
    short: "Global breadth",
    weight: 5,
    color: "#fde047",
    how: "Share of 17 country share-price indices (OECD Main Economic Indicators) whose monthly level is above its own 10-month average — the monthly stand-in for a 200-day average. Used as-is (0–100). Each month is used from about 6 weeks after it ends, when it is published, so this input runs behind daily markets.",
    source: "OECD Main Economic Indicators — share prices (SPASTT01…M661N), via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/SPASTT01USM661N",
    licence: "OECD data, CC BY 4.0; retrieved via FRED.",
    credit: "Source: OECD, Main Economic Indicators — share prices (17 countries), retrieved from FRED; breadth is an Adirindin calculation.",
  },
];

/** v2 weights (before breadth) — kept for comparison and the backtest. */
export const V2_WEIGHTS: Record<InputKey, number> = {
  ofr: 22, ofrVol: 14, ofrEq: 14, ofrCredit: 10, nfci: 12, stlfsi: 8, cryptoFng: 12, season: 8, breadth: 0,
};

/** Countries in the breadth input (FRED SPASTT01{code}M661N). BR and MX start later — high-inflation years make a nominal index sit above any average. */
export const BREADTH_COUNTRIES: Array<{ code: string; name: string; from?: string }> = [
  { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" }, { code: "DE", name: "Germany" },
  { code: "JP", name: "Japan" }, { code: "FR", name: "France" }, { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" }, { code: "KR", name: "Korea" }, { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" }, { code: "NL", name: "Netherlands" }, { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" }, { code: "IN", name: "India" }, { code: "BR", name: "Brazil", from: "1995-01" },
  { code: "MX", name: "Mexico", from: "1990-01" }, { code: "ZA", name: "South Africa" },
];
export const BREADTH_MA_MONTHS = 10;
export const BREADTH_MIN_COUNTRIES = 10;

/** Monthly breadth [YYYY-MM, share %, countries] from monthly country index series (YYYY-MM-DD dated). */
export function breadthMonths(byCountry: Record<string, Series>): Array<[string, number, number]> {
  const above = new Map<string, { up: number; n: number }>();
  for (const c of BREADTH_COUNTRIES) {
    const s = (byCountry[c.code] ?? []).filter(([d, v]) => v > 0 && (!c.from || d.slice(0, 7) >= c.from));
    for (let i = BREADTH_MA_MONTHS - 1; i < s.length; i++) {
      let sum = 0;
      for (let k = i - BREADTH_MA_MONTHS + 1; k <= i; k++) sum += s[k]![1];
      const m = s[i]![0].slice(0, 7);
      const a = above.get(m) ?? { up: 0, n: 0 };
      a.n++;
      if (s[i]![1] > sum / BREADTH_MA_MONTHS) a.up++;
      above.set(m, a);
    }
  }
  return [...above.entries()]
    .filter(([, a]) => a.n >= BREADTH_MIN_COUNTRIES)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([m, a]) => [m, Math.round((1000 * a.up) / a.n) / 10, a.n]);
}

/** Date a month's OECD value is treated as public: the 15th of the second month after it (~6 weeks after month end). */
export function breadthAvailable(month: string): string {
  let y = Number(month.slice(0, 4));
  let m = Number(month.slice(5, 7)) + 2;
  if (m > 12) {
    m -= 12;
    y++;
  }
  return `${y}-${String(m).padStart(2, "0")}-15`;
}

/* ---- Valuation cap (v3) ---- */
/** The equity-valuation sub-score is capped here unless other inputs are stretched too. */
export const VALUATION_CAP = 65;
/** A "stretched" reading for the cap check. */
export const STRETCH_AT = 70;
/** How many of volatility, credit, NFCI and breadth must also be stretched to lift the cap. */
export const STRETCH_NEEDED = 2;

/** Index of each input in the row's sub-score block. */
export const IDX = Object.fromEntries(INPUTS.map((m, i) => [m.key, i])) as Record<InputKey, number>;

/** True when the valuation cap applies to these sub-scores. */
export function capApplies(subs: Array<number | null>): boolean {
  const eq = subs[IDX.ofrEq];
  if (eq == null || eq <= VALUATION_CAP) return false;
  const others = [subs[IDX.ofrVol], subs[IDX.ofrCredit], subs[IDX.nfci], subs[IDX.breadth]];
  return others.filter((v) => v != null && v >= STRETCH_AT).length < STRETCH_NEEDED;
}

/* ---- Complacency watch (v3) ---- */
export const WATCH_SCORE = 65;
export const WATCH_NEEDED = 2;
export const WATCH_CONDITIONS = [
  { bit: 1, label: "Volatility in the bottom 10% of its 5-year range (OFR volatility category)" },
  { bit: 2, label: "Credit stress up on three months ago while valuation stress is low (OFR credit and equity categories)" },
  { bit: 4, label: "Breadth down 15+ points on three months ago while valuations are rich (OECD breadth, OFR equity category)" },
  { bit: 8, label: "Chicago Fed NFCI rising from below −0.4 (conditions tightening from very loose)" },
] as const;
/** Flag bit set when the valuation cap was applied that day. */
export const CAP_BIT = 16;
export const bitCount = (f: number) => [1, 2, 4, 8].filter((b) => f & b).length;

export const INPUT_KEYS = INPUTS.map((i) => i.key);
export const MIN_WEIGHT = 40;
/** Smoothing spans in sessions. */
export const SMOOTH = { raw: null, ema10: 10, ema42: 42 } as const;
export type SmoothKey = keyof typeof SMOOTH;
export const SMOOTH_OPTIONS: Array<{ key: SmoothKey; label: string; name: string }> = [
  { key: "ema10", label: "10-day", name: "10-day average (EMA)" },
  { key: "ema42", label: "2-month", name: "~2-month average (42-session EMA)" },
  { key: "raw", label: "Raw", name: "Raw daily blend" },
];
export const DEFAULT_SMOOTH: SmoothKey = "ema10";
/** Row column of each smoothing (see MsRow). */
export const SCORE_COL: Record<SmoothKey, number> = { raw: 1, ema10: 2, ema42: 3 };
/** Zone label only changes once the score is this many points past a boundary. */
export const HYSTERESIS_PTS = 5;

export type Series = Array<[string, number]>;

/**
 * Row: [date, raw, ema10, ema42, ofr, ofrVol, ofrEq, ofrCredit, nfci, stlfsi, cryptoFng, season, breadth, flags, watch]
 * Sub-scores are 0–100 (higher = hotter); null when that input has no data.
 * flags = bitmask of complacency conditions (1,2,4,8) plus CAP_BIT; watch = 1 when the badge is on.
 */
export type MsRow = [string, ...Array<number | null>];
/** Numeric cell of a row (index ≥ 1). */
export const cell = (r: MsRow, k: number) => r[k] as number | null;
export const SUB_OFFSET = 4;
export const FLAGS_COL = SUB_OFFSET + 9;
export const WATCH_COL = SUB_OFFSET + 10;

export type SourceStatus = { key: string; label: string; ok: boolean; asOf: string | null; note?: string };

export type MsPayload = {
  ok: boolean;
  rows: MsRow[];
  overlay?: { spx?: Array<number | null>; ixic?: Array<number | null>; urth?: Array<number | null> };
  season?: { month: string; score: number; avg: number; baseAvg: number; n: number } | null;
  asOf: string | null;
  sources: SourceStatus[];
  warnings?: string[];
  error?: string;
  generated: string;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Percentile (0–100) of each value against values strictly before it within the
 * look-back window. Null until `minObs` prior values exist.
 */
export function rollingPercentile(series: Series, years: number, minObs: number): Series {
  const out: Series = [];
  const ms = years * 365.25 * 86_400_000;
  let lo = 0;
  for (let i = 0; i < series.length; i++) {
    const t = Date.parse(series[i]![0]);
    while (lo < i && Date.parse(series[lo]![0]) < t - ms) lo++;
    const n = i - lo;
    if (n < minObs) continue;
    const v = series[i]![1];
    let below = 0;
    for (let j = lo; j < i; j++) if (series[j]![1] < v) below++;
    out.push([series[i]![0], (below / n) * 100]);
  }
  return out;
}

/** Shift a series' dates forward (publication lag), so history never peeks ahead. */
export function shiftDays(series: Series, days: number): Series {
  return series.map(([d, v]) => [new Date(Date.parse(`${d}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10), v]);
}

/** Value on or before each date (step forward-fill), aligned to `dates`; null beyond `maxGapDays`. */
export function alignStep(dates: string[], series: Series | null, maxGapDays: number): Array<number | null> {
  if (!series?.length) return dates.map(() => null);
  const out: Array<number | null> = [];
  let j = -1;
  for (const d of dates) {
    while (j + 1 < series.length && series[j + 1]![0] <= d) j++;
    if (j < 0) {
      out.push(null);
      continue;
    }
    const gap = (Date.parse(d) - Date.parse(series[j]![0])) / 86_400_000;
    out.push(gap <= maxGapDays ? series[j]![1] : null);
  }
  return out;
}

export function ema(values: Array<number | null>, span: number): Array<number | null> {
  const k = 2 / (span + 1);
  let e: number | null = null;
  return values.map((v) => {
    if (v == null) return e == null ? null : r1(e);
    e = e == null ? v : e + k * (v - e);
    return r1(e);
  });
}

/**
 * Weighted blend over inputs with data (weights re-scale). v3 applies the
 * valuation cap; pass `weights` = V2_WEIGHTS and cap=false to reproduce v2.
 */
export function blendRow(
  subs: Array<number | null>,
  weights: Record<InputKey, number> | null = null,
  cap = true,
): number | null {
  let w = 0;
  let acc = 0;
  const capped = cap && capApplies(subs);
  INPUTS.forEach((m, i) => {
    let v = subs[i];
    if (v == null || !Number.isFinite(v)) return;
    const wt = weights ? weights[m.key] : m.weight;
    if (!wt) return;
    if (capped && m.key === "ofrEq") v = Math.min(v, VALUATION_CAP);
    w += wt;
    acc += wt * v;
  });
  return w >= MIN_WEIGHT ? r1(acc / w) : null;
}

export function weightWithData(subs: Array<number | null>): number {
  return INPUTS.reduce((a, m, i) => a + (subs[i] != null ? m.weight : 0), 0);
}

/**
 * Zone per point with hysteresis: the label only moves to a new zone once the
 * score is HYSTERESIS_PTS beyond the boundary it crossed.
 */
export function zonesWithHysteresis(scores: Array<number | null>, band = HYSTERESIS_PTS): Array<Zone | null> {
  let cur: Zone | null = null;
  return scores.map((s) => {
    if (s == null) return cur;
    const z = zoneFor(s);
    if (!cur) cur = z;
    else if (z.key !== cur.key) {
      const boundary = z.min >= cur.max ? cur.max : cur.min;
      if (Math.abs(s - boundary) >= band) cur = z;
    }
    return cur;
  });
}

/** Plain-language reading of a zone (non-alarming). */
export function zoneLine(z: Zone): string {
  switch (z.key) {
    case "washout":
      return "Broad stress is high and sentiment is very low.";
    case "repair":
      return "Conditions are still soft but easing off the lows.";
    case "neutral":
      return "A mixed backdrop — nothing stretched either way.";
    case "hot":
      return "Calm stress readings and firm risk appetite.";
    default:
      return "Most readings are stretched to the hot side at once.";
  }
}

export type MsSummary = {
  ok: boolean;
  asOf: string | null;
  score: number | null;
  raw: number | null;
  zone: { key: string; label: string; color: string; blurb: string } | null;
  change3m: number | null;
  season: { label: string; color: string } | null;
  /** Complacency watch on for the latest day. */
  watch?: boolean;
  generated: string;
  error?: string;
};

export function summarize(p: MsPayload): MsSummary {
  const base = { asOf: p.asOf, generated: p.generated, error: p.error };
  const rows = p.rows ?? [];
  const sc = rows.map((r) => cell(r, SCORE_COL[DEFAULT_SMOOTH]));
  let i = rows.length - 1;
  while (i >= 0 && sc[i] == null) i--;
  if (!p.ok || i < 0) return { ...base, ok: false, score: null, raw: null, zone: null, change3m: null, season: null };
  const zones = zonesWithHysteresis(sc);
  const z = zones[i]!;
  const cutoff = new Date(Date.parse(`${rows[i]![0]}T00:00:00Z`) - 91 * 86_400_000).toISOString().slice(0, 10);
  let j = i;
  while (j >= 0 && rows[j]![0] > cutoff) j--;
  const prev = j >= 0 ? sc[j] : null;
  const seasonSub = cell(rows[i]!, SUB_OFFSET + 7);
  const tag = seasonSub != null ? seasonTag(seasonSub) : null;
  return {
    ...base,
    ok: true,
    asOf: rows[i]![0],
    score: sc[i]!,
    raw: cell(rows[i]!, 1),
    zone: { key: z.key, label: z.label, color: z.color, blurb: zoneLine(z) },
    change3m: prev != null ? r1(sc[i]! - prev) : null,
    season: tag ? { label: tag.label, color: tag.color } : null,
    watch: cell(rows[i]!, WATCH_COL) === 1,
  };
}

export { clamp };
