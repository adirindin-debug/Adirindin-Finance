import { NextRequest, NextResponse } from "next/server";
import { LOGO_DEV_PUBLISHABLE_KEY } from "@/lib/logoDevToken";

const TICKER_PATTERN = /^[A-Z0-9.-]+$/;
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const NO_STORE = "no-store";

function errorResponse(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}

function resolvePublishableToken(): string | null {
  const candidates = [
    process.env.LOGO_DEV_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY,
    LOGO_DEV_PUBLISHABLE_KEY,
  ];
  for (const raw of candidates) {
    const t = raw?.trim();
    if (t?.startsWith("pk_")) return t;
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!ticker || ticker.length > 32 || !TICKER_PATTERN.test(ticker)) {
    return errorResponse(400);
  }

  const token = resolvePublishableToken();
  if (!token) return errorResponse(404);

  const upstreamUrl = new URL(`https://img.logo.dev/ticker/${encodeURIComponent(ticker)}`);
  upstreamUrl.searchParams.set("token", token);
  upstreamUrl.searchParams.set("fallback", "404");
  upstreamUrl.searchParams.set("format", "png");
  upstreamUrl.searchParams.set("size", "128");
  upstreamUrl.searchParams.set("retina", "true");
  // Black UI: monochrome marks (e.g. Strategy/MSTR, AAPL) come black-on-transparent
  // by default and vanish; theme=dark flips those to white. Colour logos stay tinted.
  upstreamUrl.searchParams.set("theme", "dark");

  try {
    const upstream = await fetch(upstreamUrl.toString(), {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "image/*", "User-Agent": "AdirindinFinance/1.0" },
    });

    if (upstream.status === 404) return errorResponse(404);
    if (!upstream.ok) return errorResponse(502);

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return errorResponse(502);

    return new NextResponse(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return errorResponse(502);
  }
}
