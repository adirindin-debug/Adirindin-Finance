/**
 * Commodity charts API — gold, silver, copper, nickel, lithium, iron ore.
 * GET /api/commodities            → full series (detail chart)
 * GET /api/commodities?view=tile  → 5-year monthly lines rebased to 100 (Charts hub tile)
 * Per-series soft-fail: live → last-good → dated snapshot. Educational · NFA.
 */

import { buildTileLines, TILE_WINDOW_YEARS } from "@/lib/commodities";
import { getAllCommodities } from "@/lib/commoditiesData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CACHE = "public, s-maxage=900, stale-while-revalidate=3600";

export async function GET(req: Request) {
  const view = new URL(req.url).searchParams.get("view");
  const { series, errors } = await getAllCommodities();
  const count = Object.keys(series).length;
  if (!count) {
    return Response.json(
      { ok: false, error: "Commodity data unavailable", errors },
      { status: 503 },
    );
  }
  const asOf = new Date().toISOString();
  if (view === "tile") {
    const lines = buildTileLines(series, TILE_WINDOW_YEARS);
    const g = series.gold?.points;
    const last = g?.length ? g[g.length - 1]! : null;
    return Response.json(
      {
        ok: lines.length > 0,
        asOf,
        windowYears: TILE_WINDOW_YEARS,
        lines,
        gold: last ? { c: last.c, t: last.t, unit: "USD/oz" } : null,
        live: Object.values(series).every((s) => s?.live),
      },
      { headers: { "Cache-Control": CACHE } },
    );
  }
  return Response.json(
    {
      ok: true,
      asOf,
      series,
      errors: errors.length ? errors : undefined,
      note: "Public sources only — futures closes (Yahoo Finance), IMF PCPS monthly benchmark averages and long-run gold history. Never invented. Educational · NFA.",
    },
    { headers: { "Cache-Control": CACHE } },
  );
}
