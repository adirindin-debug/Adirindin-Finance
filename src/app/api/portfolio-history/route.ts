/**
 * Portfolio performance history vs ^NDX / ^GSPC / ^AORD.
 * Reconstructs portfolio AUD value over a timeframe, returns % series
 * normalized to 0 at the left edge (window start / first common point).
 *
 * Holding rules:
 * - If acquiredAt is set: include qty from that date onward.
 * - If acquiredAt is missing: assume held for the full window from the
 *   earlier of window start or first available price for that ticker.
 * Collectables use a flat estimated AUD value (converted with AUDUSD history
 * when the estimate was entered in USD). Cash is included as a flat AUD amount.
 *
 * Educational — NFA.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchLicensedDaily } from "@/lib/licensedDaily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Tf = "1D" | "1W" | "1M" | "YTD" | "1Y" | "3Y" | "4Y" | "5Y" | "10Y" | "20Y" | "ALL";
type ClosePoint = { t: number; c: number };
type PctPoint = { t: number; pct: number };

type HoldingIn = {
  id?: string;
  kind?: string;
  ticker?: string;
  quantity?: number;
  acquiredAt?: string;
  estimatedValue?: number;
  estimatedValueCurrency?: string;
};

/**
 * Index benchmarks (Nasdaq 100, S&P 500, All Ords) removed: they came from Yahoo Finance
 * and have no free source licensed for public display.
 */
const BENCHMARKS: ReadonlyArray<{ id: string; label: string; symbol: string }> = [];

const VALID_TF = new Set<string>([
  "1D",
  "1W",
  "1M",
  "YTD",
  "1Y",
  "3Y",
  "4Y",
  "5Y",
  "10Y",
  "20Y",
  "ALL",
]);

function parseTf(raw: string | null): Tf {
  if (!raw) return "1Y";
  // Accept lowercase homepage keys (1y / 20y) as well as portfolio labels.
  const upper = raw.trim().toUpperCase();
  if (VALID_TF.has(upper)) return upper as Tf;
  return "1Y";
}

function windowStartSec(tf: Tf, nowSec: number): number {
  const d = new Date(nowSec * 1000);
  // 1D: ~1 calendar day target (prior-session clip applied after day union).
  if (tf === "1D") return nowSec - 86400;
  if (tf === "1W") return nowSec - 7 * 86400;
  if (tf === "1M") return nowSec - 30 * 86400;
  if (tf === "YTD") return Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
  if (tf === "1Y") return nowSec - Math.round(365.25 * 86400);
  if (tf === "3Y") return nowSec - Math.round(3 * 365.25 * 86400);
  if (tf === "4Y") return nowSec - Math.round(4 * 365.25 * 86400);
  if (tf === "5Y") return nowSec - Math.round(5 * 365.25 * 86400);
  if (tf === "10Y") return nowSec - Math.round(10 * 365.25 * 86400);
  if (tf === "20Y") return nowSec - Math.round(20 * 365.25 * 86400);
  return 0; // ALL — clip later to data
}

function dayKey(t: number): number {
  // UTC day bucket
  return Math.floor(t / 86400) * 86400;
}



function forwardFillMap(points: ClosePoint[]): Map<number, number> {
  const map = new Map<number, number>();
  let last: number | null = null;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  for (const p of sorted) {
    last = p.c;
    map.set(dayKey(p.t), p.c);
  }
  return map;
}

function lookupPrice(map: Map<number, number>, day: number): number | null {
  if (map.has(day)) return map.get(day)!;
  // walk back up to ~10 calendar days
  for (let i = 1; i <= 10; i++) {
    const d = day - i * 86400;
    if (map.has(d)) return map.get(d)!;
  }
  return null;
}

function toPct(points: { t: number; v: number }[]): PctPoint[] {
  const first = points.find((p) => p.v > 0);
  if (!first) return [];
  const base = first.v;
  return points
    .filter((p) => p.t >= first.t && p.v > 0)
    .map((p) => ({ t: p.t, pct: ((p.v / base) - 1) * 100 }));
}

function parseHoldings(raw: string | null): HoldingIn[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 40) as HoldingIn[];
  } catch {
    return [];
  }
}

