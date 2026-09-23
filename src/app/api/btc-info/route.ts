/**
 * Homepage BTC info strip — server-side so browsers avoid Coinbase CORS/429.
 * Coinbase Exchange first; Yahoo chart fallback. Cached briefly. Educational — NFA.
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

async function yahooBtc(): Promise<{ price: number; ath: number }> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 400 * 86400;
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD` +
    `?period1=${period1}&period2=${period2}&interval=1d&includeAdjustedClose=true`;
  const json = await fetchJson(url);
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0]?.close as (number | null)[] | undefined;
  const adj = result?.indicators?.adjclose?.[0]?.adjclose as (number | null)[] | undefined;
  const spot =
    Number(meta?.regularMarketPrice) ||
    Number(meta?.previousClose) ||
    NaN;
  let ath = Number.isFinite(spot) ? spot : 0;
  const series = adj?.length ? adj : quote ?? [];
  for (const v of series) {
    if (v != null && Number.isFinite(v) && v > ath) ath = v;
  }
  if (!Number.isFinite(spot) || spot <= 0) throw new Error("Yahoo BTC empty");
  return { price: spot, ath: ath > 0 ? ath : spot };
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

  // Brief backoff before alternate source (rate-limit hygiene).
  await new Promise((r) => setTimeout(r, 250));

  try {
    const { price, ath } = await yahooBtc();
    const drawdownPct = ath > 0 ? ((price - ath) / ath) * 100 : null;
    return Response.json(
      {
        ok: true,
        source: "yahoo",
        btcPrice: price,
        ath,
        drawdownPct,
        daysSinceHalving: halvingDays,
        daysUntilNextHalving: daysToHalving,
        asOf: new Date().toISOString(),
        note: errors.length ? `Coinbase unavailable (${errors.join("; ")})` : undefined,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=90, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "yahoo failed");
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
