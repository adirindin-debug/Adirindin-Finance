/**
 * Wilshire 5000 / US M2 ratio from public FRED (CSV; optional FRED_API_KEY).
 * Wilshire fallback: Yahoo Finance ^W5000 when FRED series blocked.
 * M2 fallback: GitHub Neo-Solon / eco3min mirrors, then bundled CSV
 * (same pattern as four-year-gains) when live FRED is unreachable.
 * Concept similar to MacroMicro Wilshire/M2 — we do not scrape MacroMicro.
 * Fast path: in-memory last-good + dated snapshot so Charts hub never hangs ~60s.
 * Educational only — NFA.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { after } from "next/server";
import snapshotJson from "@/data/wilshire-m2-snapshot.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Obs = { t: number; v: number }; // unix sec, value
type RatioPoint = { t: number; ratio: number; wilshire: number; m2: number };

/** Soft network budget — fail through to mirrors/bundled before Vercel kills the request. */
const FRED_TIMEOUT_MS = 8_000;
const MIRROR_TIMEOUT_MS = 6_000;
/** Serve last-good while refreshing; avoid ~60s cold hangs on the Charts tile. */
const FRESH_MS = 6 * 60 * 60 * 1000;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const LIVE_BUDGET_MS = 12_000;

/** One shared in-flight refresh so concurrent requests don't stampede the feeds. */
let inflight: Promise<WilshirePayload> | null = null;
function refreshOnce(): Promise<WilshirePayload> {
  if (!inflight) {
    inflight = refreshLive().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

function withBudget<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(label)), ms),
    ),
  ]);
}

type WilshirePayload = {
  ok: true;
  current: { ratio: number; wilshire: number; m2: number; t: number };
  points: RatioPoint[];
  wilshireSource: string;
  m2Source: string;
  ratioDefinition: string;
  fredCredits: string;
  macroMicroUrl: string;
  note: string;
  errors?: string[];
  asOf: string;
  snapshot?: boolean;
  stale?: boolean;
};

let lastGood: { at: number; body: WilshirePayload } | null = (() => {
  const snap = snapshotJson as unknown as WilshirePayload;
  if (snap?.ok && Array.isArray(snap.points) && snap.points.length >= 2) {
    // Seed as "stale but within STALE_MS" so cold instances return the snapshot
    // immediately and kick a background refresh (at:0 was older than STALE_MS).
    return {
      at: Date.now() - FRESH_MS - 60_000,
      body: { ...snap, snapshot: true },
    };
  }
  return null;
})();

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function softTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function parseFredCsv(text: string, seriesId: string): Obs[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  if (!header.includes("observation_date") && !header.includes("date")) {
    // bot wall / HTML
    return [];
  }
  const out: Obs[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [dateStr, valStr] = line.split(",");
    if (!dateStr || valStr == null || valStr === "." || valStr === "") continue;
    const v = Number(valStr);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${dateStr.trim()}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) {
    throw new Error(`FRED ${seriesId}: no numeric observations in CSV`);
  }
  return out;
}

function parseEco3minM2Csv(text: string): Obs[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headerCols = lines[0].split(",").map((c) => c.trim().toLowerCase());
  const dateIdx = headerCols.indexOf("date");
  const m2Idx =
    headerCols.indexOf("m2_billions") >= 0
      ? headerCols.indexOf("m2_billions")
      : headerCols.indexOf("m2sl");
  if (dateIdx < 0 || m2Idx < 0) {
    throw new Error("eco3min M2 CSV: missing date/m2_billions");
  }
  const out: Obs[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const dateStr = cols[dateIdx]?.trim();
    const valStr = cols[m2Idx]?.trim();
    if (!dateStr || !valStr || valStr === ".") continue;
    const v = Number(valStr);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${dateStr}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) throw new Error("eco3min M2 CSV: empty");
  return out;
}

