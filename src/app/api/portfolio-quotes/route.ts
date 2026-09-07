import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type YahooQuote = {
  symbol?: string;
  shortName?: string;
  longName?: string;
  regularMarketPrice?: number;
  postMarketPrice?: number;
  preMarketPrice?: number;
  currency?: string;
};

type QuoteOut = {
  ticker: string;
  price: number;
  currency: string;
  priceAud: number;
  name?: string;
};

function pickPrice(q: YahooQuote): number | null {
  const candidates = [q.regularMarketPrice, q.postMarketPrice, q.preMarketPrice];
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
  }
  return null;
}

/** Heuristic: ASX tickers are AUD; *-USD / crypto pairs and plain US tickers are USD. */
function inferCurrency(ticker: string, yahooCurrency?: string): string {
  if (yahooCurrency) return yahooCurrency.toUpperCase();
  const t = ticker.toUpperCase();
  if (t.endsWith(".AX")) return "AUD";
  if (t.includes("AUD")) return "AUD";
  return "USD";
}

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, YahooQuote>> {
  const map = new Map<string, YahooQuote>();
  if (symbols.length === 0) return map;

  const unique = [...new Set(symbols.map((s) => s.trim()).filter(Boolean))];
  const query = unique.map(encodeURIComponent).join(",");

  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${query}`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${query}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AdirindinFinance/1.0)",
          Accept: "application/json",
        },
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        quoteResponse?: { result?: YahooQuote[] };
      };
      const results = data.quoteResponse?.result ?? [];
      for (const q of results) {
        if (q.symbol) map.set(q.symbol.toUpperCase(), q);
      }
      if (map.size > 0) return map;
    } catch {
      /* try next */
    }
  }

  // Fallback: per-symbol chart endpoint
  await Promise.all(
    unique.map(async (sym) => {
      if (map.has(sym.toUpperCase())) return;
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AdirindinFinance/1.0)",
            Accept: "application/json",
          },
          next: { revalidate: 0 },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          chart?: {
            result?: Array<{
              meta?: {
                symbol?: string;
                regularMarketPrice?: number;
                currency?: string;
                shortName?: string;
              };
            }>;
          };
        };
        const meta = data.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return;
        map.set((meta.symbol ?? sym).toUpperCase(), {
          symbol: meta.symbol ?? sym,
          regularMarketPrice: meta.regularMarketPrice,
          currency: meta.currency,
          shortName: meta.shortName,
        });
      } catch {
        /* skip */
      }
    }),
  );

  return map;
}

function toAud(price: number, currency: string, audPerUsd: number): number {
  const c = currency.toUpperCase();
  if (c === "AUD") return price;
  if (c === "USD") return price * audPerUsd;
  // Unknown: assume USD-like
  return price * audPerUsd;
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

  try {
    const symbols = [...tickers, "AUDUSD=X"];
    const map = await fetchYahooQuotes(symbols);

    const fx = map.get("AUDUSD=X");
    const audUsd = fx ? pickPrice(fx) : null;
    // AUDUSD = USD per 1 AUD → AUD per 1 USD = 1 / AUDUSD
    const audPerUsd = audUsd && audUsd > 0 ? 1 / audUsd : null;

    if (!audPerUsd) {
      return NextResponse.json(
        { quotes: [], audUsd: null, error: "Could not fetch AUDUSD rate" },
        { status: 502 },
      );
    }

    const quotes: QuoteOut[] = [];
    for (const ticker of tickers) {
      const q = map.get(ticker);
      if (!q) continue;
      const price = pickPrice(q);
      if (price == null) continue;
      const currency = inferCurrency(ticker, q.currency);
      quotes.push({
        ticker,
        price,
        currency,
        priceAud: toAud(price, currency, audPerUsd),
        name: q.longName || q.shortName,
      });
    }

    return NextResponse.json({
      quotes,
      audUsd,
      audPerUsd,
      fetchedAt: new Date().toISOString(),
      error: null,
    });
  } catch (e) {
    return NextResponse.json(
      {
        quotes: [],
        audUsd: null,
        error: e instanceof Error ? e.message : "Quote fetch failed",
      },
      { status: 502 },
    );
  }
}
