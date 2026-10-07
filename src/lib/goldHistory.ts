/**
 * Long-run gold price (USD/oz) loader — shared by /api/gold-history and /api/commodities.
 * Primary: datasets/gold-prices monthly CSV (1833→…).
 * Freshness: Yahoo Finance GC=F monthly spliced onto the tail.
 * Soft-fails to in-memory last-good, then bundled snapshot.
 * Peg-era prints are documented historical/official series — not invented.
 * Educational · NFA.
 */

import snapshotJson from "@/data/gold-history-snapshot.json";

export type GoldPoint = { t: number; c: number };
type Point = GoldPoint;

export type GoldPayload = {
  ok: true;
  points: Point[];
  source: string;
  sourceUrl?: string;
  asOf: string;
  spot?: number | null;
  warnings?: string[];
  snapshot?: boolean;
  stale?: boolean;
  note?: string;
};

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const DATAHUB_URLS = [
  "https://raw.githubusercontent.com/datasets/gold-prices/main/data/monthly.csv",
  "https://datahub.io/core/gold-prices/r/monthly.csv",
];
const YAHOO_URLS = [
  "https://query1.finance.yahoo.com/v8/finance/chart/GC=F",
  "https://query2.finance.yahoo.com/v8/finance/chart/GC=F",
];

const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 14 * 24 * 60 * 60 * 1000;
const FETCH_MS = 10_000;

let lastGood: { at: number; body: GoldPayload } | null = (() => {
  const snap = snapshotJson as unknown as GoldPayload;
  if (snap?.ok && Array.isArray(snap.points) && snap.points.length >= 50) {
    return {
      at: Date.now() - FRESH_MS - 60_000,
      body: { ...snap, snapshot: true },
    };
  }
  return null;
})();

function softTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/csv,application/json,*/*", "User-Agent": UA },
    signal: softTimeout(FETCH_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: softTimeout(FETCH_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** "1833-01" or "1833-01-15" → mid-month unix seconds. */
function parseMonthKey(raw: string): number | null {
  const m = raw.trim().match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  return Math.floor(Date.UTC(y, mo - 1, 15, 12, 0, 0, 0) / 1000);
}

function parseDatahubCsv(text: string): Point[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const out: Point[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    const [dateStr, priceStr] = line.split(",");
    if (!dateStr || priceStr == null) continue;
    const t = parseMonthKey(dateStr);
    const c = Number(priceStr);
    if (t == null || !Number.isFinite(c) || c <= 0) continue;
    out.push({ t, c: Math.round(c * 1000) / 1000 });
  }
  return out;
}

async function loadDatahub(): Promise<Point[]> {
  let lastErr: Error | null = null;
  for (const url of DATAHUB_URLS) {
    try {
      const text = await fetchText(url);
      const pts = parseDatahubCsv(text);
      if (pts.length >= 100) return pts;
      lastErr = new Error(`too few points from ${url}`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("datahub gold failed");
}

async function loadYahooMonthly(): Promise<{ points: Point[]; spot: number | null }> {
  const period1 = Math.floor(Date.UTC(2000, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  let lastErr: Error | null = null;
  for (const base of YAHOO_URLS) {
    try {
      const url = `${base}?interval=1mo&period1=${period1}&period2=${period2}`;
      const json = (await fetchJson(url)) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            meta?: { regularMarketPrice?: number };
            indicators?: { quote?: Array<{ close?: (number | null)[] }> };
          }>;
        };
      };
      const result = json.chart?.result?.[0];
      const ts = result?.timestamp ?? [];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const points: Point[] = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== "number" || !Number.isFinite(c) || c <= 0) continue;
        // Normalise to mid-month for join stability
        const d = new Date(ts[i]! * 1000);
        const t = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15, 12, 0, 0, 0) / 1000);
        points.push({ t, c: Math.round(c * 1000) / 1000 });
      }
      if (points.length < 24) {
        lastErr = new Error("yahoo too short");
        continue;
      }
      const spot =
        typeof result?.meta?.regularMarketPrice === "number"
          ? result.meta.regularMarketPrice
          : points[points.length - 1]?.c ?? null;
      return { points, spot };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("yahoo GC=F failed");
}

function monthKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Prefer Yahoo on overlapping months; keep datahub for the long history. */
function stitch(datahub: Point[], yahoo: Point[]): Point[] {
  const map = new Map<string, Point>();
  for (const p of datahub) map.set(monthKey(p.t), p);
  for (const p of yahoo) map.set(monthKey(p.t), p);
  return [...map.values()].sort((a, b) => a.t - b.t);
}

async function buildLive(): Promise<GoldPayload> {
  const warnings: string[] = [];
  let datahub: Point[] = [];
  try {
    datahub = await loadDatahub();
  } catch (e) {
    warnings.push(
      `datahub: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let yahooPts: Point[] = [];
  let spot: number | null = null;
  try {
    const y = await loadYahooMonthly();
    yahooPts = y.points;
    spot = y.spot;
  } catch (e) {
    warnings.push(`yahoo: ${e instanceof Error ? e.message : String(e)}`);
  }

  let points: Point[] = [];
  const sources: string[] = [];
  if (datahub.length && yahooPts.length) {
    points = stitch(datahub, yahooPts);
    sources.push("datasets/gold-prices monthly", "Yahoo Finance GC=F monthly");
  } else if (datahub.length) {
    points = datahub;
    sources.push("datasets/gold-prices monthly");
  } else if (yahooPts.length) {
    points = yahooPts;
    sources.push("Yahoo Finance GC=F monthly");
  } else {
    throw new Error(warnings.join("; ") || "no gold sources");
  }

  return {
    ok: true,
    points,
    source: sources.join(" + "),
    sourceUrl: "https://github.com/datasets/gold-prices",
    asOf: new Date().toISOString(),
    spot,
    warnings: warnings.length ? warnings : undefined,
    note:
      "Long-run USD gold. Peg-era months come from the documented historical series (official mint / LBMA-era prints), not invented levels. Educational · NFA.",
  };
}

export type GoldResult =
  | { ok: true; body: GoldPayload; cacheControl: string }
  | { ok: false };

/** Live → in-memory last-good → bundled snapshot (same policy as before the move). */
export async function getGoldHistory(): Promise<GoldResult> {
  const now = Date.now();
  if (lastGood && now - lastGood.at < FRESH_MS) {
    return { ok: true, body: lastGood.body, cacheControl: "public, s-maxage=300, stale-while-revalidate=3600" };
  }

  try {
    const body = await buildLive();
    if (body.points.length >= 50) {
      lastGood = { at: now, body };
      return { ok: true, body, cacheControl: "public, s-maxage=300, stale-while-revalidate=3600" };
    }
  } catch {
    // fall through
  }

  if (lastGood && now - lastGood.at < STALE_MS) {
    return { ok: true, body: { ...lastGood.body, stale: true }, cacheControl: "public, s-maxage=60, stale-while-revalidate=3600" };
  }

  const snap = snapshotJson as unknown as GoldPayload;
  if (snap?.ok && Array.isArray(snap.points) && snap.points.length >= 50) {
    const body = { ...snap, snapshot: true, stale: true };
    lastGood = { at: now - FRESH_MS - 60_000, body };
    return { ok: true, body, cacheControl: "public, s-maxage=60, stale-while-revalidate=3600" };
  }

  return { ok: false };
}
