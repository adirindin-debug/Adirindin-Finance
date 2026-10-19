/**
 * Ticker typeahead for the portfolio editor and compound interest calculator.
 * Crypto pairs only (Coinbase Exchange public product list). Shares / ETFs are not
 * searchable: Yahoo Finance was removed and there is no free licensed source.
 * Soft-fails empty.
 * Educational only — NFA.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA = "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational)";

export type TickerSuggestion = {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
};

type CbProduct = {
  id?: string;
  base_currency?: string;
  quote_currency?: string;
  display_name?: string;
  status?: string;
  trading_disabled?: boolean;
};

let productsCache: { at: number; rows: CbProduct[] } | null = null;

/** Coinbase Exchange public product list (USD / AUD pairs), cached for an hour. */
async function coinbaseProducts(): Promise<CbProduct[]> {
  if (productsCache && Date.now() - productsCache.at < 3_600_000) return productsCache.rows;
  const res = await fetch("https://api.exchange.coinbase.com/products", {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Coinbase products: HTTP ${res.status}`);
  const rows = ((await res.json()) as CbProduct[]).filter(
    (p) =>
      (p.quote_currency === "USD" || p.quote_currency === "AUD") &&
      p.status === "online" &&
      !p.trading_disabled,
  );
  productsCache = { at: Date.now(), rows };
  return rows;
}

async function searchCoinbase(q: string): Promise<TickerSuggestion[]> {
  const needle = q.toUpperCase().replace(/[-/ ].*$/, "");
  const rows = await coinbaseProducts();
  return rows
    .filter((p) => (p.base_currency ?? "").toUpperCase().startsWith(needle))
    .sort((a, b) => {
      const ea = a.base_currency?.toUpperCase() === needle ? 0 : 1;
      const eb = b.base_currency?.toUpperCase() === needle ? 0 : 1;
      return ea - eb || (a.id ?? "").localeCompare(b.id ?? "");
    })
    .slice(0, 8)
    .map((p) => ({
      symbol: (p.id ?? "").toUpperCase(),
      name: p.display_name ?? p.id ?? "",
      exchange: "Coinbase",
      type: "Crypto",
    }));
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ ok: true, suggestions: [] as TickerSuggestion[] });
  }
  if (q.length > 48) {
    return NextResponse.json(
      { ok: true, suggestions: [] as TickerSuggestion[], error: "Query too long" },
      { status: 200 },
    );
  }

  try {
    const suggestions = await searchCoinbase(q);
    return NextResponse.json(
      {
        ok: true,
        suggestions,
        source: "Coinbase Exchange products",
        asOf: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    // Soft-fail: empty list, not a hard error for the typeahead UI
    return NextResponse.json({
      ok: true,
      suggestions: [] as TickerSuggestion[],
      error: e instanceof Error ? e.message : "Search unavailable",
    });
  }
}
