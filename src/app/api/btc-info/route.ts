/**
 * Homepage BTC info strip — server-side so browsers avoid Coinbase CORS/429.
 * Coinbase Exchange public market data only. Cached briefly. Educational — NFA.
 */

import { daysSinceHalving, daysUntilNextHalving } from "@/lib/bitcoinHalving";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const CB = "https://api.exchange.coinbase.com";
const FETCH_MS = 8_000;

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_MS),
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function coinbaseSpot(): Promise<number> {
  const ticker = await fetchJson(`${CB}/products/BTC-USD/ticker`);
  const price = Number(ticker.price);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Coinbase ticker empty");
  return price;
}

/** Daily closes from Coinbase candles; chunked to stay under ~300 bars/call. */
async function coinbaseDailyCloses(daysBack: number): Promise<number[]> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - daysBack * 86400;
  const chunk = 280;
  const closes: number[] = [];
  for (let s = start; s < end; s += chunk * 86400) {
    const e = Math.min(s + chunk * 86400, end);
    const url =
      `${CB}/products/BTC-USD/candles?granularity=86400` +
      `&start=${new Date(s * 1000).toISOString()}` +
      `&end=${new Date(e * 1000).toISOString()}`;
    const rows: number[][] = await fetchJson(url);
    for (const row of rows) {
      const c = row[4];
      if (typeof c === "number" && Number.isFinite(c) && c > 0) closes.push(c);
    }
  }
  if (!closes.length) throw new Error("Coinbase candles empty");
  return closes;
}

export async function GET() {
  const halvingDays = daysSinceHalving();
  const daysToHalving = daysUntilNextHalving();
  const errors: string[] = [];

  try {
    const [spot, closes] = await Promise.all([
      coinbaseSpot(),
      coinbaseDailyCloses(400),
    ]);
    const ath = Math.max(spot, ...closes);
    const drawdownPct = ath > 0 ? ((spot - ath) / ath) * 100 : null;
    return Response.json(
      {
        ok: true,
        source: "coinbase",
        btcPrice: spot,
        ath,
        drawdownPct,
        daysSinceHalving: halvingDays,
        daysUntilNextHalving: daysToHalving,
        asOf: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "coinbase failed");
  }

  return Response.json(
    {
      ok: false,
      error: errors.join("; ") || "BTC feed unavailable",
      btcPrice: null,
      ath: null,
      drawdownPct: null,
      daysSinceHalving: halvingDays,
      daysUntilNextHalving: daysToHalving,
      asOf: new Date().toISOString(),
    },
    {
      status: 502,
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    },
  );
}
