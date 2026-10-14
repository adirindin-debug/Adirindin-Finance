/**
 * Market sentiment gauge (v2) — a calm, rough-overview 0–100 blend built only
 * from publicly available, openly displayable sources:
 *  - OFR Financial Stress Index (US Treasury, Office of Financial Research) —
 *    overall index plus its volatility, equity-valuation and credit categories
 *  - Chicago Fed National Financial Conditions Index (NFCI), weekly
 *  - St. Louis Fed Financial Stress Index (STLFSI4), weekly
 *  - Alternative.me Crypto Fear & Greed (attribution shown beside it)
 *  - Seasonality of the calendar month (derived monthly statistic)
 * Stress readings are ranked against their own prior history (no look-ahead) and
 * flipped so that low stress = hotter. Missing inputs drop out and the rest
 * re-scale; nothing is filled in. Educational only · NFA.
 */
import { ZONES, zoneFor, seasonTag, type Zone } from "@/lib/riskSentiment";

export { ZONES, zoneFor, seasonTag };

export type InputKey = "ofr" | "ofrVol" | "ofrEq" | "ofrCredit" | "nfci" | "stlfsi" | "cryptoFng" | "season";

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
    weight: 22,
    color: "#4ade80",
    how: "Daily OFR Financial Stress Index, ranked against the prior 5 years. Score = 100 − percentile, so low stress reads hotter.",
    source: "Office of Financial Research (US Treasury) — OFR Financial Stress Index",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index.",
  },
  {
    key: "ofrVol",
    label: "Market volatility (OFR FSI volatility category)",
    short: "Volatility",
    weight: 14,
    color: "#a78bfa",
    how: "The volatility category of the OFR index (implied and realised volatility across markets), ranked against the prior 5 years and flipped.",
    source: "Office of Financial Research — OFR FSI category contributions",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index.",
  },
  {
    key: "ofrEq",
    label: "Equity valuation (OFR FSI equity category)",
    short: "Equity valuation",
    weight: 14,
    color: "#38bdf8",
    how: "The equity-valuation category of the OFR index (stock valuations across regions), ranked against the prior 5 years and flipped — rich valuations read hotter.",
    source: "Office of Financial Research — OFR FSI category contributions",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index.",
  },
  {
    key: "ofrCredit",
    label: "Credit conditions (OFR FSI credit category)",
    short: "Credit",
    weight: 10,
    color: "#fb923c",
    how: "The credit category of the OFR index (corporate bond spreads), ranked against the prior 5 years and flipped — tight spreads read hotter.",
    source: "Office of Financial Research — OFR FSI category contributions",
    sourceUrl: "https://www.financialresearch.gov/financial-stress-index/",
    licence: "US Government work, published free for public use.",
    credit: "Source: Office of Financial Research, OFR Financial Stress Index.",
  },
  {
    key: "nfci",
    label: "US financial conditions (Chicago Fed NFCI)",
    short: "Chicago Fed NFCI",
    weight: 12,
    color: "#2dd4bf",
    how: "Weekly NFCI, ranked against the prior 10 years and flipped — looser conditions read hotter. Each week is used from about 6 days after its date (when it is published).",
    source: "Federal Reserve Bank of Chicago — National Financial Conditions Index, via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/NFCI",
    licence: "No third-party copyright notice on FRED; free to use with citation.",
    credit: "Federal Reserve Bank of Chicago, NFCI, retrieved from FRED, Federal Reserve Bank of St. Louis.",
  },
  {
    key: "stlfsi",
    label: "Financial stress (St. Louis Fed STLFSI4)",
    short: "St. Louis Fed stress",
    weight: 8,
    color: "#94a3b8",
    how: "Weekly St. Louis Fed Financial Stress Index, ranked against the prior 10 years and flipped. Used from about 6 days after its date.",
    source: "Federal Reserve Bank of St. Louis — STLFSI4, via FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/STLFSI4",
    licence: "St. Louis Fed's own series; no third-party copyright notice; free to use with citation.",
    credit: "Federal Reserve Bank of St. Louis, STLFSI4, retrieved from FRED.",
  },
  {
    key: "cryptoFng",
    label: "Crypto Fear & Greed (Alternative.me)",
    short: "Crypto F&G",
    weight: 12,
    color: "#f7931a",
    how: "Alternative.me daily Crypto Fear & Greed score, used as-is (0–100).",
    source: "Alternative.me — Crypto Fear & Greed Index API",
    sourceUrl: "https://alternative.me/crypto/fear-and-greed-index/",
    licence: "Free to use, including commercially, with attribution shown next to the data.",
    credit: "Crypto Fear & Greed data: Alternative.me.",
  },
  {
    key: "season",
    label: "Seasonality (calendar month)",
    short: "Seasonality",
    weight: 8,
    color: "#e879f9",
    how: "This calendar month's average S&P 500 return and green-month odds vs an average month (in standard errors), using only months completed before the date. 50 = an average month.",
    source: "Adirindin calculation from historical S&P 500 month-end closes (stored dataset)",
    sourceUrl: "https://adirindinfinance.com/charts/seasonality",
    licence: "Derived monthly statistic only — no prices are shown.",
    credit: "Seasonality: Adirindin calculation.",
  },
];

export const INPUT_KEYS = INPUTS.map((i) => i.key);
export const MIN_WEIGHT = 40;
/** Smoothing spans in sessions. */
export const SMOOTH = { raw: null, ema10: 10, ema42: 42 } as const;
export type SmoothKey = keyof typeof SMOOTH;
export const SMOOTH_OPTIONS: Array<{ key: SmoothKey; label: string; name: string }> = [
  { key: "ema42", label: "2-month", name: "~2-month average (42-session EMA)" },
  { key: "ema10", label: "10-day", name: "10-day average (EMA)" },
  { key: "raw", label: "Raw", name: "Raw daily blend" },
];
export const DEFAULT_SMOOTH: SmoothKey = "ema42";
/** Zone label only changes once the score is this many points past a boundary. */
export const HYSTERESIS_PTS = 5;

export type Series = Array<[string, number]>;

/**
 * Row: [date, raw, ema10, ema42, ofr, ofrVol, ofrEq, ofrCredit, nfci, stlfsi, cryptoFng, season]
 * Sub-scores are 0–100 (higher = hotter); null when that input has no data.
 */
export type MsRow = [string, ...Array<number | null>];
/** Numeric cell of a row (index ≥ 1). */
export const cell = (r: MsRow, k: number) => r[k] as number | null;
export const SUB_OFFSET = 4;

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

export function blendRow(subs: Array<number | null>): number | null {
  let w = 0;
  let acc = 0;
  INPUTS.forEach((m, i) => {
    const v = subs[i];
    if (v == null || !Number.isFinite(v)) return;
    w += m.weight;
    acc += m.weight * v;
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
  generated: string;
  error?: string;
};

export function summarize(p: MsPayload): MsSummary {
  const base = { asOf: p.asOf, generated: p.generated, error: p.error };
  const rows = p.rows ?? [];
  const sc = rows.map((r) => cell(r, 3));
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
  };
}

export { clamp };
