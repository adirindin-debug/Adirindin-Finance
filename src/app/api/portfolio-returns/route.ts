/**
 * Period returns for portfolio securities (AUD).
 * Windows: 1D (prior trading-day close), 1W (~7d), 1M (~30d), YTD (UTC 1 January),
 * 1Y / 3Y / 4Y / 5Y / 10Y / 20Y (calendar lookbacks ~N*365d).
 * All-time (vs cost) is computed client-side — not served here.
 * Educational — NFA.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Tf = "1D" | "1W" | "1M" | "YTD" | "1Y" | "3Y" | "4Y" | "5Y" | "10Y" | "20Y";
type ClosePoint = { t: number; c: number };

type TickerReturn = {
  ticker: string;
  startPriceAud: number | null;
  endPriceAud: number | null;
  returnPct: number | null;
  startSec: number | null;
  endSec: number | null;
};

const TF_SET = new Set<Tf>(["1D", "1W", "1M", "YTD", "1Y", "3Y", "4Y", "5Y", "10Y", "20Y"]);

function parseTf(raw: string | null): Tf {
  if (raw && TF_SET.has(raw as Tf)) return raw as Tf;
  return "1Y";
}

/** Calendar years for multi-year lookbacks (same pattern as 1Y). */
function multiYearLookback(tf: Tf): number | null {
  switch (tf) {
    case "1Y":
      return 1;
    case "3Y":
      return 3;
    case "4Y":
      return 4;
    case "5Y":
      return 5;
    case "10Y":
      return 10;
    case "20Y":
      return 20;
    default:
      return null;
  }
}

function ytdStartSec(nowSec: number): number {
  const d = new Date(nowSec * 1000);
  return Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
}

function windowLookbackSec(tf: Tf, nowSec: number): number {
  if (tf === "1D") return 14 * 86400; // enough bars to find prior close
  if (tf === "1W") return 21 * 86400;
  if (tf === "1M") return 60 * 86400;
  if (tf === "YTD") {
    // Start at UTC 1 January, with a small buffer for FX conversion.
    return Math.max(14 * 86400, nowSec - ytdStartSec(nowSec) + 14 * 86400);
  }
  const years = multiYearLookback(tf);
  if (years != null) {
    // N years + ~35d buffer (same pattern as 1Y ≈ 400d)
    return Math.round((years * 365.25 + 35) * 86400);
  }
  return Math.round(400 * 86400);
}

