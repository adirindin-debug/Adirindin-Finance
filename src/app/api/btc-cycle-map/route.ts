import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serve the same public HTML used by /btc-cycle-map.html so embeds stay in sync. */
export function GET() {
  const html = readFileSync(join(process.cwd(), "public/btc-cycle-map.html"), "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
