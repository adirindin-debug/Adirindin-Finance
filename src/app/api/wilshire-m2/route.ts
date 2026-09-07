/**
 * Wilshire 5000 / US M2 ratio from public FRED (CSV; optional FRED_API_KEY).
 * Wilshire fallback: Yahoo Finance ^W5000 when FRED series blocked.
 * Concept similar to MacroMicro Wilshire/M2 — we do not scrape MacroMicro.
 * Educational only — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Obs = { t: number; v: number }; // unix sec, value
type RatioPoint = { t: number; ratio: number; wilshire: number; m2: number };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
    if (!Number.isFinite(v)) continue;
    const t = Date.parse(`${dateStr.trim()}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) {
    throw new Error(`FRED ${seriesId}: no numeric observations in CSV`);
  }
  return out;
}

async function fetchFredCsv(seriesId: string): Promise<Obs[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(20000),
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
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`FRED API ${seriesId}: HTTP ${res.status}`);
  const json = (await res.json()) as {
    observations?: Array<{ date: string; value: string }>;
  };
  const out: Obs[] = [];
  for (const o of json.observations ?? []) {
    if (o.value === "." || o.value === "") continue;
    const v = Number(o.value);
    if (!Number.isFinite(v)) continue;
    const t = Date.parse(`${o.date}T00:00:00Z`);
    if (!Number.isFinite(t)) continue;
    out.push({ t: Math.floor(t / 1000), v });
  }
  if (!out.length) throw new Error(`FRED API ${seriesId}: empty`);
  return out;
}

async function fetchSeries(seriesId: string, apiKey: string | undefined): Promise<Obs[]> {
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
    signal: AbortSignal.timeout(20000),
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
    out.push({ t: ts[i], v: c });
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
  const apiKey = process.env.FRED_API_KEY?.trim() || undefined;
  const errors: string[] = [];
  let m2: Obs[] | null = null;
  let wilshire: Obs[] | null = null;
  let wilshireSource = "";
  let m2Source = "";

  try {
    m2 = await fetchSeries("M2SL", apiKey);
    m2Source = apiKey
      ? "FRED API M2SL (monthly, SA, billions USD)"
      : "FRED CSV M2SL (monthly, SA, billions USD)";
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "M2SL failed");
  }

  for (const id of ["WILL5000PR", "WILL5000IND"] as const) {
    try {
      wilshire = await fetchSeries(id, apiKey);
      wilshireSource = apiKey
        ? `FRED API ${id}`
        : `FRED CSV ${id}`;
      break;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `${id} failed`);
    }
  }

  if (!wilshire) {
    try {
      wilshire = await fetchYahooWilshireMonthly();
      wilshireSource = "Yahoo Finance ^W5000 (monthly) — Wilshire 5000 fallback";
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Yahoo Wilshire failed");
    }
  }

  if (!m2 || !wilshire) {
    return Response.json(
      {
        ok: false,
        error: "Could not load Wilshire and/or M2",
        errors,
      },
      { status: 502 },
    );
  }

  const ratio = buildRatio(wilshire, m2);
  if (ratio.length < 2) {
    return Response.json(
      {
        ok: false,
        error: "Insufficient overlapping Wilshire/M2 months",
        errors,
      },
      { status: 502 },
    );
  }

  const points = downsample(ratio, 500);
  const latest = points[points.length - 1];

  return Response.json(
    {
      ok: true,
      current: {
        ratio: latest.ratio,
        wilshire: latest.wilshire,
        m2: latest.m2,
        t: latest.t,
      },
      points,
      wilshireSource,
      m2Source,
      ratioDefinition:
        "Ratio = Wilshire 5000 index level ÷ M2SL (FRED, billions USD, seasonally adjusted). Monthly alignment: last Wilshire observation in each M2 month.",
      fredCredits: "Data via FRED®, Federal Reserve Bank of St. Louis.",
      macroMicroUrl:
        "https://en.macromicro.me/collections/34/us-stock-relative/24033/wilshire5000-to-us-m2",
      note: "Educational valuation framing (concept similar to MacroMicro Wilshire/M2). Not a forecast or financial advice (NFA).",
      errors: errors.length ? errors : undefined,
      asOf: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=43200",
      },
    },
  );
}