function targetStartSec(tf: Tf, nowSec: number): number {
  if (tf === "1D") return nowSec - 86400; // seek prior trading day near here
  if (tf === "1W") return nowSec - 7 * 86400;
  if (tf === "1M") return nowSec - 30 * 86400;
  if (tf === "YTD") return ytdStartSec(nowSec);
  const years = multiYearLookback(tf);
  if (years != null) return nowSec - Math.round(years * 365.25 * 86400);
  return nowSec - Math.round(365.25 * 86400);
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

async function fetchYahooDaily(symbol: string, period1: number): Promise<ClosePoint[]> {
  const period2 = Math.floor(Date.now() / 1000);
  const p1 = Math.max(0, Math.floor(period1));
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${p1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
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
    throw new Error(json.chart?.error?.description || `No data for ${symbol}`);
  }
  const closes = result.indicators?.quote?.[0]?.close;
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const out: ClosePoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = pickClose(closes, adj, i);
    if (c == null) continue;
    out.push({ t: result.timestamp[i], c });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Closest point at or before target; fallback to earliest after if none before. */
function priceAtOrBefore(points: ClosePoint[], targetSec: number): ClosePoint | null {
  if (!points.length) return null;
  let best: ClosePoint | null = null;
  for (const p of points) {
    if (p.t <= targetSec) best = p;
    else break;
  }
  if (best) return best;
  // If all points are after target (short history), use first available
  return points[0] ?? null;
}

/** Earliest point at or after target; used for calendar-period starts. */
function priceAtOrAfter(points: ClosePoint[], targetSec: number): ClosePoint | null {
  return points.find((p) => p.t >= targetSec) ?? null;
}

function isAudQuoted(ticker: string): boolean {
  const t = ticker.toUpperCase();
  return t.endsWith(".AX") || t.includes("AUD");
}

function toAud(price: number, ticker: string, audPerUsd: number | null): number | null {
  if (isAudQuoted(ticker)) return price;
  if (audPerUsd == null || !(audPerUsd > 0)) return null;
  return price * audPerUsd;
}

function computeReturn(
  points: ClosePoint[],
  fxPoints: ClosePoint[],
  ticker: string,
  tf: Tf,
  nowSec: number,
): TickerReturn {
  const empty: TickerReturn = {
    ticker,
    startPriceAud: null,
    endPriceAud: null,
    returnPct: null,
    startSec: null,
    endSec: null,
  };
  if (points.length < 2) return empty;

  const end = points[points.length - 1]!;
  let start: ClosePoint | null;

  if (tf === "1D") {
    // Prior trading-day close = second-to-last distinct daily bar
    start = points.length >= 2 ? points[points.length - 2]! : null;
    // Guard: if last two stamps are same calendar day (intraday dup), walk back
    if (start) {
      const endDay = Math.floor(end.t / 86400);
      for (let i = points.length - 2; i >= 0; i--) {
        const p = points[i]!;
        if (Math.floor(p.t / 86400) < endDay) {
          start = p;
          break;
        }
        start = p;
      }
    }
  } else if (tf === "YTD") {
    // Match the performance chart: use the first available trading price on or
    // after UTC 1 January rather than the final close from the prior year.
    start = priceAtOrAfter(points, targetStartSec(tf, nowSec));
  } else {
    start = priceAtOrBefore(points, targetStartSec(tf, nowSec));
  }

  if (!start || !end) return empty;
  // If start is the same bar as end, no usable window
  if (start.t === end.t) return empty;

  const fxEnd = priceAtOrBefore(fxPoints, end.t);
  const fxStart = priceAtOrBefore(fxPoints, start.t);
  // AUDUSD = USD per 1 AUD → AUD per 1 USD = 1 / AUDUSD
  const audPerUsdEnd =
    fxEnd && fxEnd.c > 0 ? 1 / fxEnd.c : null;
  const audPerUsdStart =
    fxStart && fxStart.c > 0 ? 1 / fxStart.c : null;

  const endAud = toAud(end.c, ticker, audPerUsdEnd);
  const startAud = toAud(start.c, ticker, audPerUsdStart);
  if (endAud == null || startAud == null || !(startAud > 0)) {
    return { ...empty, startSec: start.t, endSec: end.t };
  }

  const returnPct = ((endAud / startAud) - 1) * 100;
  return {
    ticker,
    startPriceAud: startAud,
    endPriceAud: endAud,
    returnPct,
    startSec: start.t,
    endSec: end.t,
  };
}

export async function GET(req: NextRequest) {
  const tf = parseTf(req.nextUrl.searchParams.get("tf"));
  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = [
    ...new Set(
      tickersParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => t && t !== "AUDUSD=X")
        .slice(0, 40),
    ),
  ];

  if (tickers.length === 0) {
    return NextResponse.json({
      ok: true,
      tf,
      returns: [] as TickerReturn[],
      note: "No security tickers",
    });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const fetchFrom = Math.max(0, nowSec - windowLookbackSec(tf, nowSec));

  try {
    const errors: Record<string, string> = {};
    const priceMap = new Map<string, ClosePoint[]>();

    await Promise.all(
      [...tickers, "AUDUSD=X"].map(async (sym) => {
        try {
          const pts = await fetchYahooDaily(sym, fetchFrom);
          priceMap.set(sym.toUpperCase(), pts);
        } catch (e) {
          errors[sym] = e instanceof Error ? e.message : "fetch failed";
        }
      }),
    );

    const fxPoints = priceMap.get("AUDUSD=X") ?? [];
    if (fxPoints.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Could not fetch AUDUSD history", errors },
        { status: 502 },
      );
    }

    const returns: TickerReturn[] = tickers.map((ticker) => {
      const pts = priceMap.get(ticker);
      if (!pts || pts.length < 2) {
        return {
          ticker,
          startPriceAud: null,
          endPriceAud: null,
          returnPct: null,
          startSec: null,
          endSec: null,
        };
      }
      return computeReturn(pts, fxPoints, ticker, tf, nowSec);
    });

    const defs: Record<Tf, string> = {
      "1D": "vs prior trading-day close",
      "1W": "~7 calendar days",
      "1M": "~30 calendar days",
      YTD: "calendar year-to-date vs start-of-year AUD price (UTC 1 January)",
      "1Y": "~365 calendar days",
      "3Y": "~3 × 365 calendar days",
      "4Y": "~4 × 365 calendar days",
      "5Y": "~5 × 365 calendar days",
      "10Y": "~10 × 365 calendar days",
      "20Y": "~20 × 365 calendar days",
    };

    return NextResponse.json({
      ok: true,
      tf,
      definition: defs[tf],
      asOf: new Date().toISOString(),
      returns,
      errors: Object.keys(errors).length ? errors : undefined,
      note: "AUD unit prices from Yahoo daily history. Period return = end/start − 1. NFA.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Returns fetch failed",
      },
      { status: 502 },
    );
  }
}