async function fetchFredCsv(seriesId: string): Promise<Obs[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 21600 },
    signal: softTimeout(FRED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`FRED CSV ${seriesId}: HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith("<!DOCTYPE") || text.trimStart().startsWith("<html")) {
    throw new Error(`FRED CSV ${seriesId}: HTML challenge page`);
  }
  return parseFredCsv(text, seriesId);
}

async function fetchFredApi(seriesId: string, apiKey: string): Promise<Obs[]> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${encodeURIComponent(seriesId)}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json&observation_start=1970-01-01`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 21600 },
    signal: softTimeout(FRED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`FRED API ${seriesId}: HTTP ${res.status}`);
  const json = (await res.json()) as {
    observations?: Array<{ date: string; value: string }>;
  };
  const out: Obs[] = [];
  for (const o of json.observations ?? []) {
    if (o.value === "." || o.value === "") continue;
    const v = Number(o.value);
    if (!Number.isFinite(v) || v <= 0) continue;
    const t = Date.parse(`${o.date}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) throw new Error(`FRED API ${seriesId}: empty`);
  return out;
}

async function fetchTextMirror(url: string, label: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 21600 },
    signal: softTimeout(MIRROR_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
  const text = await res.text();
  if (
    text.trimStart().startsWith("<!DOCTYPE") ||
    text.trimStart().startsWith("<html")
  ) {
    throw new Error(`${label}: HTML challenge page`);
  }
  return text;
}

async function fetchM2LiveMirror(): Promise<{ obs: Obs[]; origin: string }> {
  try {
    const text = await fetchTextMirror(
      "https://eco3min.fr/dataset/us-m2-money-supply.csv",
      "eco3min M2",
    );
    return {
      obs: parseEco3minM2Csv(text),
      origin: "mirror:eco3min.us-m2-money-supply",
    };
  } catch {
    const text = await fetchTextMirror(
      "https://raw.githubusercontent.com/Neo-Solon/economic_data/main/M2SL.csv",
      "Neo-Solon M2SL",
    );
    return {
      obs: parseFredCsv(text, "M2SL"),
      origin: "mirror:Neo-Solon/economic_data M2SL",
    };
  }
}

function loadBundledFredFallback(seriesId: string): {
  obs: Obs[];
  origin: string;
} {
  const filePath = join(
    process.cwd(),
    "src/data/fred-fallback",
    `${seriesId}.csv`,
  );
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`bundled fallback missing: ${seriesId}.csv`);
  }
  const obs = parseFredCsv(text, seriesId);
  const last = obs[obs.length - 1]!;
  const asOf = new Date(last.t * 1000).toISOString().slice(0, 7);
  return {
    obs,
    origin: `bundled-fallback ${seriesId} through ${asOf}`,
  };
}

type SeriesLoad = { obs: Obs[]; origin: string; usedFallback: boolean };

/**
 * M2SL: FRED API (if key) → FRED CSV → eco3min / Neo-Solon mirrors → bundled CSV.
 */
async function fetchM2(apiKey: string | undefined): Promise<SeriesLoad> {
  const errors: string[] = [];

  if (apiKey) {
    try {
      const obs = await fetchFredApi("M2SL", apiKey);
      return {
        obs,
        origin: "FRED API M2SL (monthly, SA, billions USD)",
        usedFallback: false,
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "api failed");
    }
  }

  try {
    const obs = await fetchFredCsv("M2SL");
    return {
      obs,
      origin: "FRED CSV M2SL (monthly, SA, billions USD)",
      usedFallback: false,
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "csv failed");
  }

  try {
    const { obs, origin } = await fetchM2LiveMirror();
    return {
      obs,
      origin: `${origin} (monthly, SA, billions USD)`,
      usedFallback: true,
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "mirror failed");
  }

  try {
    const { obs, origin } = loadBundledFredFallback("M2SL");
    return {
      obs,
      origin: `${origin} (monthly, SA, billions USD)`,
      usedFallback: true,
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "bundled failed");
  }

  throw new Error(errors.join("; ") || "M2SL failed");
}

/** Wilshire on FRED only (no bundled series) — Yahoo is the dedicated fallback. */
async function fetchFredWilshire(
  seriesId: string,
  apiKey: string | undefined,
): Promise<Obs[]> {
  const errors: string[] = [];
  if (apiKey) {
    try {
      return await fetchFredApi(seriesId, apiKey);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "api failed");
    }
  }
  try {
    return await fetchFredCsv(seriesId);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "csv failed");
    throw new Error(errors.join("; "));
  }
}

async function fetchYahooWilshireMonthly(): Promise<Obs[]> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = 315532800; // 1980-01-01
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/%5EW5000` +
    `?period1=${period1}&period2=${period2}&interval=1mo&events=history`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 21600 },
    signal: softTimeout(FRED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Yahoo ^W5000: HTTP ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  const ts = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const out: Obs[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !Number.isFinite(c) || c <= 0) continue;
    // Normalise to UTC month-start so ymKey matches FRED M2 (YYYY-MM-01).
    // Yahoo monthly bars can sit on the 1st in US time and shift UTC day.
    const d = new Date(ts[i] * 1000);
    const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
    out.push({ t: monthStart, v: c });
  }
  if (out.length < 12) throw new Error("Yahoo ^W5000: insufficient history");
  return out;
}

function ymKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Month-end Wilshire (last obs in month) / monthly M2. */
function buildRatio(wilshire: Obs[], m2: Obs[]): RatioPoint[] {
  const willByMonth = new Map<string, Obs>();
  for (const o of wilshire) {
    const k = ymKey(o.t);
    const prev = willByMonth.get(k);
    if (!prev || o.t >= prev.t) willByMonth.set(k, o);
  }
  const out: RatioPoint[] = [];
  for (const m of m2) {
    if (m.v <= 0) continue;
    const k = ymKey(m.t);
    const w = willByMonth.get(k);
    if (!w) continue;
    const ratio = w.v / m.v;
    if (!Number.isFinite(ratio)) continue;
    out.push({ t: m.t, ratio, wilshire: w.v, m2: m.v });
  }
  return out;
}

