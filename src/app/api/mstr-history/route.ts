/**
 * Split-adjusted Strategy (MSTR) history for the cycle map overlay.
 * Yahoo first (server-side — browsers block query1), Stooq fallback.
 * Educational — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Pair = [string, number];

function isoDate(ts: number) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function pickClose(
  quoteClose: (number | null | undefined)[] | undefined,
  adjClose: (number | null | undefined)[] | undefined,
  i: number,
): number | null {
  const adj = adjClose?.[i];
  if (adj != null && Number.isFinite(adj) && adj > 0) return adj;
  const c = quoteClose?.[i];
  if (c != null && Number.isFinite(c) && c > 0) return c;
  return null;
}

async function yahoo(interval: "1d" | "1wk"): Promise<{
  rows: Pair[];
  last: number | null;
}> {
  const period2 = Math.floor(Date.now() / 1000);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/MSTR` +
    `?period1=0&period2=${period2}&interval=${interval}` +
    `&events=div%2Csplit&includeAdjustedClose=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Yahoo MSTR ${interval}: HTTP ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        meta?: { regularMarketPrice?: number };
        indicators?: {
          quote?: Array<{ close?: (number | null)[] }>;
          adjclose?: Array<{ adjclose?: (number | null)[] }>;
        };
      }>;
    };
  };
  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error("Yahoo MSTR: no data");
  const quote = result.indicators?.quote?.[0]?.close ?? [];
  const adj = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const rows: Pair[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const c = pickClose(quote, adj, i);
    if (c == null) continue;
    rows.push([isoDate(result.timestamp[i]), Math.round(c * 100) / 100]);
  }
  const spot = result.meta?.regularMarketPrice;
  const last =
    spot != null && Number.isFinite(spot) && spot > 0
      ? Math.round(spot * 100) / 100
      : rows.length
        ? rows[rows.length - 1]![1]
        : null;
  return { rows, last };
}

async function stooq(interval: "d" | "w"): Promise<Pair[]> {
  const url = `https://stooq.com/q/d/l/?s=mstr.us&i=${interval}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/csv" },
    next: { revalidate: 900 },
  });
  if (!res.ok) throw new Error(`Stooq MSTR: HTTP ${res.status}`);
  const text = await res.text();
  const rows: Pair[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line) continue;
    const [date, , , , close] = line.split(",");
    const c = Number(close);
    if (!date || date === "Date" || !Number.isFinite(c) || c <= 0) continue;
    rows.push([date, Math.round(c * 100) / 100]);
  }
  return rows;
}

function since(rows: Pair[], yyyyMmDd: string): Pair[] {
  return rows.filter((r) => r[0] >= yyyyMmDd);
}

function stampLast(rows: Pair[], last: number | null, today: string): Pair[] {
  if (!rows.length || last == null || last <= 0) return rows;
  const out = rows.slice();
  const prev = out[out.length - 1]!;
  if (prev[0] === today) out[out.length - 1] = [today, last];
  else if (prev[0] < today) out.push([today, last]);
  return out;
}

export async function GET() {
  let source = "Yahoo Finance";
  let weekly: Pair[] = [];
  let daily: Pair[] = [];
  let last: number | null = null;
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  try {
    const [w, d] = await Promise.all([yahoo("1wk"), yahoo("1d")]);
    last = d.last ?? w.last;
    weekly = stampLast(since(w.rows, "2016-01-01"), last, today);
    daily = stampLast(since(d.rows, "2024-01-01"), last, today);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Yahoo failed");
    try {
      const [w, d] = await Promise.all([stooq("w"), stooq("d")]);
      weekly = since(w, "2016-01-01");
      daily = since(d, "2024-01-01");
      last = daily.length ? daily[daily.length - 1]![1] : weekly.at(-1)?.[1] ?? null;
      weekly = stampLast(weekly, last, today);
      daily = stampLast(daily, last, today);
      source = "Stooq";
    } catch (e2) {
      errors.push(e2 instanceof Error ? e2.message : "Stooq failed");
    }
  }

  if (!weekly.length && !daily.length) {
    return Response.json(
      { ok: false, error: "Could not load MSTR history", errors },
      { status: 502 },
    );
  }

  return Response.json(
    {
      ok: true,
      ticker: "MSTR",
      name: "Strategy Inc",
      asOf: new Date().toISOString(),
      last,
      weekly,
      daily,
      source,
      note: "Split-adjusted closes (Yahoo adjclose / Stooq). Educational — NFA.",
      errors: errors.length ? errors : undefined,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}
