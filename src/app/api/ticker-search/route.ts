/**
 * Yahoo Finance symbol search for portfolio add-holding typeahead.
 * Same delayed third-party feed stack as /api/portfolio-quotes. Soft-fails empty.
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

type YahooSearchQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  exchange?: string;
  quoteType?: string;
  typeDisp?: string;
  isYahooFinance?: boolean;
};

const ALLOWED_TYPES = new Set([
  "EQUITY",
  "ETF",
  "MUTUALFUND",
  "INDEX",
  "CRYPTOCURRENCY",
  "CURRENCY",
  "FUTURE",
  "ECNQUOTE",
]);

async function searchYahoo(q: string): Promise<TickerSuggestion[]> {
  const query = encodeURIComponent(q);
  const urls = [
    `https://query1.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false`,
    `https://query2.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=10&newsCount=0&listsCount=0&enableFuzzyQuery=false`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { quotes?: YahooSearchQuote[] };
      const quotes = data.quotes ?? [];
      const out: TickerSuggestion[] = [];
      const seen = new Set<string>();
      for (const row of quotes) {
        const symbol = row.symbol?.trim().toUpperCase();
        if (!symbol || seen.has(symbol)) continue;
        const qType = (row.quoteType ?? "").toUpperCase();
        if (qType && !ALLOWED_TYPES.has(qType)) continue;
        // Skip option contracts and oddities
        if (symbol.includes("=") && !symbol.endsWith("=X") && !symbol.includes("-")) {
          /* keep FX like AUDUSD=X */
        }
        if (/\d{6,}/.test(symbol) && qType === "OPTION") continue;
        seen.add(symbol);
        out.push({
          symbol,
          name: (row.longname || row.shortname || symbol).trim(),
          exchange: (row.exchDisp || row.exchange || undefined)?.trim() || undefined,
          type: (row.typeDisp || row.quoteType || undefined)?.trim() || undefined,
        });
        if (out.length >= 8) break;
      }
      return out;
    } catch {
      /* try next */
    }
  }
  return [];
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
    const suggestions = await searchYahoo(q);
    return NextResponse.json(
      {
        ok: true,
        suggestions,
        source: "Yahoo Finance search",
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
