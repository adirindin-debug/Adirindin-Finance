/**
 * Same-origin data for /tools/risk-sentiment (Market sentiment gauge, v2).
 *
 * Score inputs — all publicly available and displayable with credit:
 *  - OFR Financial Stress Index (overall + volatility, equity valuation, credit
 *    categories) — daily CSV from the Office of Financial Research (US Treasury)
 *  - Chicago Fed NFCI and St. Louis Fed STLFSI4 — weekly, FRED CSV (API if FRED_API_KEY)
 *  - Crypto Fear & Greed — Alternative.me public API (attribution beside the data)
 *  - Seasonality — derived from the stored S&P 500 month-end dataset
 *  - Global breadth — 17 OECD country share-price indices via FRED (monthly),
 *    with a bundled stored copy if fewer than 10 countries load
 * Base chart overlay only (never feeds the score): S&P 500 / Nasdaq / URTH daily
 * closes from Yahoo Finance's chart API — see the page note on display terms.
 * A failed source is reported and dropped, never invented. Educational only.
 */

import seasonSnapshot from "@/data/seasonality-snapshot.json";
import type { MonthClose } from "@/lib/seasonality";
import breadthSnapshot from "@/data/breadth-oecd-snapshot.json";
import { computeMs, type OfrCols } from "@/lib/marketSentimentCompute";
import {
  BREADTH_COUNTRIES,
  BREADTH_MIN_COUNTRIES,
  INPUTS,
  alignStep,
  breadthMonths,
  summarize,
  type MsPayload,
  type MsRow,
  type Series,
  type SourceStatus,
} from "@/lib/marketSentiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FETCH_MS = 15_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FRED_UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
/** Overlay history start. */
const EQ_FROM = Date.UTC(2004, 0, 1) / 1000;
const URTH_FROM = 1325376000;
/** First date the score is shown (5 years of OFR history before it for ranking). */
const DISPLAY_FROM = "2005-01-03";
/** Daily rows for the last ~10 years; weekly (Fridays) before that to keep the payload small. */
const DAILY_YEARS = 10;

const SPX_MONTHS = ((seasonSnapshot as unknown as { spx?: { months?: MonthClose[] } }).spx?.months ?? null) as
  | MonthClose[]
  | null;

let lastGood: { at: number; body: MsPayload } | null = null;
const MEMO_MS = 30 * 60 * 1000;

