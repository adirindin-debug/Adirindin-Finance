/**
 * Proxy / resolve CoinGecko coin logos for spot-crypto portfolio tickers.
 * Static symbol map first; unknown symbols use CoinGecko search (cached).
 * Same-origin response so HoldingLogo can sample brand colours (CORS).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  COINGECKO_ID_BY_SYMBOL,
  COINGECKO_IMAGE_BY_SYMBOL,
  cryptoBaseSymbol,
  isSpotCryptoTicker,
} from "@/lib/cryptoLogos";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindin.finance)";

const TICKER_PATTERN = /^[A-Z0-9./-]+$/;
const CACHE_CONTROL =
  "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const NO_STORE = "no-store";

/** In-process cache: base symbol → image URL (or null for soft-fail). */
const resolvedImageCache = new Map<string, string | null>();

function errorResponse(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}

async function fetchUpstreamImage(url: string): Promise<NextResponse | null> {
  const upstream = await fetch(url, {
    headers: { Accept: "image/*,*/*", "User-Agent": UA },
    next: { revalidate: 86400 },
  });
  if (!upstream.ok) return null;
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    },
  });
}

type SearchCoin = {
  id?: string;
  symbol?: string;
  name?: string;
  market_cap_rank?: number | null;
  large?: string;
  thumb?: string;
};

async function lookupViaCoinGeckoSearch(base: string): Promise<string | null> {
  const knownId = COINGECKO_ID_BY_SYMBOL[base];
  if (knownId) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(knownId)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
        {
          headers: { Accept: "application/json", "User-Agent": UA },
          next: { revalidate: 86400 },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          image?: { large?: string; small?: string; thumb?: string };
        };
        const img = data.image?.large || data.image?.small || data.image?.thumb;
        if (img) return img;
      }
    } catch {
      // fall through to search
    }
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(base)}`,
      {
        headers: { Accept: "application/json", "User-Agent": UA },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { coins?: SearchCoin[] };
    const coins = data.coins ?? [];
    const exact = coins
      .filter((c) => (c.symbol ?? "").toUpperCase() === base)
      .sort((a, b) => {
        const ra = a.market_cap_rank ?? 999999;
        const rb = b.market_cap_rank ?? 999999;
        return ra - rb;
      });
    const hit = exact[0] ?? coins[0];
    if (!hit) return null;
    return hit.large || hit.thumb || null;
  } catch {
    return null;
  }
}

async function resolveImageUrl(ticker: string): Promise<string | null> {
  const base = cryptoBaseSymbol(ticker);
  if (resolvedImageCache.has(base)) {
    return resolvedImageCache.get(base) ?? null;
  }

  const staticUrl = COINGECKO_IMAGE_BY_SYMBOL[base];
  if (staticUrl) {
    resolvedImageCache.set(base, staticUrl);
    return staticUrl;
  }

  const looked = await lookupViaCoinGeckoSearch(base);
  resolvedImageCache.set(base, looked);
  return looked;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ticker =
    request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!ticker || ticker.length > 32 || !TICKER_PATTERN.test(ticker)) {
    return errorResponse(400);
  }
  if (!isSpotCryptoTicker(ticker)) {
    return errorResponse(404);
  }

  try {
    const imageUrl = await resolveImageUrl(ticker);
    if (!imageUrl) return errorResponse(404);

    const proxied = await fetchUpstreamImage(imageUrl);
    if (proxied) return proxied;

    // Soft-fail so the client can fall back to initials / ₿
    return errorResponse(404);
  } catch {
    return errorResponse(502);
  }
}
