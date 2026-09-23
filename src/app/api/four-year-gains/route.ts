/**
 * Relative % from the start of each window for BTC, equities, MSCI World proxy,
 * US/AU housing, and US M2.
 * Query: ?window=1y|3y|4y|5y|10y|all  (default: 4y — keeps existing route callers working)
 * Yahoo Finance chart API + FRED CSV/API (server-side; UA required). Educational — NFA.
 *
 * Series sources (documented for maintainers):
 * - btc: Yahoo BTC-USD
 * - spx: Yahoo ^GSPC
 * - ndx: Yahoo ^NDX
 * - aord: Yahoo ^AORD
 * - msci: Yahoo ACWI — chosen over URTH/VT for longest reliable Yahoo daily history
 *   (ACWI from ~Mar 2008; URTH from ~Jan 2012). iShares MSCI ACWI ETF (all-country;
 *   closest long-history MSCI World-family proxy on Yahoo).
 * - case: FRED CSUSHPISA — Case-Shiller US National Home Price Index (monthly, SA)
 * - auhouses: FRED QAUN628BIS — BIS nominal Residential Property Prices for Australia
 *   (quarterly, Index 2010=100; 8 big cities). Nominal chosen to align with Case-Shiller
 *   (also a nominal price index) for relative-% compares. QAUR628BIS is the real (CPI-
 *   deflated) sibling if a real series is preferred later.
 * - m2: FRED M2SL — US M2 money stock (monthly, SA, billions USD). Plotted as relative
 *   % from window start (same formula as equities), NOT the raw dollar level.
 *
 * Bonds intentionally omitted pending Anthony's pick (Agg TR / long Treasury / yields / skip).
 */

import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Soft network budget — Vercel hobby often kills ~10–15s; give FRED more room then fall back. */
const FRED_TIMEOUT_MS = 50_000;
const MIRROR_TIMEOUT_MS = 20_000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type SeriesId =
  | "btc"
  | "ndx"
  | "spx"
  | "aord"
  | "msci"
  | "case"
  | "auhouses"
  | "m2";

type WindowKey = "1y" | "3y" | "4y" | "5y" | "10y" | "all";

type ClosePoint = { t: number; c: number };
type PctPoint = { t: number; pct: number };

type SeriesMeta = {
  id: SeriesId;
  label: string;
  ticker: string;
  source: "yahoo" | "fred";
  yahooSymbol?: string;
  fredId?: string;
  /** Native cadence before daily forward-fill. */
  frequency: "daily" | "monthly" | "quarterly";
};

const SERIES: SeriesMeta[] = [
  {
    id: "btc",
    label: "BTC-USD",
    ticker: "BTC-USD",
    source: "yahoo",
    yahooSymbol: "BTC-USD",
    frequency: "daily",
  },
  {
    id: "ndx",
    label: "Nasdaq 100",
    ticker: "^NDX",
    source: "yahoo",
    yahooSymbol: "^NDX",
    frequency: "daily",
  },
  {
    id: "spx",
    label: "S&P 500",
    ticker: "^GSPC",
    source: "yahoo",
    yahooSymbol: "^GSPC",
    frequency: "daily",
  },
  {
    id: "aord",
    label: "All Ordinaries",
    ticker: "^AORD",
    source: "yahoo",
    yahooSymbol: "^AORD",
    frequency: "daily",
  },
  {
    // ACWI: longest Yahoo daily among URTH (2012) / ACWI (2008) / VT (2008, slightly shorter).
    id: "msci",
    label: "MSCI World",
    ticker: "ACWI",
    source: "yahoo",
    yahooSymbol: "ACWI",
    frequency: "daily",
  },
  {
    id: "case",
    label: "US real estate",
    ticker: "CSUSHPISA",
    source: "fred",
    fredId: "CSUSHPISA",
    frequency: "monthly",
  },
  {
    // FRED QAUN628BIS — BIS nominal AU residential property prices (quarterly).
    id: "auhouses",
    label: "AU homes",
    ticker: "QAUN628BIS",
    source: "fred",
    fredId: "QAUN628BIS",
    frequency: "quarterly",
  },
  {
    id: "m2",
    label: "US M2",
    ticker: "M2SL",
    source: "fred",
    fredId: "M2SL",
    frequency: "monthly",
  },
];

