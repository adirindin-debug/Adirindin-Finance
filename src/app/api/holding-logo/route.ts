import { NextRequest, NextResponse } from "next/server";

const TICKER_PATTERN = /^[A-Z0-9.-]+$/;
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const NO_STORE = "no-store";

function errorResponse(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": NO_STORE },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase() ?? "";
  if (!ticker || ticker.length > 32 || !TICKER_PATTERN.test(ticker)) {
    return errorResponse(400);
  }

  const primaryToken = process.env.LOGO_DEV_PUBLISHABLE_KEY;
  const token = primaryToken?.startsWith("pk_")
    ? primaryToken
    : process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY;
  if (!token?.startsWith("pk_")) {
    return errorResponse(404);
  }

  const upstreamUrl = new URL(`https://img.logo.dev/ticker/${encodeURIComponent(ticker)}`);
  upstreamUrl.searchParams.set("token", token);
  upstreamUrl.searchParams.set("fallback", "404");
  upstreamUrl.searchParams.set("format", "png");
  upstreamUrl.searchParams.set("size", "80");

  try {
    const upstream = await fetch(upstreamUrl, {
      next: { revalidate: 86400 },
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
      },
    });
  } catch {
    return errorResponse(502);
  }
}
