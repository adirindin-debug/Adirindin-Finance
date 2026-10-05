/**
 * Same-origin data for /tools/risk-sentiment (Market risk & sentiment gauge · PREVIEW).
 *
 * Live public feeds, each falling back on its own to the dated snapshot in
 * src/data/risk-sentiment-snapshot.json (refresh: scripts/build-risk-sentiment-snapshot.mjs):
 *  - S&P 500 (^GSPC) daily close — Yahoo Finance chart API (query1 → query2)
 *  - VIX close — FRED VIXCLS (API if FRED_API_KEY, else CSV)
 *  - US stocks Fear & Greed — FearGreedChart.com public API (independent, not CNN)
 *  - Crypto Fear & Greed — Alternative.me public API
 *  - Google Trends "bitcoin" monthly — snapshot only (unofficial endpoint; never
 *    scraped from production)
 * A failed source is reported, never invented. Educational only · NFA.
 */

import snapshot from "@/data/risk-sentiment-snapshot.json";
import {
  computeRows,
  thinRows,
  type RawInputs,
  type RsPayload,
  type Series,
  type SourceStatus,
} from "@/lib/riskSentiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FRED_UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const SPX_FROM = Date.UTC(1985, 0, 1) / 1000;

type SnapBlock = { asOf: string; source: string; note?: string; rows: Series };
type Snap = {
  fetched: string;
  spx?: SnapBlock;
  vix?: SnapBlock;
  usFng?: SnapBlock;
  cryptoFng?: SnapBlock;
  trendsBitcoin?: SnapBlock;
};
const SNAP = snapshot as unknown as Snap;

let lastGood: { at: number; body: RsPayload } | null = null;
const MEMO_MS = 30 * 60 * 1000;

async function fetchSpx(): Promise<Series> {
  const errors: string[] = [];
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${SPX_FROM}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(FETCH_MS),
      });
      if (!res.ok) throw new Error(`Yahoo ${host}: HTTP ${res.status}`);
      const json = (await res.json()) as {
        chart?: {
          result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }>;
        };
      };
      const r = json.chart?.result?.[0];
      const ts = r?.timestamp ?? [];
      const close = r?.indicators?.quote?.[0]?.close ?? [];
      const out: Series = [];
      const seen = new Set<string>();
      for (let i = 0; i < ts.length; i++) {
        const v = close[i];
        if (v == null || !Number.isFinite(v) || v <= 0) continue;
        const d = new Date(ts[i]! * 1000).toISOString().slice(0, 10);
        if (seen.has(d)) continue;
        seen.add(d);
        out.push([d, Math.round(v * 100) / 100]);
      }
      if (out.length < 9000) throw new Error(`Yahoo ${host}: short history (${out.length})`);
      return out;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Yahoo ${host} failed`);
    }
  }
  throw new Error(errors.join("; "));
}

async function fetchVix(): Promise<Series> {
  const key = process.env.FRED_API_KEY?.trim();
  const errors: string[] = [];
  if (key) {
    try {
      const res = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${encodeURIComponent(key)}&file_type=json`,
        { headers: { "User-Agent": FRED_UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(FETCH_MS) },
      );
      if (!res.ok) throw new Error(`FRED API VIX: HTTP ${res.status}`);
      const json = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
      const out: Series = [];
      for (const o of json.observations ?? []) {
        const n = Number(o.value);
        if (o.value !== "." && Number.isFinite(n) && n > 0) out.push([o.date, n]);
      }
      if (out.length > 8000) return out;
      throw new Error("FRED API VIX: too short");
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "FRED API VIX failed");
    }
  }
  try {
    const res = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS", {
      headers: { "User-Agent": FRED_UA, Accept: "text/csv,text/plain,*/*" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!res.ok) throw new Error(`FRED VIX CSV: HTTP ${res.status}`);
    const text = (await res.text()).trimStart();
    if (text.startsWith("<")) throw new Error("FRED VIX CSV: HTML page");
    const out: Series = [];
    for (const line of text.split(/\r?\n/).slice(1)) {
      const [d, v] = line.trim().split(",");
      const n = Number(v);
      if (d && v && v !== "." && Number.isFinite(n) && n > 0) out.push([d, n]);
    }
    if (out.length < 8000) throw new Error("FRED VIX CSV: too short");
    return out;
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "FRED VIX CSV failed");
    throw new Error(errors.join("; "));
  }
}

