/**
 * Historical CAGR for one crypto pair, for /tools/compound-interest.
 * GET /api/asset-cagr?ticker=BTC-USD&years=10   (years = integer lookback, or "max")
 *
 * Coinbase Exchange daily closes (public market data, from mid 2015). Shares, ETFs and
 * indices are not supported: Yahoo Finance was removed and there is no free licensed
 * source. Lookback is clamped to the history that exists. Soft-fails with ok:false.
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
/** Coinbase Exchange daily history starts mid-2015 (BTC-USD). */
const EARLIEST_CB = Math.floor(Date.UTC(2015, 0, 1) / 1000);

type Series = { points: PricePoint[]; currency: string | null; name: string | null; fetchedAt: number };
const cache = new Map<string, Series>();


/** Crypto pair like BTC-USD / ETH-AUD, else null (shares / ETFs have no licensed free source). */
function coinbaseProduct(ticker: string): string | null {
  const m = /^([A-Z0-9]{2,10})-(USD|AUD)$/.exec(ticker);
  return m ? `${m[1]}-${m[2]}` : null;
}

/** Coinbase Exchange daily candles, chunked (max ~300 per call), oldest first. */
async function fetchHistory(symbol: string): Promise<Series> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.fetchedAt < CACHE_MS) return hit;
  const product = coinbaseProduct(symbol);
  if (!product) {
    throw new Error(
      `No free licensed price history for ${symbol}. Only crypto pairs (e.g. BTC-USD) are supported; enter your own rate for shares and ETFs.`,
    );
  }
  try {
    const DAY = 86400;
    const CHUNK = 290 * DAY;
    const end = Math.floor(Date.now() / 1000);
    const byT = new Map<number, number>();
    let emptyRuns = 0;
    for (let stop = end; stop > EARLIEST_CB && emptyRuns < 2; stop -= CHUNK) {
      const start = Math.max(EARLIEST_CB, stop - CHUNK);
      const url =
        `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400` +
        `&start=${new Date(start * 1000).toISOString()}&end=${new Date(stop * 1000).toISOString()}`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_MS),
      });
      if (res.status === 404) throw new Error(`${symbol} is not listed on Coinbase Exchange`);
      if (!res.ok) throw new Error(`Coinbase ${product}: HTTP ${res.status}`);
      const rows = (await res.json()) as Array<[number, number, number, number, number, number]>;
      if (!Array.isArray(rows) || !rows.length) {
        emptyRuns++;
        continue;
      }
      emptyRuns = 0;
      for (const r of rows) if (Number.isFinite(r[4]) && r[4] > 0) byT.set(r[0], r[4]);
      await new Promise((r) => setTimeout(r, 120));
    }
    const points: PricePoint[] = [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, c]) => ({ t, c }));
    if (points.length < 2) throw new Error(`Not enough price history for ${symbol}`);
    const series: Series = { points, currency: product.endsWith("-AUD") ? "AUD" : "USD", name: product, fetchedAt: Date.now() };
    cache.set(symbol, series);
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    return series;
  } catch (e) {
    if (hit) return hit;
    throw e;
  }
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
        source: "Coinbase Exchange daily closes (UTC)",
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
