/**
 * Rolling ~4-year percentage gains for BTC vs major equity indices.
 * Yahoo Finance chart API (server-side; UA required). Educational — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** ~4 calendar years in seconds (4 × 365.25 days). Same window for every series. */
export const WINDOW_SEC = Math.round(4 * 365.25 * 86400); // ≈ 1461 days

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type SeriesId = "btc" | "ndx" | "spx" | "aord";

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

async function fetchYahooDaily(symbol: string): Promise<ClosePoint[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=10y&interval=1d&events=history&includeAdjustedClose=true`;
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
 * t − WINDOW_SEC (~4 calendar years). Same calendar lookback for all series.
 */
function rollingFourYearPct(closes: ClosePoint[]): PctPoint[] {
  if (closes.length < 2) return [];
  const out: PctPoint[] = [];
  let j = 0;
  for (let i = 0; i < closes.length; i++) {
    const target = closes[i].t - WINDOW_SEC;
    while (j + 1 < i && closes[j + 1].t <= target) j++;
    if (closes[j].t > target) continue; // not enough history yet
    // Prefer the last close at/before target; if first point is after target, skip
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

function downsample(points: PctPoint[], maxPts: number): PctPoint[] {
  if (points.length <= maxPts) return points;
  const step = Math.ceil(points.length / maxPts);
  const out: PctPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  const last = points[points.length - 1];
  if (out[out.length - 1]?.t !== last.t) out.push(last);
  return out;
}

export async function GET() {
  const errors: Record<string, string> = {};
  const series: Array<{
    id: SeriesId;
    label: string;
    ticker: string;
    points: PctPoint[];
    latestPct: number | null;
  }> = [];

  await Promise.all(
    SERIES.map(async (meta) => {
      try {
        const closes = await fetchYahooDaily(meta.yahooSymbol);
        const pct = rollingFourYearPct(closes);
        // Show roughly the last ~4y of rolling returns (need prior 4y of prices)
        const cutoff = Math.floor(Date.now() / 1000) - WINDOW_SEC;
        const recent = pct.filter((p) => p.t >= cutoff);
        const points = downsample(recent.length ? recent : pct, 900);
        series.push({
          id: meta.id,
          label: meta.label,
          ticker: meta.ticker,
          points,
          latestPct: points.length ? points[points.length - 1].pct : null,
        });
      } catch (e) {
        errors[meta.id] = e instanceof Error ? e.message : "fetch failed";
      }
    }),
  );

  // Stable order
  const order: SeriesId[] = ["btc", "ndx", "spx", "aord"];
  series.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  if (!series.length) {
    return Response.json(
      {
        ok: false,
        error: "Could not load any series",
        errors,
        windowDays: Math.round(WINDOW_SEC / 86400),
        windowSec: WINDOW_SEC,
      },
      { status: 502 },
    );
  }

  return Response.json(
    {
      ok: true,
      title: "4-year running % gains",
      definition:
        "For each trading day, percentage return from the close ~4 calendar years earlier (1461 days / 4×365.25) to that day. Same calendar lookback for BTC-USD, ^NDX, ^GSPC, and ^AORD so series compare fairly. Educational only — not financial advice (NFA).",
      windowDays: Math.round(WINDOW_SEC / 86400),
      windowSec: WINDOW_SEC,
      source: "Yahoo Finance chart API (query1)",
      tickers: SERIES.map((s) => ({ id: s.id, ticker: s.ticker, label: s.label })),
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
