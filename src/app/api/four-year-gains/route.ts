/**
 * Relative % from the start of each window for BTC vs major equity indices.
 * Query: ?window=1y|3y|4y|5y|10y|all  (default: 4y — keeps existing route callers working)
 * Yahoo Finance chart API (server-side; UA required). Educational — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type SeriesId = "btc" | "ndx" | "spx" | "aord";
type WindowKey = "1y" | "3y" | "4y" | "5y" | "10y" | "all";

type ClosePoint = { t: number; c: number };
type PctPoint = { t: number; pct: number };

type SeriesMeta = {
  id: SeriesId;
  label: string;
  ticker: string;
  yahooSymbol: string;
};

const SERIES: SeriesMeta[] = [
  { id: "btc", label: "BTC-USD", ticker: "BTC-USD", yahooSymbol: "BTC-USD" },
  { id: "ndx", label: "Nasdaq 100", ticker: "^NDX", yahooSymbol: "^NDX" },
  { id: "spx", label: "S&P 500", ticker: "^GSPC", yahooSymbol: "^GSPC" },
  {
    id: "aord",
    label: "All Ordinaries",
    ticker: "^AORD",
    yahooSymbol: "^AORD",
  },
];

/** Calendar-day lookbacks (years × 365.25). Same window for every series. */
const WINDOW_YEARS: Record<Exclude<WindowKey, "all">, number> = {
  "1y": 1,
  "3y": 3,
  "4y": 4,
  "5y": 5,
  "10y": 10,
};

const VALID_WINDOWS = new Set<string>(["1y", "3y", "4y", "5y", "10y", "all"]);

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

/**
 * Relative % from the window start: every series at 0% on the left,
 * then the path of that window's performance. End value = window return
 * (matches the bar / KPI).
 */
function windowRelative(
  closes: ClosePoint[],
  fromSec: number,
  toSec: number,
): PctPoint[] {
  if (closes.length < 2) return [];
  let base: ClosePoint | null = null;
  for (const p of closes) {
    if (p.t > toSec) break;
    if (p.c <= 0) continue;
    if (p.t <= fromSec) base = p;
  }
  const inWin = closes.filter(
    (p) => p.t >= fromSec && p.t <= toSec && p.c > 0,
  );
  if (!inWin.length) return [];
  if (!base || base.c <= 0) base = inWin[0]!;
  const out: PctPoint[] = [];
  for (const p of inWin) {
    const pct = (p.c / base.c - 1) * 100;
    if (!Number.isFinite(pct)) continue;
    out.push({ t: p.t, pct: Math.max(pct, -100) });
  }
  return out;
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
        "ALL line = Nasdaq 100, S&P 500 and All Ordinaries from the first date all three exist on Yahoo (NDX daily from Oct 1985), each at 0% on the left. Bitcoin is omitted from the line (Yahoo daily BTC-USD only from Sep 2014) and kept on the bars / chips as its own all-time return. Educational only — not financial advice (NFA).",
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
    definition: `Each line starts at 0% at the left of the window (close ~${years} calendar year${years === 1 ? "" : "s"} ago) and plots percentage return to each later close. Same start date for BTC-USD, ^NDX, ^GSPC and ^AORD. End of the line is the window return (matches the bar). Educational only — not financial advice (NFA).`,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowKey = parseWindow(searchParams.get("window"));
  const meta = windowMeta(windowKey);

  const errors: Record<string, string> = {};
  const closesById: Partial<Record<SeriesId, ClosePoint[]>> = {};

  await Promise.all(
    SERIES.map(async (sMeta) => {
      try {
        closesById[sMeta.id] = await fetchYahooDaily(sMeta.yahooSymbol);
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
    const indexFirsts = loaded
      .filter((s) => s.id !== "btc")
      .map((s) => firstPositive(closesById[s.id] ?? [])?.t)
      .filter((t): t is number => t != null);
    displayCutoff = indexFirsts.length ? Math.max(...indexFirsts) : null;
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
      const pct = windowRelative(closes, cutoff, nowSec);
      const points = downsample(pct, 900);
      const latestPct = points.length ? points[points.length - 1]!.pct : null;
      const startDate = points.length ? isoDate(points[0]!.t) : isoDate(cutoff);
      seriesStarts[sMeta.id] = startDate;
      series.push({
        id: sMeta.id,
        label: sMeta.label,
        ticker: sMeta.ticker,
        points,
        latestPct,
        coverage: "full",
        startDate,
      });
    } catch (e) {
      errors[sMeta.id] = e instanceof Error ? e.message : "compute failed";
    }
  }

  const order: SeriesId[] = ["btc", "ndx", "spx", "aord"];
  series.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

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
      source: "Yahoo Finance chart API (query1)",
      tickers: SERIES.map((s) => ({
        id: s.id,
        ticker: s.ticker,
        label: s.label,
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
