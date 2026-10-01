/**
 * Same-origin data for /charts/global-equities (Global equities · sentiment state).
 *
 * Price: iShares MSCI World ETF (URTH) daily adjusted close from the Yahoo
 * Finance chart API (same public feed used elsewhere on this site), as a
 * labelled PROXY for MSCI World. MSCI index data itself is licensed and not used.
 * Sentiment: CBOE VIX close via FRED VIXCLS ("Copyrighted: Citation required"),
 * plus each day's percentile against the prior 5 years of VIX closes.
 *
 * Order: Yahoo query1 → query2 for URTH; FRED API (if FRED_API_KEY) → FRED CSV
 * for VIX; then last-good in-memory cache; then the dated snapshot in
 * src/data/global-equities-snapshot.json. Never invents data. NFA.
 */

import snapshot from "@/data/global-equities-snapshot.json";
import type { EqPayload, EqRow } from "@/lib/globalEquities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PRICE_SOURCE =
  "iShares MSCI World ETF (URTH, NYSE Arca) adjusted close via Yahoo Finance — proxy for MSCI World";
const VIX_SOURCE = "Cboe Volatility Index (VIX) close via FRED (VIXCLS)";

type Snapshot = { asOf: string; vixAsOf: string; rows: EqRow[] };
const SNAP = snapshot as unknown as Snapshot;

let lastGood: EqPayload | null = null;

async function fetchUrth(): Promise<Array<[string, number]>> {
  const errors: string[] = [];
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/URTH?period1=1325376000&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=div%7Csplit`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(FETCH_MS),
      });
      if (!res.ok) throw new Error(`Yahoo ${host}: HTTP ${res.status}`);
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: {
              adjclose?: Array<{ adjclose?: (number | null)[] }>;
              quote?: Array<{ close?: (number | null)[] }>;
            };
          }>;
        };
      };
      const r = json.chart?.result?.[0];
      const ts = r?.timestamp ?? [];
      const adj = r?.indicators?.adjclose?.[0]?.adjclose ?? r?.indicators?.quote?.[0]?.close ?? [];
      const out: Array<[string, number]> = [];
      const seen = new Set<string>();
      for (let i = 0; i < ts.length; i++) {
        const v = adj[i];
        if (v == null || !Number.isFinite(v) || v <= 0) continue;
        const d = new Date(ts[i]! * 1000).toISOString().slice(0, 10);
        if (seen.has(d)) continue;
        seen.add(d);
        out.push([d, Math.round(v * 100) / 100]);
      }
      if (out.length < 1000) throw new Error(`Yahoo ${host}: short history (${out.length})`);
      return out;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Yahoo ${host} failed`);
    }
  }
  throw new Error(errors.join("; "));
}

function parseFredCsv(text: string): Array<[string, number]> {
  const t = text.trimStart();
  if (t.startsWith("<")) throw new Error("FRED VIX CSV: HTML page");
  const out: Array<[string, number]> = [];
  for (const line of t.split(/\r?\n/).slice(1)) {
    const [d, v] = line.trim().split(",");
    if (!d || !v || v === ".") continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out.push([d, n]);
  }
  if (out.length < 1000) throw new Error("FRED VIX CSV: too short");
  return out;
}

async function fetchVix(): Promise<Array<[string, number]>> {
  const errors: string[] = [];
  const key = process.env.FRED_API_KEY?.trim();
  if (key) {
    try {
      const res = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${encodeURIComponent(key)}&file_type=json`,
        { next: { revalidate: 3600 }, signal: AbortSignal.timeout(FETCH_MS) },
      );
      if (!res.ok) throw new Error(`FRED API VIX: HTTP ${res.status}`);
      const json = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
      const out: Array<[string, number]> = [];
      for (const o of json.observations ?? []) {
        const n = Number(o.value);
        if (o.value !== "." && Number.isFinite(n) && n > 0) out.push([o.date, n]);
      }
      if (out.length > 1000) return out;
      throw new Error("FRED API VIX: too short");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "FRED API VIX failed");
    }
  }
  try {
    const res = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS", {
      headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!res.ok) throw new Error(`FRED VIX CSV: HTTP ${res.status}`);
    return parseFredCsv(await res.text());
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "FRED VIX CSV failed");
    throw new Error(errors.join("; "));
  }
}

function upperBound(dates: string[], d: string): number {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid]! <= d) lo = mid + 1;
    else hi = mid;
  }
  return lo; // first index with date > d
}

function minus5y(d: string): string {
  return `${String(Number(d.slice(0, 4)) - 5).padStart(4, "0")}${d.slice(4)}`;
}

/** Join URTH days with the latest VIX close (≤5 days old) and its 5-year percentile. */
function joinRows(urth: Array<[string, number]>, vix: Array<[string, number]>): EqRow[] {
  const vd = vix.map((v) => v[0]);
  const vv = vix.map((v) => v[1]);
  return urth.map(([d, px]) => {
    const j = upperBound(vd, d) - 1;
    if (j < 0) return [d, px, null, null];
    const gapDays = (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${vd[j]}T00:00:00Z`)) / 86400000;
    if (gapDays > 5) return [d, px, null, null];
    const v = vv[j]!;
    const lo = upperBound(vd, minus5y(vd[j]!));
    let le = 0;
    for (let k = lo; k <= j; k++) if (vv[k]! <= v) le++;
    const pct = Math.round((1000 * le) / (j - lo + 1)) / 10;
    return [d, px, v, pct];
  });
}

function respond(body: EqPayload, sMaxAge: number) {
  return Response.json(body, {
    headers: { "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400` },
  });
}

export async function GET() {
  const warnings: string[] = [];
  let urth: Array<[string, number]> | null = null;
  let vix: Array<[string, number]> | null = null;
  try {
    urth = await fetchUrth();
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "URTH failed");
  }
  try {
    vix = await fetchVix();
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "VIX failed");
  }

  if (urth) {
    let rows: EqRow[];
    let vixAsOf: string | null;
    if (vix) {
      rows = joinRows(urth, vix);
      vixAsOf = vix[vix.length - 1]![0];
    } else {
      // Live price, VIX from the dated snapshot where available (never invented).
      const snapVix = new Map(SNAP.rows.map((r) => [r[0], r] as const));
      rows = urth.map(([d, px]) => {
        const s = snapVix.get(d);
        return [d, px, s ? s[2] : null, s ? s[3] : null];
      });
      vixAsOf = SNAP.vixAsOf;
      warnings.push("VIX from dated snapshot");
    }
    const payload: EqPayload = {
      ok: true,
      rows,
      asOf: rows[rows.length - 1]![0],
      vixAsOf,
      origin: vix ? "Live (Yahoo URTH + FRED VIXCLS)" : "Live URTH + snapshot VIX",
      snapshot: false,
      priceSource: PRICE_SOURCE,
      vixSource: VIX_SOURCE,
      warnings: warnings.length ? warnings : undefined,
    };
    lastGood = payload;
    return respond(payload, 1800);
  }

  if (lastGood) {
    return respond(
      { ...lastGood, origin: `${lastGood.origin} · last-good cache`, warnings },
      300,
    );
  }

  return respond(
    {
      ok: true,
      rows: SNAP.rows,
      asOf: SNAP.asOf,
      vixAsOf: SNAP.vixAsOf,
      origin: `Dated snapshot through ${SNAP.asOf}`,
      snapshot: true,
      priceSource: PRICE_SOURCE,
      vixSource: VIX_SOURCE,
      warnings: [...warnings, "Live feeds unreachable; serving dated snapshot"],
    },
    300,
  );
}
