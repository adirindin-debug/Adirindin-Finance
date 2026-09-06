import { gunzipSync } from "zlib";
import { BTC_CYCLE_MAP_HTML_GZ_B64 } from "@/lib/btcCycleMapHtmlGz";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  const html = gunzipSync(Buffer.from(BTC_CYCLE_MAP_HTML_GZ_B64, "base64")).toString("utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