/** Equity trio used for ALL-window common start (preserves original ALL semantics). */
const ALL_ANCHOR_IDS: SeriesId[] = ["ndx", "spx", "aord"];

/** Calendar-day lookbacks (years × 365.25). Same window for every series. */
const WINDOW_YEARS: Record<Exclude<WindowKey, "all">, number> = {
  "1y": 1,
  "3y": 3,
  "4y": 4,
  "5y": 5,
  "10y": 10,
};

const VALID_WINDOWS = new Set<string>(["1y", "3y", "4y", "5y", "10y", "all"]);

const SERIES_ORDER: SeriesId[] = [
  "btc",
  "spx",
  "ndx",
  "aord",
  "msci",
  "case",
  "auhouses",
  "m2",
];

function windowSec(years: number) {
  return Math.round(years * 365.25 * 86400);
}

function parseWindow(raw: string | null): WindowKey {
  if (raw && VALID_WINDOWS.has(raw)) return raw as WindowKey;
  return "4y";
}

function pickClose(
  quoteClose: (number | null | undefined)[] | undefined,
  adjClose: (number | null | undefined)[] | undefined,
  i: number,
): number | null {
  const adj = adjClose?.[i];
  if (adj != null && Number.isFinite(adj) && adj > 0) return adj;
  const c = quoteClose?.[i];
  if (c != null && Number.isFinite(c) && c > 0) return c;
  return null;
}

async function fetchYahooDaily(symbol: string): Promise<ClosePoint[]> {
  // period1=0 + interval=1d keeps true daily bars. range=max often downsamples
  // to monthly/quarterly, which emptied rolling series under the base-gap check.
  const period2 = Math.floor(Date.now() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=0&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{ close?: (number | null)[] }>;
          adjclose?: Array<{ adjclose?: (number | null)[] }>;
        };
      }>;
      error?: { description?: string };
    };
  };
  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    throw new Error(
      `Yahoo ${symbol}: ${json.chart?.error?.description ?? "no data"}`,
    );
  }
  const quoteCloses = result.indicators?.quote?.[0]?.close ?? [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const out: ClosePoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = pickClose(quoteCloses, adjCloses, i);
    if (c == null) continue;
    out.push({ t: result.timestamp[i], c });
  }
  return out;
}

type FredObs = { t: number; v: number };

function parseFredCsv(text: string, seriesId: string): FredObs[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  if (!header.includes("observation_date") && !header.includes("date")) {
    return [];
  }
  const out: FredObs[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [dateStr, valStr] = line.split(",");
    if (!dateStr || valStr == null || valStr === "." || valStr === "") continue;
    const v = Number(valStr);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${dateStr.trim()}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) {
    throw new Error(`FRED ${seriesId}: no numeric observations in CSV`);
  }
  return out;
}

function softTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function fetchFredCsv(seriesId: string): Promise<FredObs[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 21600 },
    signal: softTimeout(FRED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`FRED CSV ${seriesId}: HTTP ${res.status}`);
  const text = await res.text();
  if (
    text.trimStart().startsWith("<!DOCTYPE") ||
    text.trimStart().startsWith("<html")
  ) {
    throw new Error(`FRED CSV ${seriesId}: HTML challenge page`);
  }
  return parseFredCsv(text, seriesId);
}