async function fetchYahooDaily(symbol: string, minRows = 4000): Promise<Series> {
  const errors: string[] = [];
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${EQ_FROM}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
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
      if (out.length < minRows) throw new Error(`Yahoo ${host}: short history (${out.length})`);
      return out;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Yahoo ${host} failed`);
    }
  }
  throw new Error(errors.join("; "));
}

/** URTH adjusted close — same pattern as /api/global-equities (dividends reinvested). */
async function fetchUrth(): Promise<Series> {
  const errors: string[] = [];
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/URTH?period1=${URTH_FROM}&period2=${Math.floor(Date.now() / 1000)}&interval=1d&events=div%7Csplit`;
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
      const out: Series = [];
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

const fetchSpx = () => fetchYahooDaily("^GSPC");
/** Nasdaq Composite — base chart overlay only (never feeds the score). */
const fetchIxic = () => fetchYahooDaily("^IXIC");

/** OFR FSI daily CSV: Date, OFR FSI, Credit, Equity valuation, Safe assets, Funding, Volatility, … */
async function fetchOfr(): Promise<OfrCols> {
  const res = await fetch("https://www.financialresearch.gov/financial-stress-index/data/fsi.csv", {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`OFR FSI: HTTP ${res.status}`);
  const text = (await res.text()).trimStart();
  if (text.startsWith("<")) throw new Error("OFR FSI: HTML page");
  const lines = text.split(/\r?\n/);
  const head = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const ci = { ofr: col("ofr fsi"), ofrCredit: col("credit"), ofrEq: col("equity valuation"), ofrVol: col("volatility") };
  if (Object.values(ci).some((i) => i < 0)) throw new Error("OFR FSI: unexpected columns");
  const out: OfrCols = { ofr: [], ofrVol: [], ofrEq: [], ofrCredit: [] };
  for (const line of lines.slice(1)) {
    const c = line.split(",");
    const d = c[0]?.trim();
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    for (const k of Object.keys(ci) as Array<keyof OfrCols>) {
      const n = Number(c[ci[k]]);
      if (c[ci[k]] !== "" && Number.isFinite(n)) out[k].push([d, n]);
    }
  }
  if (out.ofr.length < 4000) throw new Error("OFR FSI: short history");
  return out;
}

/** FRED series — API when FRED_API_KEY is set, else the public CSV. Cached ~1 h. */
async function fetchFred(id: string, minRows: number): Promise<Series> {
  const key = process.env.FRED_API_KEY?.trim();
  if (key) {
    try {
      const res = await fetch(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${encodeURIComponent(key)}&file_type=json`,
        { headers: { "User-Agent": FRED_UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(FETCH_MS) },
      );
      if (res.ok) {
        const json = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
        const out: Series = [];
        for (const o of json.observations ?? []) {
          const n = Number(o.value);
          if (o.value !== "." && o.value !== "" && Number.isFinite(n)) out.push([o.date, n]);
        }
        if (out.length >= minRows) return out;
      }
    } catch {
      /* fall through to CSV */
    }
  }
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, {
    headers: { "User-Agent": FRED_UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`FRED ${id}: HTTP ${res.status}`);
  const text = (await res.text()).trimStart();
  if (text.startsWith("<")) throw new Error(`FRED ${id}: HTML page`);
  const out: Series = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [d, v] = line.trim().split(",");
    const n = Number(v);
    if (d && v && v !== "." && Number.isFinite(n)) out.push([d, n]);
  }
  if (out.length < minRows) throw new Error(`FRED ${id}: too short`);
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

type BreadthResult = { months: Array<[string, number, number]>; stored: boolean; countries: number };
const BREADTH_SNAP = breadthSnapshot as unknown as { asOf: string; months: Array<[string, number, number]> };

/** Breadth from the 17 OECD country indices on FRED; the stored copy if too few load. */
async function fetchBreadth(): Promise<BreadthResult> {
  const got = await Promise.all(
    BREADTH_COUNTRIES.map((c) => fetchFred(`SPASTT01${c.code}M661N`, 300).then((s) => [c.code, s] as const).catch(() => null)),
  );
  const ok = got.filter((g): g is readonly [string, Series] => g != null);
  if (ok.length >= BREADTH_MIN_COUNTRIES) {
    const months = breadthMonths(Object.fromEntries(ok));
    if (months.length > 100) return { months, stored: false, countries: ok.length };
  }
  return { months: BREADTH_SNAP.months, stored: true, countries: 0 };
}

async function attempt<T>(label: string, key: string, fn: () => Promise<T>, warnings: string[]) {
  try {
    return { value: await fn(), ok: true as const, key, label };
  } catch (e) {
    warnings.push(`${label}: ${e instanceof Error ? e.message : "failed"}`);
    return { value: null, ok: false as const, key, label };
  }
}

const flip = (s: Series): Series => s.map(([d, v]) => [d, Math.round((100 - v) * 10) / 10]);
const lastDate = (s: Series | null) => (s?.length ? s[s.length - 1]![0] : null);

function respond(body: MsPayload, sMaxAge: number, summary: boolean) {
  return Response.json(summary ? summarize(body) : body, {
    headers: { "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400` },
  });
}

export async function GET(req: Request) {
  const summary = new URL(req.url).searchParams.get("summary") === "1";
  if (lastGood && Date.now() - lastGood.at < MEMO_MS) return respond(lastGood.body, 1800, summary);

  const warnings: string[] = [];
  const [ofr, nfci, stl, cfg, br, spx, ixic, urth] = await Promise.all([
    attempt("OFR Financial Stress Index", "ofr", fetchOfr, warnings),
    attempt("Chicago Fed NFCI (FRED)", "nfci", () => fetchFred("NFCI", 1500), warnings),
    attempt("St. Louis Fed STLFSI4 (FRED)", "stlfsi", () => fetchFred("STLFSI4", 1000), warnings),
    attempt("Crypto Fear & Greed (Alternative.me)", "cryptoFng", fetchCryptoFng, warnings),
    attempt("Global breadth (OECD via FRED)", "breadth", fetchBreadth, warnings),
    // Base chart only — not part of the score.
    summary ? Promise.resolve({ value: null, ok: false as const, key: "spx", label: "S&P 500" }) : attempt("S&P 500 base chart (Yahoo Finance)", "spx", fetchSpx, warnings),
    summary ? Promise.resolve({ value: null, ok: false as const, key: "ixic", label: "Nasdaq" }) : attempt("Nasdaq Composite base chart (Yahoo Finance)", "ixic", fetchIxic, warnings),
    summary ? Promise.resolve({ value: null, ok: false as const, key: "urth", label: "URTH" }) : attempt("URTH base chart (Yahoo Finance)", "urth", fetchUrth, warnings),
  ]);

  const c = computeMs({
    ofr: ofr.value,
    nfci: nfci.value,
    stlfsi: stl.value,
    cryptoFng: cfg.value,
    breadth: br.value?.months ?? null,
    spxMonths: SPX_MONTHS,
  });
  const { dates, subs, raw, e10, e42, flags, watch, season } = c;

  if (!raw.some((v) => v != null)) {
    return respond(
      { ok: false, rows: [], asOf: null, sources: [], warnings, error: "Not enough source data for a score", generated: new Date().toISOString() },
      60,
      summary,
    );
  }

  // Keep display window; daily for the last DAILY_YEARS, Fridays before.
  const dailyFrom = new Date(Date.now() - DAILY_YEARS * 365.25 * 86_400_000).toISOString().slice(0, 10);
  const keep: number[] = [];
  dates.forEach((d, i) => {
    if (d < DISPLAY_FROM || raw[i] == null) return;
    if (d >= dailyFrom || new Date(`${d}T00:00:00Z`).getUTCDay() === 5) keep.push(i);
  });
  const rows: MsRow[] = keep.map((i) => [dates[i]!, raw[i]!, e10[i]!, e42[i]!, ...INPUTS.map((_, k) => {
    const v = subs[k]![i];
    return v == null ? null : Math.round(v * 10) / 10;
  }), flags[i]!, watch[i]!]);
  const keptDates = keep.map((i) => dates[i]!);
  const overlay = summary
    ? undefined
    : {
        spx: spx.value ? alignStep(keptDates, spx.value, 5) : undefined,
        ixic: ixic.value ? alignStep(keptDates, ixic.value, 5) : undefined,
        urth: urth.value ? alignStep(keptDates, urth.value, 5) : undefined,
      };
  const curMonth = keptDates[keptDates.length - 1]?.slice(0, 7);
  const st = curMonth ? season.get(curMonth) : null;

  const sources: SourceStatus[] = [
    { key: "ofr", label: ofr.label, ok: ofr.ok, asOf: lastDate(ofr.value?.ofr ?? null) },
    { key: "nfci", label: nfci.label, ok: nfci.ok, asOf: lastDate(nfci.value) },
    { key: "stlfsi", label: stl.label, ok: stl.ok, asOf: lastDate(stl.value) },
    { key: "cryptoFng", label: cfg.label, ok: cfg.ok, asOf: lastDate(cfg.value) },
    {
      key: "breadth",
      label: br.value?.stored ? "Global breadth (OECD via FRED) · stored copy" : "Global breadth (OECD via FRED)",
      ok: !!br.value && !br.value.stored,
      asOf: br.value?.months.length ? br.value.months[br.value.months.length - 1]![0] : null,
      note: br.value?.stored ? `Stored copy to ${BREADTH_SNAP.asOf}` : br.value ? `${br.value.countries} countries` : undefined,
    },
    { key: "season", label: "Seasonality (stored S&P 500 month-ends)", ok: !!SPX_MONTHS?.length, asOf: SPX_MONTHS?.[SPX_MONTHS.length - 1]?.[0] ?? null },
  ];
  const body: MsPayload = {
    ok: true,
    rows,
    overlay,
    season: st ? { month: curMonth!, score: st.score, avg: st.avg, baseAvg: st.baseAvg, n: st.n } : null,
    asOf: keptDates[keptDates.length - 1] ?? null,
    sources,
    warnings: warnings.length ? warnings : undefined,
    generated: new Date().toISOString(),
  };
  if (!warnings.length && !summary) lastGood = { at: Date.now(), body };
  return respond(body, warnings.length ? 300 : 1800, summary);
}
