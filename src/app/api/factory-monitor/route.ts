/**
 * Same-origin Philly Fed Manufacturing series for /charts/factory-monitor.
 * Federal Reserve Bank of Philadelphia, Manufacturing Business Outlook Survey,
 * Current General Activity diffusion index (SA, monthly), via FRED
 * (GACDFSA066MSFRBPHI; FRED label "Copyrighted: Citation required").
 *
 * Order: FRED API (if FRED_API_KEY) → FRED CSV → last-good in-memory cache →
 * bundled dated snapshot (src/lib/phillyFedSnapshot.ts), so the page is never
 * empty. Months are never invented. NOT the ISM Manufacturing PMI. NFA.
 */

import {
  FACTORY_SERIES_ID,
  type FactoryPayload,
  type FactoryPoint,
} from "@/lib/factoryMonitor";
import {
  PHILLY_SNAPSHOT_AS_OF,
  PHILLY_SNAPSHOT_START,
  PHILLY_SNAPSHOT_VALUES,
} from "@/lib/phillyFedSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FETCH_MS = 12_000;
const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const SOURCE =
  "Federal Reserve Bank of Philadelphia, Manufacturing Business Outlook Survey, via FRED (GACDFSA066MSFRBPHI)";

let lastGood: FactoryPayload | null = null;

function isMonthKey(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s);
}

/** Sort, de-dupe and sanity-check monthly points. */
function clean(points: FactoryPoint[]): FactoryPoint[] {
  const byMonth = new Map<string, number>();
  for (const p of points) {
    if (!isMonthKey(p.m) || !Number.isFinite(p.v)) continue;
    if (p.v < -100 || p.v > 100) continue; // diffusion index bounds
    byMonth.set(p.m, p.v);
  }
  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([m, v]) => ({ m, v }));
}

function parseCsv(text: string): FactoryPoint[] {
  const head = text.trimStart();
  if (head.startsWith("<")) throw new Error("FRED CSV: HTML page, not CSV");
  const lines = head.split(/\r?\n/);
  if (!lines[0]?.toLowerCase().includes("date")) {
    throw new Error("FRED CSV: unexpected header");
  }
  const out: FactoryPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [d, val] = lines[i]!.trim().split(",");
    if (!d || val == null || val === "." || val === "") continue;
    const v = Number(val);
    if (!Number.isFinite(v)) continue;
    out.push({ m: d.slice(0, 7), v });
  }
  return out;
}

async function fromFredCsv(): Promise<FactoryPoint[]> {
  const res = await fetch(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${FACTORY_SERIES_ID}`,
    {
      headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(FETCH_MS),
    },
  );
  if (!res.ok) throw new Error(`FRED CSV: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

async function fromFredApi(apiKey: string): Promise<FactoryPoint[]> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${FACTORY_SERIES_ID}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 21600 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  if (!res.ok) throw new Error(`FRED API: HTTP ${res.status}`);
  const json = (await res.json()) as {
    observations?: Array<{ date: string; value: string }>;
  };
  const out: FactoryPoint[] = [];
  for (const o of json.observations ?? []) {
    if (o.value === "." || o.value === "") continue;
    const v = Number(o.value);
    if (!Number.isFinite(v)) continue;
    out.push({ m: o.date.slice(0, 7), v });
  }
  return out;
}

function fromSnapshot(): FactoryPoint[] {
  const [y0, m0] = PHILLY_SNAPSHOT_START.split("-").map(Number) as [
    number,
    number,
  ];
  return PHILLY_SNAPSHOT_VALUES.map((v, i) => {
    const k = m0 - 1 + i;
    const y = y0 + Math.floor(k / 12);
    const m = (k % 12) + 1;
    return { m: `${y}-${String(m).padStart(2, "0")}`, v };
  });
}

function json(body: FactoryPayload, sMaxAge: number) {
  return Response.json(body, {
    headers: {
      "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400`,
    },
  });
}

export async function GET() {
  const warnings: string[] = [];
  const apiKey = process.env.FRED_API_KEY?.trim();

  const attempts: Array<[string, () => Promise<FactoryPoint[]>]> = [];
  if (apiKey) attempts.push(["FRED API", () => fromFredApi(apiKey)]);
  attempts.push(["FRED CSV", fromFredCsv]);

  for (const [label, run] of attempts) {
    try {
      const points = clean(await run());
      if (points.length < 120) throw new Error(`${label}: too few months`);
      const payload: FactoryPayload = {
        ok: true,
        seriesId: FACTORY_SERIES_ID,
        points,
        asOf: points[points.length - 1]!.m,
        origin: `${label} (live)`,
        snapshot: false,
        source: SOURCE,
        warnings: warnings.length ? warnings : undefined,
      };
      lastGood = payload;
      return json(payload, 3600);
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : `${label} failed`);
    }
  }

  if (lastGood) {
    return json(
      {
        ...lastGood,
        origin: `${lastGood.origin ?? "FRED"} · last-good cache`,
        warnings: [...warnings, "Serving last-good cache; FRED unreachable"],
      },
      300,
    );
  }

  const points = fromSnapshot();
  return json(
    {
      ok: true,
      seriesId: FACTORY_SERIES_ID,
      points,
      asOf: PHILLY_SNAPSHOT_AS_OF,
      origin: `Bundled snapshot through ${PHILLY_SNAPSHOT_AS_OF}`,
      snapshot: true,
      source: SOURCE,
      warnings: [...warnings, "FRED unreachable; serving dated snapshot"],
    },
    300,
  );
}