async function fetchUsFng(): Promise<Series> {
  const res = await fetch("https://feargreedchart.com/api/?action=history", {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`FearGreedChart HTTP ${res.status}`);
  const json = (await res.json()) as Array<{ date?: string; score?: number }>;
  const out: Series = [];
  for (const r of Array.isArray(json) ? json : []) {
    const v = Number(r.score);
    if (typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(v)) {
      out.push([r.date, v]);
    }
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (out.length < 1000) throw new Error("FearGreedChart: short history");
  return out;
}

async function fetchCryptoFng(): Promise<Series> {
  const res = await fetch("https://api.alternative.me/fng/?limit=0", {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`Alternative.me HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ value: string; timestamp: string }> };
  const out: Series = [];
  for (const r of json.data ?? []) {
    const v = Number(r.value);
    const t = Number(r.timestamp);
    if (Number.isFinite(v) && Number.isFinite(t)) out.push([new Date(t * 1000).toISOString().slice(0, 10), v]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (out.length < 1000) throw new Error("Alternative.me: short history");
  return out;
}

async function withFallback(
  key: string,
  label: string,
  live: () => Promise<Series>,
  snap: SnapBlock | undefined,
  warnings: string[],
): Promise<{ series: Series | null; status: SourceStatus }> {
  try {
    const series = await live();
    return {
      series,
      status: { key, label, origin: "live", from: series[0]![0], asOf: series[series.length - 1]![0] },
    };
  } catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : "failed"}`);
    if (snap?.rows?.length) {
      return {
        series: snap.rows,
        status: {
          key,
          label,
          origin: "snapshot",
          from: snap.rows[0]![0],
          asOf: snap.asOf,
          note: "Live feed failed — dated snapshot",
        },
      };
    }
    return { series: null, status: { key, label, origin: "missing", from: null, asOf: null, note: "Pending — feed unavailable" } };
  }
}

function respond(body: RsPayload, sMaxAge: number) {
  return Response.json(body, {
    headers: { "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400` },
  });
}

export async function GET() {
  if (lastGood && Date.now() - lastGood.at < MEMO_MS) return respond(lastGood.body, 1800);

  const warnings: string[] = [];
  const [spx, vix, usFng, cryptoFng] = await Promise.all([
    withFallback("spx", "S&P 500 (^GSPC)", fetchSpx, SNAP.spx, warnings),
    withFallback("vix", "VIX (FRED VIXCLS)", fetchVix, SNAP.vix, warnings),
    withFallback("usFng", "US stocks Fear & Greed (FearGreedChart.com)", fetchUsFng, SNAP.usFng, warnings),
    withFallback("cryptoFng", "Crypto Fear & Greed (Alternative.me)", fetchCryptoFng, SNAP.cryptoFng, warnings),
  ]);
  const tb = SNAP.trendsBitcoin;
  const trendsStatus: SourceStatus = tb?.rows?.length
    ? {
        key: "trends",
        label: 'Google Trends "bitcoin" (monthly)',
        origin: "snapshot",
        from: tb.rows[0]![0],
        asOf: tb.asOf,
        note: "Dated snapshot by design (unofficial endpoint, refreshed manually)",
      }
    : { key: "trends", label: 'Google Trends "bitcoin" (monthly)', origin: "missing", from: null, asOf: null, note: "Pending" };

  if (!spx.series) {
    return respond(
      {
        ok: false,
        rows: [],
        asOf: null,
        sources: [spx.status, vix.status, usFng.status, cryptoFng.status, trendsStatus],
        warnings,
        error: "S&P 500 history unavailable (live and snapshot)",
        generated: new Date().toISOString(),
      },
      60,
    );
  }

  const inputs: RawInputs = {
    spx: spx.series,
    vix: vix.series,
    usFng: usFng.series,
    cryptoFng: cryptoFng.series,
    trends: tb?.rows ?? null,
  };
  const rows = thinRows(computeRows(inputs));
  const body: RsPayload = {
    ok: true,
    rows,
    asOf: rows.length ? rows[rows.length - 1]![0] : null,
    sources: [spx.status, vix.status, usFng.status, cryptoFng.status, trendsStatus],
    warnings: warnings.length ? warnings : undefined,
    generated: new Date().toISOString(),
  };
  if (!warnings.length) lastGood = { at: Date.now(), body };
  return respond(body, warnings.length ? 300 : 1800);
}
