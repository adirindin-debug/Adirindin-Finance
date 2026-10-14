/**
 * Same-origin data for /charts/global-equities (World equities drawdown).
 *
 * Price: iShares MSCI World ETF (URTH) daily adjusted close from the Yahoo
 * Finance chart API (same public feed used elsewhere on this site), as a
 * labelled PROXY for MSCI World. MSCI index data itself is licensed and not used.
 * Volatility tilt: OFR Financial Stress Index volatility category (US Government
 * work), plus each day's percentile against its prior 5 years.
 *
 * Order: Yahoo query1 → query2 for URTH; OFR FSI CSV for volatility; then last-good in-memory cache; then the dated snapshot in
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
/** FRED: identify honestly (browser-like UAs from datacentre IPs get tarpitted). */
const FRED_UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const PRICE_SOURCE =
  "iShares MSCI World ETF (URTH, NYSE Arca) adjusted close via Yahoo Finance — proxy for MSCI World";
const VIX_SOURCE = "Office of Financial Research, OFR Financial Stress Index (volatility category)";

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

/** OFR Financial Stress Index — volatility category (daily; US Government work, free to reuse). */
async function fetchOfrVol(): Promise<Array<[string, number]>> {
  const res = await fetch("https://www.financialresearch.gov/financial-stress-index/data/fsi.csv", {
    headers: { "User-Agent": FRED_UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`OFR FSI: HTTP ${res.status}`);
  const text = (await res.text()).trimStart();
  if (text.startsWith("<")) throw new Error("OFR FSI: HTML page");
  const lines = text.split(/\r?\n/);
  const head = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const vi = head.indexOf("volatility");
  if (vi < 0) throw new Error("OFR FSI: no volatility column");
  const out: Array<[string, number]> = [];
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const d = c[0]?.trim();
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || c[vi] === "" || c[vi] == null) continue;
    const n = Number(c[vi]);
    if (Number.isFinite(n)) out.push([d, n]);
  }
  if (out.length < 1000) throw new Error("OFR FSI: short history");
  out.sort((x, y) => (x[0] < y[0] ? -1 : 1));
  return out;
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

/** Join URTH days with the latest OFR volatility reading (≤5 days old) and its 5-year percentile. */
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
    vix = await fetchOfrVol();
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : "OFR volatility failed");
  }

  if (urth) {
    let rows: EqRow[];
    let vixAsOf: string | null;
    if (vix) {
      rows = joinRows(urth, vix);
      vixAsOf = vix[vix.length - 1]![0];
    } else {
      // No volatility tilt when the OFR feed is unavailable (never invented).
      rows = urth.map(([d, px]) => [d, px, null, null]);
      vixAsOf = null;
    }
    const payload: EqPayload = {
      ok: true,
      rows,
      asOf: rows[rows.length - 1]![0],
      vixAsOf,
      origin: vix ? "Live (Yahoo URTH + OFR FSI volatility)" : "Live URTH (volatility unavailable)",
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
      rows: SNAP.rows.map(([d, px]) => [d, px, null, null] as EqRow),
      asOf: SNAP.asOf,
      vixAsOf: null,
      origin: `Dated snapshot through ${SNAP.asOf}`,
      snapshot: true,
      priceSource: PRICE_SOURCE,
      vixSource: VIX_SOURCE,
      warnings: [...warnings, "Live feeds unreachable; serving dated snapshot"],
    },
    300,
  );
}
