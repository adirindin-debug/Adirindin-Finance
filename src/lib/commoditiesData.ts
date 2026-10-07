/**
 * Commodity charts — server-side loaders (used by /api/commodities).
 *
 * Sources (all public, attributable — never invented):
 *  - Gold:     long-run monthly USD gold (datasets/gold-prices + Yahoo GC=F tail) via src/lib/goldHistory.ts
 *  - Silver:   Yahoo Finance SI=F (COMEX front-month futures) daily closes
 *  - Copper:   Yahoo Finance HG=F (COMEX front-month futures) daily closes
 *  - Nickel:   IMF Primary Commodity Prices (PCPS) PNICK monthly → FRED PNICKUSDM fallback
 *  - Iron ore: IMF PCPS PIORECR monthly → FRED PIORECRUSDM fallback
 *  - Lithium:  IMF PCPS PLITH monthly (lithium metal ≥99%, battery grade)
 *
 * Each series soft-fails independently: live → in-memory last-good → dated
 * bundled snapshot (src/data/commodities-snapshot.json). Educational · NFA.
 */

import snapshotJson from "@/data/commodities-snapshot.json";
import { getGoldHistory } from "@/lib/goldHistory";
import type { CommodityId, CommodityPoint, CommoditySeries } from "@/lib/commodities";

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const FETCH_MS = 10_000;
const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 14 * 24 * 60 * 60 * 1000;

type SeriesMeta = Omit<CommoditySeries, "points" | "live" | "asOf" | "snapshot" | "stale" | "id"> & {
  id: Exclude<CommodityId, "gold">;
};

const IMF_URL = "https://data.imf.org/en/datasets/IMF.RES:PCPS";

const META: Record<Exclude<CommodityId, "gold">, SeriesMeta> = {
  silver: {
    id: "silver",
    label: "Silver",
    unit: "USD/oz",
    frequency: "daily",
    source: "Yahoo Finance · SI=F (COMEX silver futures, front month)",
    sourceUrl: "https://finance.yahoo.com/quote/SI%3DF/",
    benchmark: "COMEX silver futures, continuous front month, daily close",
  },
  copper: {
    id: "copper",
    label: "Copper",
    unit: "USD/lb",
    frequency: "daily",
    source: "Yahoo Finance · HG=F (COMEX copper futures, front month)",
    sourceUrl: "https://finance.yahoo.com/quote/HG%3DF/",
    benchmark: "COMEX high-grade copper futures, continuous front month, daily close",
  },
  nickel: {
    id: "nickel",
    label: "Nickel",
    unit: "USD/t",
    frequency: "monthly",
    source: "IMF Primary Commodity Prices (PCPS) · PNICK",
    sourceUrl: IMF_URL,
    benchmark: "Nickel, melting grade, LME spot, CIF European ports · monthly average",
  },
  ironOre: {
    id: "ironOre",
    label: "Iron ore",
    unit: "USD/t",
    frequency: "monthly",
    source: "IMF Primary Commodity Prices (PCPS) · PIORECR",
    sourceUrl: IMF_URL,
    benchmark: "China import iron ore fines 62% Fe spot, CFR Tianjin · monthly average",
  },
  lithium: {
    id: "lithium",
    label: "Lithium",
    unit: "USD/t",
    frequency: "monthly",
    source: "IMF Primary Commodity Prices (PCPS) · PLITH",
    sourceUrl: IMF_URL,
    benchmark: "Lithium metal ≥99%, battery grade (IMF benchmark) · monthly average",
  },
};

const FRED_FALLBACK: Partial<Record<CommodityId, string>> = {
  nickel: "PNICKUSDM",
  ironOre: "PIORECRUSDM",
};

const IMF_CODES: Partial<Record<CommodityId, string>> = {
  nickel: "PNICK",
  ironOre: "PIORECR",
  lithium: "PLITH",
};

const YAHOO_SYMBOLS: Partial<Record<CommodityId, string>> = {
  silver: "SI=F",
  copper: "HG=F",
};

async function fetchText(url: string, accept: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: accept, "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function midMonthSec(y: number, m: number): number {
  return Math.floor(Date.UTC(y, m - 1, 15, 12, 0, 0, 0) / 1000);
}

function round(c: number): number {
  return c >= 1000 ? Math.round(c * 100) / 100 : Math.round(c * 10000) / 10000;
}

/** Minimal CSV line splitter (handles quoted fields). */
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseImfCsv(text: string): CommodityPoint[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const head = splitCsv(lines[0]!);
  const iT = head.indexOf("TIME_PERIOD");
  const iV = head.indexOf("OBS_VALUE");
  if (iT < 0 || iV < 0) return [];
  const out: CommodityPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsv(lines[i]!);
    const m = (cols[iT] ?? "").match(/^(\d{4})-M(\d{2})$/);
    const c = Number(cols[iV]);
    if (!m || !Number.isFinite(c) || c <= 0) continue;
    out.push({ t: midMonthSec(Number(m[1]), Number(m[2])), c: round(c) });
  }
  return out.sort((a, b) => a.t - b.t);
}

export function parseFredCsv(text: string): CommodityPoint[] {
  const lines = text.trim().split(/\r?\n/);
  const out: CommodityPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [d, v] = lines[i]!.split(",");
    const m = (d ?? "").match(/^(\d{4})-(\d{2})-\d{2}$/);
    const c = Number(v);
    if (!m || !Number.isFinite(c) || c <= 0) continue;
    out.push({ t: midMonthSec(Number(m[1]), Number(m[2])), c: round(c) });
  }
  return out;
}