async function fetchFredApi(
  seriesId: string,
  apiKey: string,
): Promise<FredObs[]> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json&observation_start=1970-01-01`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 21600 },
    signal: softTimeout(FRED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`FRED API ${seriesId}: HTTP ${res.status}`);
  const json = (await res.json()) as {
    observations?: Array<{ date: string; value: string }>;
  };
  const out: FredObs[] = [];
  for (const o of json.observations ?? []) {
    if (o.value === "." || o.value === "") continue;
    const v = Number(o.value);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${o.date}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) throw new Error(`FRED API ${seriesId}: empty`);
  return out;
}

/** YYYY-Qn → quarter-start YYYY-MM-01 (Q1=01, Q2=04, Q3=07, Q4=10). */
function bisQuarterToDate(period: string): string | null {
  const m = period.trim().match(/^(\d{4})-Q([1-4])$/i);
  if (!m) return null;
  const month = ({ "1": "01", "2": "04", "3": "07", "4": "10" } as const)[
    m[2] as "1" | "2" | "3" | "4"
  ];
  return `${m[1]}-${month}-01`;
}

function parseBisSppCsv(text: string): FredObs[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerCols = lines[0].split(",").map((c) => c.trim().toUpperCase());
  const tpIdx = headerCols.indexOf("TIME_PERIOD");
  const obsIdx = headerCols.indexOf("OBS_VALUE");
  if (tpIdx < 0 || obsIdx < 0) {
    throw new Error("BIS CSV: missing TIME_PERIOD/OBS_VALUE columns");
  }
  const out: FredObs[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const period = cols[tpIdx]?.trim();
    const valStr = cols[obsIdx]?.trim();
    if (!period || !valStr || valStr === ".") continue;
    const dateStr = bisQuarterToDate(period);
    if (!dateStr) continue;
    const v = Number(valStr);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${dateStr}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) throw new Error("BIS CSV: no numeric observations");
  return out;
}

function parseHousePricesUsCsv(text: string): FredObs[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerCols = lines[0].split(",").map((c) => c.trim());
  const dateIdx = headerCols.findIndex((c) => c.toLowerCase() === "date");
  const saIdx = headerCols.findIndex(
    (c) => c.toLowerCase() === "national-us-sa",
  );
  if (dateIdx < 0 || saIdx < 0) {
    throw new Error("house-prices-us CSV: missing Date/National-US-SA");
  }
  const out: FredObs[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const dateStr = cols[dateIdx]?.trim();
    const valStr = cols[saIdx]?.trim();
    if (!dateStr || !valStr || valStr === ".") continue;
    const v = Number(valStr);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${dateStr}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) throw new Error("house-prices-us CSV: empty");
  return out;
}

function parseEco3minM2Csv(text: string): FredObs[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerCols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const dateIdx = headerCols.indexOf("date");
  const m2Idx =
    headerCols.indexOf("m2_billions") >= 0
      ? headerCols.indexOf("m2_billions")
      : headerCols.indexOf("m2sl");
  if (dateIdx < 0 || m2Idx < 0) {
    throw new Error("eco3min M2 CSV: missing date/m2_billions");
  }
  const out: FredObs[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const dateStr = cols[dateIdx]?.trim();
    const valStr = cols[m2Idx]?.trim();
    if (!dateStr || !valStr || valStr === ".") continue;
    const v = Number(valStr);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${dateStr}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) throw new Error("eco3min M2 CSV: empty");
  return out;
}

async function fetchTextMirror(
  url: string,
  label: string,
): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 21600 },
    signal: softTimeout(MIRROR_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const text = await res.text();
  if (
    text.trimStart().startsWith("<!DOCTYPE") ||
    text.trimStart().startsWith("<html")
  ) {
    throw new Error(`${label}: HTML challenge page`);
  }
  return text;
}

async function fetchLiveMirror(seriesId: string): Promise<{
  obs: FredObs[];
  origin: string;
}> {
  if (seriesId === "CSUSHPISA") {
    const text = await fetchTextMirror(
      "https://raw.githubusercontent.com/datasets/house-prices-us/main/data/national-month.csv",
      "house-prices-us",
    );
    return {
      obs: parseHousePricesUsCsv(text),
      origin: "mirror:datasets/house-prices-us National-US-SA",
    };
  }
  if (seriesId === "QAUN628BIS") {
    const text = await fetchTextMirror(
      "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_SPP/1.0/Q.AU.N.628?format=csvfile",
      "BIS WS_SPP Q.AU.N.628",
    );
    return {
      obs: parseBisSppCsv(text),
      origin: "mirror:BIS WS_SPP Q.AU.N.628",
    };
  }
  if (seriesId === "M2SL") {
    try {
      const text = await fetchTextMirror(
        "https://eco3min.fr/dataset/us-m2-money-supply.csv",
        "eco3min M2",
      );
      return {
        obs: parseEco3minM2Csv(text),
        origin: "mirror:eco3min.us-m2-money-supply",
      };
    } catch {
      const text = await fetchTextMirror(
        "https://raw.githubusercontent.com/Neo-Solon/economic_data/main/M2SL.csv",
        "Neo-Solon M2SL",
      );
      return {
        obs: parseFredCsv(text, seriesId),
        origin: "mirror:Neo-Solon/economic_data M2SL",
      };
    }
  }
  throw new Error(`No live mirror for ${seriesId}`);
}

function loadBundledFredFallback(seriesId: string): {
  obs: FredObs[];
  origin: string;
} {
  const filePath = join(
    process.cwd(),
    "src/data/fred-fallback",
    `${seriesId}.csv`,
  );
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`bundled fallback missing: ${seriesId}.csv`);
  }
  const obs = parseFredCsv(text, seriesId);
  const last = obs[obs.length - 1]!;
  const asOf = new Date(last.t * 1000).toISOString().slice(0, 7);
  return {
    obs,
    origin: `bundled-fallback ${seriesId} through ${asOf}`,
  };
}

type FredLoadResult = {
  closes: ClosePoint[];
  /** Provenance for response source / coverage notes. */
  origin: string;
  /** True when not live FRED API/CSV (mirror or on-disk bundle). */
  usedFallback: boolean;
};

async function fetchFredSeries(seriesId: string): Promise<FredLoadResult> {
  const apiKey = process.env.FRED_API_KEY?.trim() || undefined;
  const errors: string[] = [];

  if (apiKey) {
    try {
      const obs = await fetchFredApi(seriesId, apiKey);
      return {
        closes: obs.map((o) => ({ t: o.t, c: o.v })),
        origin: "fred-api",
        usedFallback: false,
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "api failed");
    }
  }

  try {
    const obs = await fetchFredCsv(seriesId);
    return {
      closes: obs.map((o) => ({ t: o.t, c: o.v })),
      origin: "fred-csv",
      usedFallback: false,
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "csv failed");
  }

  try {
    const { obs, origin } = await fetchLiveMirror(seriesId);
    return {
      closes: obs.map((o) => ({ t: o.t, c: o.v })),
      origin,
      usedFallback: true,
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "mirror failed");
  }

  try {
    const { obs, origin } = loadBundledFredFallback(seriesId);
    return {
      closes: obs.map((o) => ({ t: o.t, c: o.v })),
      origin,
      usedFallback: true,
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "bundled failed");
  }

  throw new Error(errors.join("; ") || `FRED ${seriesId} failed`);
}

/**
 * Forward-fill sparse (monthly/quarterly) observations onto a daily step so
 * lines share the chart axis with Yahoo daily series. Step holds last known
 * level until the next observation (honest step path, not interpolated).
 */
function expandSparseToDaily(closes: ClosePoint[]): ClosePoint[] {
  if (closes.length < 1) return [];
  const sorted = [...closes].sort((a, b) => a.t - b.t);
  const day = 86400;
  const nowSec = Math.floor(Date.now() / 1000);
  const out: ClosePoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    if (!out.length || out[out.length - 1]!.t !== cur.t) {
      out.push({ t: cur.t, c: cur.c });
    }
    const endExclusive =
      i + 1 < sorted.length ? sorted[i + 1]!.t : nowSec + day;
    for (let t = cur.t + day; t < endExclusive; t += day) {
      out.push({ t, c: cur.c });
    }
  }
  return out;
}

/**
 * Relative % from the window start: every series at 0% on the left,
 * then the path of that window's performance. End value = window return
 * (matches the bar / KPI).
 */
function windowRelative(
  closes: ClosePoint[],
  fromSec: number,
  toSec: number,
): { points: PctPoint[]; usedFallbackBase: boolean } {
  if (closes.length < 2) return { points: [], usedFallbackBase: false };
  let base: ClosePoint | null = null;
  for (const p of closes) {
    if (p.t > toSec) break;
    if (p.c <= 0) continue;
    if (p.t <= fromSec) base = p;
  }
  const inWin = closes.filter(
    (p) => p.t >= fromSec && p.t <= toSec && p.c > 0,
  );
  if (!inWin.length) return { points: [], usedFallbackBase: false };
  let usedFallbackBase = false;
  if (!base || base.c <= 0) {
    base = inWin[0]!;
    usedFallbackBase = true;
  }
  const out: PctPoint[] = [];
  for (const p of inWin) {
    const pct = (p.c / base.c - 1) * 100;
    if (!Number.isFinite(pct)) continue;
    out.push({ t: p.t, pct: Math.max(pct, -100) });
  }
  return { points: out, usedFallbackBase };
}

function firstPositive(closes: ClosePoint[]): ClosePoint | null {
  return closes.find((p) => p.c > 0) ?? null;
}

/** Evenly downsample inside the (already clipped) window; always keep first & last. */
function downsample(points: PctPoint[], maxPts: number): PctPoint[] {
  if (points.length <= maxPts) return points;
  if (maxPts < 2) return [points[points.length - 1]];
  const out: PctPoint[] = [];
  const lastIdx = points.length - 1;
  for (let k = 0; k < maxPts; k++) {
    const i = Math.round((k * lastIdx) / (maxPts - 1));
    const p = points[i];
    if (!out.length || out[out.length - 1].t !== p.t) out.push(p);
  }
  const last = points[lastIdx];
  if (out[out.length - 1]?.t !== last.t) out.push(last);
  return out;
}

function isoDate(ts: number) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function windowMeta(key: WindowKey) {
  if (key === "all") {
    return {
      window: key as WindowKey,
      windowLabel: "All time",
      windowShort: "ALL",
      mode: "relative" as const,
      windowDays: null as number | null,
      windowSec: null as number | null,
      title: "All-time index relative %",
      definition:
        "ALL line = Nasdaq 100, S&P 500 and All Ordinaries from the first date all three exist on Yahoo (NDX daily from Oct 1985), each at 0% on the left. Optional series (MSCI ACWI, Case-Shiller, AU homes, US M2) join when selected; shorter history is marked partial. Bitcoin is omitted from the ALL line (Yahoo daily BTC-USD only from Sep 2014) and kept on the bars / chips as its own all-time return. Educational only — not financial advice (NFA).",
    };
  }
  const years = WINDOW_YEARS[key];
  const sec = windowSec(years);
  const days = Math.round(sec / 86400);
  return {
    window: key as WindowKey,
    windowLabel: `${years}-year`,
    windowShort: key.toUpperCase(),
    mode: "relative" as const,
    windowDays: days,
    windowSec: sec,
    title: `Relative % over ${years} year${years === 1 ? "" : "s"}`,
    definition: `Each line starts at 0% at the left of the window (close ~${years} calendar year${years === 1 ? "" : "s"} ago) and plots percentage return to each later close. Same start date across selected series (BTC-USD, equities, MSCI ACWI, Case-Shiller, AU homes, US M2 % change). End of the line is the window return (matches the bar). Educational only — not financial advice (NFA).`,
  };
}

type LoadedSeries = {
  closes: ClosePoint[];
  origin: string;
  usedFallback: boolean;
};

async function loadSeriesCloses(meta: SeriesMeta): Promise<LoadedSeries> {
  if (meta.source === "yahoo") {
    if (!meta.yahooSymbol) throw new Error(`${meta.id}: missing yahooSymbol`);
    const closes = await fetchYahooDaily(meta.yahooSymbol);
    return { closes, origin: "yahoo", usedFallback: false };
  }
  if (!meta.fredId) throw new Error(`${meta.id}: missing fredId`);
  const { closes: sparse, origin, usedFallback } = await fetchFredSeries(
    meta.fredId,
  );
  // Monthly/quarterly → daily step so the shared axis can plot them.
  return {
    closes: expandSparseToDaily(sparse),
    origin,
    usedFallback,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowKey = parseWindow(searchParams.get("window"));
  const meta = windowMeta(windowKey);

  const errors: Record<string, string> = {};
  const closesById: Partial<Record<SeriesId, ClosePoint[]>> = {};
  const originById: Partial<Record<SeriesId, string>> = {};
  const fallbackById: Partial<Record<SeriesId, boolean>> = {};

  await Promise.all(
    SERIES.map(async (sMeta) => {
      try {
        const loaded = await loadSeriesCloses(sMeta);
        closesById[sMeta.id] = loaded.closes;
        originById[sMeta.id] = loaded.origin;
        fallbackById[sMeta.id] = loaded.usedFallback;
      } catch (e) {
        errors[sMeta.id] = e instanceof Error ? e.message : "fetch failed";
      }
    }),
  );

  const loaded = SERIES.filter((s) => closesById[s.id]?.length);
  if (!loaded.length) {
    return Response.json(
      {
        ok: false,
        error: "Could not load any series",
        errors,
        ...meta,
      },
      { status: 502 },
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  let displayCutoff: number | null;
  const btcFirst = firstPositive(closesById.btc ?? [])?.t ?? null;
  if (windowKey === "all") {
    const anchorFirsts = ALL_ANCHOR_IDS.map(
      (id) => firstPositive(closesById[id] ?? [])?.t,
    ).filter((t): t is number => t != null);
    if (anchorFirsts.length) {
      displayCutoff = Math.max(...anchorFirsts);
    } else {
      const indexFirsts = loaded
        .filter((s) => s.id !== "btc")
        .map((s) => firstPositive(closesById[s.id] ?? [])?.t)
        .filter((t): t is number => t != null);
      displayCutoff = indexFirsts.length ? Math.max(...indexFirsts) : null;
    }
  } else {
    displayCutoff = nowSec - windowSec(WINDOW_YEARS[windowKey]);
  }

  const series: Array<{
    id: SeriesId;
    label: string;
    ticker: string;
    points: PctPoint[];
    latestPct: number | null;
    startDate?: string;
    coverage: "full" | "partial";
    /** yahoo | fred, or fred with mirror/bundled note when live FRED timed out. */
    source: string;
    frequency: "daily" | "monthly" | "quarterly";
  }> = [];

  const seriesStarts: Partial<Record<SeriesId, string>> = {};

  for (const sMeta of SERIES) {
    const closes = closesById[sMeta.id];
    if (!closes?.length) continue;
    try {
      const cutoff =
        windowKey === "all" && sMeta.id === "btc"
          ? btcFirst
          : displayCutoff ?? firstPositive(closes)?.t;
      if (cutoff == null) continue;
      const { points: pct, usedFallbackBase } = windowRelative(
        closes,
        cutoff,
        nowSec,
      );
      const points = downsample(pct, 900);
      const latestPct = points.length ? points[points.length - 1]!.pct : null;
      const startDate = points.length ? isoDate(points[0]!.t) : isoDate(cutoff);
      seriesStarts[sMeta.id] = startDate;

      // Honest coverage: partial if the series has no observation at/before window
      // start (shorter history than the shared domain), OR when serving
      // mirror/bundled FRED data (may lag live FRED). Coarser FRED cadences are
      // still "full" when they span the window — the step fill is documented in footer.
      const usedDataFallback = Boolean(fallbackById[sMeta.id]);
      const coverage: "full" | "partial" =
        usedFallbackBase || usedDataFallback ? "partial" : "full";
      const origin = originById[sMeta.id] ?? sMeta.source;
      const sourceLabel =
        sMeta.source === "yahoo"
          ? "yahoo"
          : usedDataFallback
            ? `fred (${origin})`
            : "fred";

      series.push({
        id: sMeta.id,
        label: sMeta.label,
        ticker: sMeta.ticker,
        points,
        latestPct,
        coverage,
        startDate,
        source: sourceLabel,
        frequency: sMeta.frequency,
      });
    } catch (e) {
      errors[sMeta.id] = e instanceof Error ? e.message : "compute failed";
    }
  }

  series.sort(
    (a, b) => SERIES_ORDER.indexOf(a.id) - SERIES_ORDER.indexOf(b.id),
  );

  if (!series.length) {
    return Response.json(
      {
        ok: false,
        error: "Could not compute any series",
        errors,
        ...meta,
      },
      { status: 502 },
    );
  }

  return Response.json(
    {
      ok: true,
      title: meta.title,
      definition: meta.definition,
      window: meta.window,
      windowLabel: meta.windowLabel,
      windowShort: meta.windowShort,
      mode: meta.mode,
      windowDays: meta.windowDays,
      windowSec: meta.windowSec,
      // Shared display domain for rolling LINE charts (client must use this, not min of points)
      displayFrom: displayCutoff,
      displayTo: nowSec,
      commonStart: displayCutoff != null ? isoDate(displayCutoff) : null,
      seriesStarts: Object.keys(seriesStarts).length ? seriesStarts : undefined,
      availableWindows: ["1y", "3y", "4y", "5y", "10y", "all"],
      source:
        "Yahoo Finance chart API (query1) + FRED (CSUSHPISA, QAUN628BIS, M2SL); mirrors/bundled CSV if FRED times out",
      seriesOrigins: Object.keys(originById).length ? originById : undefined,
      tickers: SERIES.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        label: s.label,
        source: s.source,
      })),
      series,
      errors: Object.keys(errors).length ? errors : undefined,
      asOf: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
