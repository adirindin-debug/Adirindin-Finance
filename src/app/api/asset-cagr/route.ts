/**
 * Historical CAGR for one Yahoo Finance ticker, for /tools/compound-interest.
 * GET /api/asset-cagr?ticker=SPY&years=10   (years = integer lookback, or "max")
 *
 * Uses Yahoo daily adjusted closes (dividends + splits reinvested where Yahoo provides them;
 * indices like ^GSPC are price-only) in the asset's own quote currency. Lookback is clamped to
 * the history that actually exists for the ticker. query1 → query2 fallback, short in-memory
 * cache per ticker, soft-fails with ok:false.
 * Educational — illustrative only, NFA.
 */

import { NextRequest, NextResponse } from "next/server";
import { cagrFromSeries, type PricePoint } from "@/lib/compoundInterest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_MS = 12_000;
const CACHE_MS = 60 * 60 * 1000;
const MIN_YEARS = 1;
/** 1 Jan 1900 — Yahoo returns from the first real bar (e.g. ^GSPC 1927); period1=0 would cut at 1970. */
const EARLIEST = -2208988800;

type Series = { points: PricePoint[]; currency: string | null; name: string | null; fetchedAt: number };
const cache = new Map<string, Series>();

function pickClose(
  close: (number | null | undefined)[] | undefined,
  adj: (number | null | undefined)[] | undefined,
  i: number,
): number | null {
  const a = adj?.[i];
  if (a != null && Number.isFinite(a) && a > 0) return a;
  const c = close?.[i];
  if (c != null && Number.isFinite(c) && c > 0) return c;
  return null;
}

async function fetchHistory(symbol: string): Promise<Series> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit;

  const errors: string[] = [];
  const period2 = Math.floor(Date.now() / 1000);
  for (const host of ["query1", "query2"]) {
    try {
      const url =
        `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?period1=${EARLIEST}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store", // full histories can exceed the 2 MB data-cache limit; cached in memory instead
        signal: AbortSignal.timeout(FETCH_MS),
      });
      if (!res.ok) throw new Error(`Yahoo ${host}: HTTP ${res.status}`);
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            meta?: { currency?: string; longName?: string; shortName?: string };
            timestamp?: number[];
            indicators?: {
              quote?: Array<{ close?: (number | null)[] }>;
              adjclose?: Array<{ adjclose?: (number | null)[] }>;
            };
          }>;
          error?: { description?: string } | null;
        };
      };
      const r = json.chart?.result?.[0];
      if (!r?.timestamp?.length) throw new Error(json.chart?.error?.description || `No data for ${symbol}`);
      const close = r.indicators?.quote?.[0]?.close;
      const adj = r.indicators?.adjclose?.[0]?.adjclose;
      const points: PricePoint[] = [];
      for (let i = 0; i < r.timestamp.length; i++) {
        const c = pickClose(close, adj, i);
        if (c == null) continue;
        points.push({ t: r.timestamp[i]!, c });
      }
      points.sort((a, b) => a.t - b.t);
      if (points.length < 2) throw new Error(`Not enough price history for ${symbol}`);
      const series: Series = {
        points,
        currency: r.meta?.currency ?? null,
        name: r.meta?.longName ?? r.meta?.shortName ?? null,
        fetchedAt: Date.now(),
      };
      cache.set(symbol, series);
      if (cache.size > 200) cache.delete(cache.keys().next().value as string);
      return series;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Yahoo ${host} failed`);
    }
  }
  // Serve stale on failure rather than nothing.
  if (hit) return hit;
  throw new Error(errors.join("; "));
}

const isoDay = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "").trim().toUpperCase();
  const yearsRaw = (req.nextUrl.searchParams.get("years") ?? "10").trim().toLowerCase();

  if (!ticker || ticker.length > 24 || !/^[A-Z0-9^.=\-]+$/.test(ticker)) {
    return NextResponse.json({ ok: false, error: "Enter a valid ticker" }, { status: 400 });
  }
  const requested = yearsRaw === "max" ? null : Math.max(MIN_YEARS, Math.min(100, Math.floor(Number(yearsRaw) || 10)));

  try {
    const s = await fetchHistory(ticker);
    const first = s.points[0]!;
    const last = s.points[s.points.length - 1]!;
    const availableYears = (last.t - first.t) / (365.25 * 86400);
    if (availableYears < MIN_YEARS - 0.02) {
      return NextResponse.json({
        ok: false,
        ticker,
        error: `Only ${Math.max(0, availableYears * 12).toFixed(0)} months of history for ${ticker} — need at least a year to estimate a growth rate.`,
        firstAvailableDate: isoDay(first.t),
        availableYears,
      });
    }
    const out = cagrFromSeries(s.points, requested);
    if (!out) {
      return NextResponse.json({ ok: false, ticker, error: "Could not compute a growth rate from this history" });
    }
    return NextResponse.json(
      {
        ok: true,
        ticker,
        name: s.name,
        currency: s.currency,
        cagr: out.cagr,
        startDate: isoDay(out.start.t),
        endDate: isoDay(out.end.t),
        startPrice: out.start.c,
        endPrice: out.end.c,
        yearsUsed: out.yearsUsed,
        requestedYears: requested,
        clamped: out.clamped,
        firstAvailableDate: isoDay(first.t),
        availableYears: out.availableYears,
        source: "Yahoo Finance daily adjusted close (delayed, third-party)",
        asOf: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, ticker, error: e instanceof Error ? e.message : "History unavailable" },
      { status: 200 },
    );
  }
}
