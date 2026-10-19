import { NextRequest, NextResponse } from "next/server";

/**
 * Portfolio quotes from public, displayable sources only.
 *  - FX (AUD/USD): FRED DEXUSAL — Federal Reserve H.10 noon buying rate, US dollars per
 *    Australian dollar (daily, public domain; lags by a few days).
 *  - Crypto pairs (e.g. BTC-USD, ETH-USD): Coinbase Exchange public ticker.
 *  - Shares / ETFs: not priced. Yahoo Finance was removed (not licensed for public
 *    display) and there is no free licensed source. Those tickers come back in `unpriced`.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA = "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const FETCH_MS = 8_000;

type QuoteOut = {
  ticker: string;
  price: number;
  currency: string;
  priceAud: number;
  name?: string;
  source: string;
};

/** Latest DEXUSAL observation (USD per 1 AUD) from FRED's public CSV. */
async function fetchAudUsd(): Promise<{ audUsd: number; date: string }> {
  const res = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSAL", {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    signal: AbortSignal.timeout(FETCH_MS),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`FRED DEXUSAL: HTTP ${res.status}`);
  const lines = (await res.text()).trim().split(/\r?\n/).slice(1);
  for (let i = lines.length - 1; i >= 0; i--) {
    const [date, raw] = lines[i]!.split(",");
    const v = Number(raw);
    if (date && Number.isFinite(v) && v > 0) return { audUsd: v, date };
  }
  throw new Error("FRED DEXUSAL: no observations");
}

/** Crypto pair like BTC-USD / ETH-AUD → Coinbase product id, else null. */
function coinbaseProduct(ticker: string): string | null {
  const m = /^([A-Z0-9]{2,10})-(USD|AUD)$/.exec(ticker);
  return m ? `${m[1]}-${m[2]}` : null;
}

async function coinbasePrice(product: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.exchange.coinbase.com/products/${product}/ticker`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { price?: string };
    const p = Number(j.price);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  const fxOnly = req.nextUrl.searchParams.get("fxOnly") === "1";
  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t && t !== "AUDUSD=X")
    .slice(0, 40);

  if (tickers.length === 0 && !fxOnly) {
    return NextResponse.json({ quotes: [], audUsd: null, audPerUsd: null, error: null });
  }

  let audUsd: number;
  let fxDate: string;
  try {
    ({ audUsd, date: fxDate } = await fetchAudUsd());
  } catch (e) {
    return NextResponse.json(
      { quotes: [], audUsd: null, error: e instanceof Error ? e.message : "Could not fetch AUD/USD rate" },
      { status: 502 },
    );
  }
  // DEXUSAL = USD per 1 AUD → AUD per 1 USD = 1 / DEXUSAL
  const audPerUsd = 1 / audUsd;

  const quotes: QuoteOut[] = [];
  const unpriced: string[] = [];
  await Promise.all(
    tickers.map(async (ticker) => {
      const product = coinbaseProduct(ticker);
      const price = product ? await coinbasePrice(product) : null;
      if (price == null) {
        unpriced.push(ticker);
        return;
      }
      const currency = ticker.endsWith("-AUD") ? "AUD" : "USD";
      quotes.push({
        ticker,
        price,
        currency,
        priceAud: currency === "AUD" ? price : price * audPerUsd,
        source: "Coinbase Exchange",
      });
    }),
  );

  return NextResponse.json({
    quotes,
    unpriced: unpriced.sort(),
    unpricedReason: unpriced.length
      ? "No free licensed price source for shares and ETFs, so no live value is shown for them."
      : undefined,
    audUsd,
    audPerUsd,
    fxSource: `FRED DEXUSAL (Federal Reserve H.10), ${fxDate}`,
    fetchedAt: new Date().toISOString(),
    error: null,
  });
}