function acquiredSec(h: HoldingIn): number | null {
  if (!h.acquiredAt || typeof h.acquiredAt !== "string") return null;
  const ms = Date.parse(h.acquiredAt.length === 10 ? `${h.acquiredAt}T00:00:00Z` : h.acquiredAt);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

export async function GET(req: NextRequest) {
  const tf = parseTf(req.nextUrl.searchParams.get("tf"));
  const holdings = parseHoldings(req.nextUrl.searchParams.get("holdings"));
  const cashRaw = Number(req.nextUrl.searchParams.get("cash") ?? "0");
  const cashAud = Number.isFinite(cashRaw) && cashRaw > 0 ? cashRaw : 0;

  const nowSec = Math.floor(Date.now() / 1000);
  const winStart = windowStartSec(tf, nowSec);
  // Fetch a bit of history before window for forward-fill bases
  const fetchFrom = tf === "ALL" ? 0 : Math.max(0, winStart - 45 * 86400);

  try {
    const securityTickers = [
      ...new Set(
        holdings
          .filter((h) => (h.kind ?? "security") === "security")
          .map((h) => (h.ticker ?? "").trim().toUpperCase())
          .filter(Boolean),
      ),
    ];

    const symbols = [
      ...securityTickers,
      "AUDUSD=X",
      ...BENCHMARKS.map((b) => b.symbol),
    ];

    const priceMaps = new Map<string, Map<number, number>>();
    const errors: Record<string, string> = {};

    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const pts = await fetchLicensedDaily(sym, fetchFrom);
          priceMaps.set(sym.toUpperCase(), forwardFillMap(pts));
        } catch (e) {
          errors[sym] = e instanceof Error ? e.message : "fetch failed";
        }
      }),
    );

    const fxMap = priceMaps.get("AUDUSD=X");
    if (!fxMap || fxMap.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Could not fetch AUDUSD history", errors },
        { status: 502 },
      );
    }

    // Build sorted union of trading days from FX + securities + benchmarks
    const daySet = new Set<number>();
    // 1D needs a wider pad so weekends still yield a prior trading session.
    const dayPadSec = (tf === "1D" ? 14 : 5) * 86400;
    for (const map of priceMaps.values()) {
      for (const d of map.keys()) {
        if (tf === "ALL" || d >= winStart - dayPadSec) daySet.add(d);
      }
    }
    let days = [...daySet].sort((a, b) => a - b);
    if (tf === "1D") {
      // Prior-session style (aligns with portfolio-returns 1D): last two trading days.
      const recent = days.filter((d) => d >= nowSec - 14 * 86400);
      days = recent.length >= 2 ? recent.slice(-2) : recent;
    } else if (tf !== "ALL") {
      days = days.filter((d) => d >= winStart);
    }
    if (days.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Not enough history for this timeframe", errors },
        { status: 422 },
      );
    }
    // Effective left edge after clip (important for 1D weekend prior-session).
    const rangeStart = days[0]!;

    function audPerUsdAt(day: number): number | null {
      const audUsd = lookupPrice(fxMap!, day); // USD per 1 AUD
      if (audUsd == null || !(audUsd > 0)) return null;
      return 1 / audUsd;
    }

    function priceAud(ticker: string, day: number): number | null {
      const map = priceMaps.get(ticker.toUpperCase());
      if (!map) return null;
      const px = lookupPrice(map, day);
      if (px == null) return null;
      // Heuristic currency: .AX / AUD → AUD; else USD
      const t = ticker.toUpperCase();
      if (t.endsWith(".AX") || t.includes("AUD")) return px;
      const fx = audPerUsdAt(day);
      if (fx == null) return null;
      return px * fx;
    }

    // Portfolio value series (AUD)
    const portfolioValues: { t: number; v: number }[] = [];
    for (const day of days) {
      let total = cashAud;
      let any = cashAud > 0;

      for (const h of holdings) {
        const qty = Number(h.quantity);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const acq = acquiredSec(h);
        const kind = h.kind ?? "security";

        if (kind === "collectable") {
          // Flat estimate; if no acquiredAt, held for full window
          if (acq != null && day < acq) continue;
          const est = Number(h.estimatedValue ?? 0);
          if (!(est >= 0)) continue;
          const cur = (h.estimatedValueCurrency ?? "AUD").toUpperCase();
          let aud = est;
          if (cur === "USD") {
            const fx = audPerUsdAt(day);
            if (fx == null) continue;
            aud = est * fx;
          }
          total += aud * qty;
          any = true;
          continue;
        }

        const ticker = (h.ticker ?? "").trim().toUpperCase();
        if (!ticker) continue;

        const map = priceMaps.get(ticker);
        if (!map || map.size === 0) continue;

        // First available price day for this ticker
        const firstPxDay = Math.min(...map.keys());
        const heldFrom =
          acq != null
            ? acq
            : // missing acquiredAt → held for full window from earliest price or window start
              Math.max(tf === "ALL" ? firstPxDay : rangeStart, firstPxDay);

        if (day < heldFrom) continue;

        const px = priceAud(ticker, day);
        if (px == null) continue;
        total += qty * px;
        any = true;
      }

      if (any && total > 0) portfolioValues.push({ t: day, v: total });
    }

    const portfolioPct = toPct(portfolioValues);

    const series: Array<{
      id: string;
      label: string;
      points: PctPoint[];
      latestPct: number | null;
    }> = [];

    if (portfolioPct.length) {
      series.push({
        id: "portfolio",
        label: "This portfolio",
        points: portfolioPct,
        latestPct: portfolioPct[portfolioPct.length - 1]?.pct ?? null,
      });
    }

    for (const b of BENCHMARKS) {
      const map = priceMaps.get(b.symbol.toUpperCase());
      if (!map) continue;
      const vals: { t: number; v: number }[] = [];
      for (const day of days) {
        const px = lookupPrice(map, day);
        if (px == null) continue;
        vals.push({ t: day, v: px });
      }
      const pct = toPct(vals);
      if (!pct.length) continue;
      series.push({
        id: b.id,
        label: b.label,
        points: pct,
        latestPct: pct[pct.length - 1]?.pct ?? null,
      });
    }

    return NextResponse.json({
      ok: true,
      tf,
      asOf: new Date().toISOString(),
      note:
        "Portfolio AUD value reconstructed from holdings. Missing acquiredAt ⇒ held for full window from earliest available price or window start. Collectables = flat estimate. Cash = flat AUD. Series normalized to 0% at left.",
      series,
      errors: Object.keys(errors).length ? errors : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "History fetch failed",
      },
      { status: 502 },
    );
  }
}