export async function loadImfMonthly(code: string): Promise<CommodityPoint[]> {
  const url = `https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/G001.${code}.USD.M?detail=dataonly`;
  const pts = parseImfCsv(await fetchText(url, "application/vnd.sdmx.data+csv;version=1.0.0"));
  if (pts.length < 24) throw new Error(`IMF ${code}: too few points`);
  return pts;
}

export async function loadFredMonthly(id: string): Promise<CommodityPoint[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
  const pts = parseFredCsv(await fetchText(url, "text/csv"));
  if (pts.length < 24) throw new Error(`FRED ${id}: too few points`);
  return pts;
}

export async function loadYahooDaily(symbol: string): Promise<CommodityPoint[]> {
  const period1 = Math.floor(Date.UTC(2000, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  let lastErr: Error | null = null;
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${period1}&period2=${period2}`;
      const json = JSON.parse(await fetchText(url, "application/json")) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: (number | null)[] }> };
          }>;
        };
      };
      const r = json.chart?.result?.[0];
      const ts = r?.timestamp ?? [];
      const closes = r?.indicators?.quote?.[0]?.close ?? [];
      const out: CommodityPoint[] = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== "number" || !Number.isFinite(c) || c <= 0) continue;
        out.push({ t: ts[i]!, c: round(c) });
      }
      if (out.length < 250) throw new Error(`Yahoo ${symbol}: too few points`);
      return out;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`Yahoo ${symbol} failed`);
}

type Snapshot = {
  asOf: string;
  series: Partial<Record<CommodityId, Omit<CommoditySeries, "live">>>;
};

const SNAPSHOT = snapshotJson as unknown as Snapshot;

const lastGood = new Map<CommodityId, { at: number; s: CommoditySeries }>();

async function buildLive(id: Exclude<CommodityId, "gold">): Promise<CommoditySeries> {
  const meta = META[id];
  const asOf = new Date().toISOString();
  const sym = YAHOO_SYMBOLS[id];
  if (sym) {
    return { ...meta, points: await loadYahooDaily(sym), live: true, asOf };
  }
  const imf = IMF_CODES[id];
  let imfErr: unknown = null;
  if (imf) {
    try {
      return { ...meta, points: await loadImfMonthly(imf), live: true, asOf };
    } catch (e) {
      imfErr = e;
    }
  }
  const fred = FRED_FALLBACK[id];
  if (fred) {
    return {
      ...meta,
      source: `IMF PCPS via FRED®, Federal Reserve Bank of St. Louis · ${fred}`,
      sourceUrl: `https://fred.stlouisfed.org/series/${fred}`,
      points: await loadFredMonthly(fred),
      live: true,
      asOf,
    };
  }
  throw imfErr instanceof Error ? imfErr : new Error(`${id}: no source`);
}

async function getSeries(id: Exclude<CommodityId, "gold">): Promise<{ s: CommoditySeries | null; err?: string }> {
  const now = Date.now();
  const lg = lastGood.get(id);
  if (lg && now - lg.at < FRESH_MS) return { s: lg.s };
  let err: string | undefined;
  try {
    const s = await buildLive(id);
    lastGood.set(id, { at: now, s });
    return { s };
  } catch (e) {
    err = `${id}: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (lg && now - lg.at < STALE_MS) return { s: { ...lg.s, live: false, stale: true }, err };
  const snap = SNAPSHOT.series?.[id];
  if (snap && snap.points?.length >= 12) {
    return { s: { ...snap, live: false, snapshot: true, stale: true }, err };
  }
  return { s: null, err };
}

async function getGoldSeries(): Promise<{ s: CommoditySeries | null; err?: string }> {
  const r = await getGoldHistory();
  if (!r.ok) return { s: null, err: "gold: unavailable" };
  const b = r.body;
  return {
    s: {
      id: "gold",
      label: "Gold",
      unit: "USD/oz",
      frequency: "monthly",
      source: b.source,
      sourceUrl: b.sourceUrl ?? "https://github.com/datasets/gold-prices",
      benchmark:
        "Long-run USD gold · datasets/gold-prices monthly (official / historical prints in the peg era) with Yahoo Finance GC=F (COMEX gold futures) monthly closes on the tail",
      points: b.points,
      live: !b.snapshot && !b.stale,
      snapshot: b.snapshot,
      stale: b.stale,
      asOf: b.asOf,
    },
  };
}

export async function getAllCommodities(): Promise<{
  series: Partial<Record<CommodityId, CommoditySeries>>;
  errors: string[];
}> {
  const ids: Exclude<CommodityId, "gold">[] = ["silver", "copper", "nickel", "lithium", "ironOre"];
  const [gold, ...rest] = await Promise.all([getGoldSeries(), ...ids.map((id) => getSeries(id))]);
  const series: Partial<Record<CommodityId, CommoditySeries>> = {};
  const errors: string[] = [];
  if (gold.s) series.gold = gold.s;
  if (gold.err) errors.push(gold.err);
  rest.forEach((r, i) => {
    if (r.s) series[ids[i]!] = r.s;
    if (r.err) errors.push(r.err);
  });
  return { series, errors };
}
