/**
 * Same-origin data for /charts/seasonality (monthly / quarterly returns heatmap).
 *
 * BTC: Yahoo Finance BTC-USD daily closes (UTC days) from 17 Sep 2014. Dec 2012 –
 * 16 Sep 2014 come from the blockchain.com "market-price" daily average (the same
 * public series /api/btc-history splices in), frozen in the dated snapshot.
 * Thinner 2010–2012 markets are not used. Fallback for recent BTC months:
 * Coinbase Exchange daily candles.
 * ETH: Yahoo ETH-USD daily closes (UTC) from Nov 2017.
 * MSCI World: Yahoo URTH (iShares MSCI World ETF) daily closes from Jan 2012 — a
 * stand-in, as MSCI index data can't be republished. Price only.
 * S&P 500: Yahoo Finance ^GSPC daily closes from Dec 1949 — the price index only,
 * no dividends.
 *
 * ?market=crypto | equities returns that market's assets (default crypto). The
 * asset list comes from SEASON_ASSETS in src/lib/seasonality.ts.
 *
 * One record per calendar month: [YYYY-MM, last trading date, close]. History
 * before the snapshot's last month never changes, so the route fetches only the
 * recent window live and splices it over src/data/seasonality-snapshot.json.
 * Order: Yahoo query1 → query2 (→ Coinbase for BTC) → last-good in-memory cache →
 * dated snapshot. Never invents data. NFA.
 */

import snapshot from "@/data/seasonality-snapshot.json";
import {
  ASSET_DEF,
  MARKET_ASSETS,
  isMarket,
  type MonthClose,
  type SeasonAsset,
  type SeasonPayload,
  type SeasonSeries,
} from "@/lib/seasonality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type SnapAsset = { firstDate: string; lastDate: string; yahooFrom?: string; months: MonthClose[] };
type Snapshot = { asOf: string } & Record<SeasonAsset, SnapAsset>;
const SNAP = snapshot as unknown as Snapshot;

const lastGood: Partial<Record<SeasonAsset, SeasonSeries>> = {};

type Daily = Array<[string, number]>;

function toMonths(daily: Daily): MonthClose[] {
  const m = new Map<string, [string, number]>();
  for (const [d, c] of daily) m.set(d.slice(0, 7), [d, c]);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, [d, c]]) => [k, d, c]);
}

/** Unix seconds for the first day (UTC) of the month before the snapshot's last month. */
function liveStart(snap: SnapAsset): number {
  const last = snap.months[snap.months.length - 1]![0];
  const [y, m] = last.split("-").map(Number) as [number, number];
  return Math.floor(Date.UTC(y, m - 2, 1) / 1000);
}

function monthKeyIn(tz: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

async function yahooDaily(symbol: string, period1: number, nyDates: boolean): Promise<Daily> {
  const errors: string[] = [];
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(FETCH_MS),
      });
      if (!res.ok) throw new Error(`Yahoo ${host} ${symbol}: HTTP ${res.status}`);
      const json = (await res.json()) as {
        chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> };
      };
      const r = json.chart?.result?.[0];
      const ts = r?.timestamp ?? [];
      const cl = r?.indicators?.quote?.[0]?.close ?? [];
      const byDay = new Map<string, number>();
      for (let i = 0; i < ts.length; i++) {
        const v = cl[i];
        if (v == null || !Number.isFinite(v) || v <= 0) continue;
        // ^GSPC bars are stamped at the New York open (13:30/14:30 UTC); BTC-USD at 00:00 UTC.
        const t = (ts[i]! - (nyDates ? 5 * 3600 : 0)) * 1000;
        byDay.set(new Date(t).toISOString().slice(0, 10), Math.round(v * 100) / 100);
      }
      const out = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
      if (out.length < 15) throw new Error(`Yahoo ${host} ${symbol}: short history (${out.length})`);
      return out;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Yahoo ${host} failed`);
    }
  }
  throw new Error(errors.join("; "));
}

/** Coinbase Exchange BTC-USD daily candles (last 300 UTC days). */
async function coinbaseDaily(period1: number): Promise<Daily> {
  const res = await fetch("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400", {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`Coinbase: HTTP ${res.status}`);
  const rows = (await res.json()) as Array<[number, number, number, number, number, number]>;
  const out: Daily = rows
    .filter((r) => Array.isArray(r) && r[0] >= period1 && Number.isFinite(r[4]) && r[4] > 0)
    .map((r) => [new Date(r[0] * 1000).toISOString().slice(0, 10), Math.round(r[4] * 100) / 100] as [string, number])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (out.length < 15) throw new Error(`Coinbase: short history (${out.length})`);
  // Coverage must reach back to the splice point, or months would be cut short.
  if (out[0]![0] > new Date((period1 + 3 * 86400) * 1000).toISOString().slice(0, 10)) {
    throw new Error("Coinbase: window does not reach the snapshot");
  }
  return out;
}

function splice(snap: SnapAsset, live: Daily): MonthClose[] {
  const liveMonths = toMonths(live);
  const keys = new Set(liveMonths.map((m) => m[0]));
  return [...snap.months.filter((m) => !keys.has(m[0])), ...liveMonths].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

async function buildAsset(asset: SeasonAsset, warnings: string[]): Promise<SeasonSeries> {
  const snap = SNAP[asset];
  const p1 = liveStart(snap);
  const def = ASSET_DEF[asset];
  const currentMonth = def.clock === "utc" ? monthKeyIn("UTC") : monthKeyIn("America/New_York");
  let live: Daily | null = null;
  try {
    live = await yahooDaily(def.yahoo, p1, def.clock === "ny");
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : String(e));
    if (asset === "btc") {
      try {
        live = await coinbaseDaily(p1);
        warnings.push("BTC recent months from Coinbase");
      } catch (e2) {
        warnings.push(e2 instanceof Error ? e2.message : String(e2));
      }
    }
  }
  if (live) {
    const series: SeasonSeries = {
      months: splice(snap, live),
      firstDate: snap.firstDate,
      lastDate: live[live.length - 1]![0],
      currentMonth,
      ...(snap.yahooFrom ? { yahooFrom: snap.yahooFrom } : {}),
    };
    lastGood[asset] = series;
    return series;
  }
  const lg = lastGood[asset];
  if (lg) return { ...lg, currentMonth };
  return {
    months: snap.months,
    firstDate: snap.firstDate,
    lastDate: snap.lastDate,
    currentMonth,
    ...(snap.yahooFrom ? { yahooFrom: snap.yahooFrom } : {}),
    snapshot: true,
  };
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("market");
  const market = isMarket(q) ? q : "crypto";
  const keys = MARKET_ASSETS(market).map((a) => a.key);
  const warnings: string[] = [];
  const built = await Promise.all(keys.map((k) => buildAsset(k, warnings)));
  const assets: SeasonPayload["assets"] = {};
  keys.forEach((k, i) => {
    assets[k] = built[i];
  });
  const anySnap = built.some((b) => b.snapshot);
  const body: SeasonPayload & { warnings?: string[] } = {
    ok: true,
    updatedAt: new Date().toISOString(),
    market,
    ...(anySnap ? { snapshot: true, snapshotAsOf: SNAP.asOf } : {}),
    assets,
    ...(warnings.length ? { warnings } : {}),
  };
  return Response.json(body, {
    headers: {
      "Cache-Control": `public, s-maxage=${anySnap ? 300 : 1800}, stale-while-revalidate=86400`,
    },
  });
}