function downsample(points: RatioPoint[], maxPts: number): RatioPoint[] {
  if (points.length <= maxPts) return points;
  const out: RatioPoint[] = [];
  const lastIdx = points.length - 1;
  for (let k = 0; k < maxPts; k++) {
    const i = Math.round((k * lastIdx) / (maxPts - 1));
    const p = points[i];
    if (!out.length || out[out.length - 1].t !== p.t) out.push(p);
  }
  return out;
}

export async function GET() {
  const now = Date.now();
  if (lastGood && now - lastGood.at < FRESH_MS) {
    return Response.json(lastGood.body, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
        "X-Wilshire-Cache": "memory-fresh",
      },
    });
  }

  // Stale-while-revalidate: return last-good immediately and refresh in background
  // when we already have usable data (avoids Charts hub tile stuck on Loading).
  // `after()` keeps the refresh alive past the response on Vercel; a bare
  // `void refreshLive()` was frozen with the function, so cold instances
  // served the bundled snapshot indefinitely.
  if (lastGood && now - lastGood.at < STALE_MS) {
    if (!inflight) {
      const live = refreshOnce();
      after(() => live.catch(() => {}));
    }
    return Response.json(
      { ...lastGood.body, stale: true },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=43200",
          "X-Wilshire-Cache": "memory-stale",
        },
      },
    );
  }

  try {
    const body = await withBudget(refreshOnce(), LIVE_BUDGET_MS, "live budget exceeded");
    return Response.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
        "X-Wilshire-Cache": "live",
      },
    });
  } catch (e) {
    if (lastGood) {
      return Response.json(
        { ...lastGood.body, stale: true, errors: [e instanceof Error ? e.message : "live failed"] },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=43200",
            "X-Wilshire-Cache": "memory-fallback",
          },
        },
      );
    }
    const snap = snapshotJson as unknown as WilshirePayload;
    if (snap?.ok && Array.isArray(snap.points) && snap.points.length >= 2) {
      return Response.json(
        {
          ...snap,
          snapshot: true,
          stale: true,
          note:
            (snap.note ?? "") +
            " Serving dated snapshot while live FRED/Yahoo feeds are slow or unreachable.",
          errors: [e instanceof Error ? e.message : "live failed"],
        },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
            "X-Wilshire-Cache": "snapshot",
          },
        },
      );
    }
    return Response.json(
      {
        ok: false,
        error: "Could not load Wilshire and/or M2",
        errors: [e instanceof Error ? e.message : "live failed"],
      },
      { status: 502 },
    );
  }
}

async function refreshLive(): Promise<WilshirePayload> {
  const apiKey = process.env.FRED_API_KEY?.trim() || undefined;
  const errors: string[] = [];

  // Parallel: M2 path and Wilshire path (FRED series then Yahoo) — was sequential (~60s).
  const [m2Result, wilshireResult] = await Promise.all([
    fetchM2(apiKey).catch((e) => {
      errors.push(e instanceof Error ? e.message : "M2SL failed");
      return null;
    }),
    (async (): Promise<{ obs: Obs[]; source: string } | null> => {
      for (const id of ["WILL5000PR", "WILL5000IND"] as const) {
        try {
          const obs = await fetchFredWilshire(id, apiKey);
          return {
            obs,
            source: apiKey ? `FRED API ${id}` : `FRED CSV ${id}`,
          };
        } catch (e) {
          errors.push(e instanceof Error ? e.message : `${id} failed`);
        }
      }
      try {
        const obs = await fetchYahooWilshireMonthly();
        return {
          obs,
          source: "Yahoo Finance ^W5000 (monthly) — Wilshire 5000 fallback",
        };
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "Yahoo Wilshire failed");
        return null;
      }
    })(),
  ]);

  if (!m2Result || !wilshireResult) {
    throw new Error(errors.join("; ") || "Could not load Wilshire and/or M2");
  }

  const ratio = buildRatio(wilshireResult.obs, m2Result.obs);
  if (ratio.length < 2) {
    throw new Error(
      `Insufficient overlapping Wilshire/M2 months (overlap=${ratio.length})`,
    );
  }

  const points = downsample(ratio, 500);
  const latest = points[points.length - 1]!;

  const body: WilshirePayload = {
    ok: true,
    current: {
      ratio: latest.ratio,
      wilshire: latest.wilshire,
      m2: latest.m2,
      t: latest.t,
    },
    points,
    wilshireSource: wilshireResult.source,
    m2Source: m2Result.origin,
    ratioDefinition:
      "Ratio = Wilshire 5000 index level ÷ M2SL (FRED, billions USD, seasonally adjusted). Monthly alignment: last Wilshire observation in each M2 month.",
    fredCredits: "Data via FRED®, Federal Reserve Bank of St. Louis.",
    macroMicroUrl:
      "https://en.macromicro.me/collections/34/us-stock-relative/24033/wilshire5000-to-us-m2",
    note: "Educational valuation framing (concept similar to MacroMicro Wilshire/M2). Not a forecast or financial advice (NFA).",
    errors: errors.length ? errors : undefined,
    asOf: new Date().toISOString(),
  };

  lastGood = { at: Date.now(), body };
  return body;
}
