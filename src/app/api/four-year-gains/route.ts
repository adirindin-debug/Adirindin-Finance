/**
 * Rolling / cumulative percentage gains for BTC vs major equity indices.
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

async function fetchYahooDaily(symbol: string): Promise<ClosePoint[]> {
  // max history so 10Y rolling and ALL cumulative are possible
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=max&interval=1d&events=history&includeAdjustedClose=true`;
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
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
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
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const out: ClosePoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) continue;
    out.push({ t: result.timestamp[i], c });
  }
  return out;
}

/**
 * For each close at time t, % change vs the last available close at or before
 * t − windowSec. Same calendar lookback for all series.
 */
function rollingWindowPct(closes: ClosePoint[], winSec: number): PctPoint[] {
  if (closes.length < 2) return [];
  const out: PctPoint[] = [];
  let j = 0;
  for (let i = 0; i < closes.length; i++) {
    const target = closes[i].t - winSec;
    while (j + 1 < i && closes[j + 1].t <= target) j++;
    if (closes[j].t > target) continue; // not enough history yet
    const base = closes[j];
    if (base.c <= 0) continue;
    // Require base reasonably close to the window (within ~45 calendar days)
    if (target - base.t > 45 * 86400) continue;
    const pct = (closes[i].c / base.c - 1) * 100;
    if (!Number.isFinite(pct)) continue;
    out.push({ t: closes[i].t, pct });
  }
  return out;
}

/**
 * Cumulative % from this series' own first available close (longest run).
 * Line starts at 0% on that series' inception date.
 */
function cumulativeFromOwnFirst(closes: ClosePoint[]): PctPoint[] {
  if (closes.length < 2) return [];
  const base = closes[0];
  if (base.c <= 0) return [];
  const out: PctPoint[] = [];
  for (let i = 0; i < closes.length; i++) {
    const pct = (closes[i].c / base.c - 1) * 100;
    if (!Number.isFinite(pct)) continue;
    out.push({ t: closes[i].t, pct });
  }
  return out;
}

function downsample(points: PctPoint[], maxPts: number): PctPoint[] {
  if (points.length <= maxPts) return points;
  const step = Math.ceil(points.length / maxPts);
  const out: PctPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
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
      mode: "cumulative" as const,
      windowDays: null as number | null,
      windowSec: null as number | null,
      title: "Cumulative % from each series' earliest history",
      definition:
        "ALL = cumulative percentage return from each series' own first available Yahoo close (longest-running history). BTC-USD from its first date; ^NDX, ^GSPC, and ^AORD from their much earlier inceptions. Each line starts at 0% on its own start date (different x starts OK). Shared % scale. Not a rolling lookback and not aligned to a common start. Educational only — not financial advice (NFA).",
    };
  }
  const years = WINDOW_YEARS[key];
  const sec = windowSec(years);
  const days = Math.round(sec / 86400);
  return {
    window: key as WindowKey,
    windowLabel: `${years}-year`,
    windowShort: key.toUpperCase(),
    mode: "rolling" as const,
    windowDays: days,
    windowSec: sec,
    title: `${years}-year rolling % gains`,
    definition: `For each trading day, percentage return from the close ~${years} calendar year${years === 1 ? "" : "s"} earlier (${days} days / ${years}×365.25) to that day. Same calendar lookback for BTC-USD, ^NDX, ^GSPC, and ^AORD so series compare fairly. Educational only — not financial advice (NFA).`,
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

  const series: Array<{
    id: SeriesId;
    label: string;
    ticker: string;
    points: PctPoint[];
    latestPct: number | null;
    startDate?: string;
  }> = [];

  const seriesStarts: Partial<Record<SeriesId, string>> = {};

  for (const sMeta of SERIES) {
    const closes = closesById[sMeta.id];
    if (!closes?.length) continue;
    try {
      let pct: PctPoint[];
      let startDate: string | undefined;
      if (windowKey === "all") {
        pct = cumulativeFromOwnFirst(closes);
        startDate = isoDate(closes[0].t);
        seriesStarts[sMeta.id] = startDate;
      } else {
        const winSec = windowSec(WINDOW_YEARS[windowKey]);
        pct = rollingWindowPct(closes, winSec);
        // Display roughly the last lookback-length of rolling returns (need prior window of prices)
        const cutoff = Math.floor(Date.now() / 1000) - winSec;
        const recent = pct.filter((p) => p.t >= cutoff);
        pct = recent.length ? recent : pct;
      }
      const points = downsample(pct, 900);
      series.push({
        id: sMeta.id,
        label: sMeta.label,
        ticker: sMeta.ticker,
        points,
        latestPct: points.length ? points[points.length - 1].pct : null,
        ...(startDate ? { startDate } : {}),
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
      // Kept for backward compat; ALL no longer uses a shared common start
      commonStart: null,
      seriesStarts:
        windowKey === "all" && Object.keys(seriesStarts).length
          ? seriesStarts
          : undefined,
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
