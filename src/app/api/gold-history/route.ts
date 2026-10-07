/**
 * Long-run gold price (USD/oz) API. Loader lives in src/lib/goldHistory.ts
 * (shared with /api/commodities). Educational · NFA.
 */

import { getGoldHistory } from "@/lib/goldHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  const r = await getGoldHistory();
  if (r.ok) {
    return Response.json(r.body, { headers: { "Cache-Control": r.cacheControl } });
  }
  return Response.json({ ok: false, error: "Gold history unavailable" }, { status: 503 });
}
