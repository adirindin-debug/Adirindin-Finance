/**
 * Bitcoin price vs 200-week simple moving average from Coinbase BTC-USD.
 * Daily candles are chunked (Coinbase ~300/call), aggregated to weekly closes,
 * then SMA(200). Soft-fails with a clear error if the feed is unavailable.
 * Educational only — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CB = "https://api.exchange.coinbase.com";
const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindin.finance)";

/** Days of daily history (~11y covers 200W warmup + long chart). */
const DAYS_BACK = 4100;
/** Coinbase candles max ~300 per request; stay under. */
const CHUNK_DAYS = 280;
/** Pause between chunks to ease rate limits. */
const CHUNK_PAUSE_MS = 280;
const MA_WEEKS = 200;
const TIMEOUT_MS = 25_000;
const MAX_RETRIES = 4;

type DailyClose = { t: number; c: number };
type WeeklyClose = { t: number; price: number };
type MaPoint = {
  t: number;
  price: number;
  ma200w: number;
  pctFromMa: number;
  absFromMa: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchCandlesChunk(url: string): Promise<number[][]> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter)
          ? Math.min(Math.max(retryAfter * 1000, 500), 8000)
          : 500 * 2 ** attempt;
        lastErr = new Error("Coinbase HTTP 429");
        await sleep(waitMs);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Coinbase HTTP ${res.status}`);
      }
      const rows = (await res.json()) as number[][];
      if (!Array.isArray(rows)) {
        throw new Error("Coinbase candles: unexpected payload");
      }
      return rows;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr ?? new Error("Coinbase candles failed");
}

/**
 * Coinbase candles: [time, low, high, open, close, volume]; max ~300 per call.
 * Chunked like MarketStrip.tsx, with 429 retries.
 */
async function fetchDailyCloses(daysBack: number): Promise<{
  dailies: DailyClose[];
  chunkErrors: string[];
}> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - daysBack * 86400;
  const out: DailyClose[] = [];
  const chunkErrors: string[] = [];
  let chunks = 0;

  for (let s = start; s < end; s += CHUNK_DAYS * 86400) {
    const e = Math.min(s + CHUNK_DAYS * 86400, end);
    const url =
      `${CB}/products/BTC-USD/candles?granularity=86400` +
      `&start=${new Date(s * 1000).toISOString()}` +
      `&end=${new Date(e * 1000).toISOString()}`;
    try {
      if (chunks > 0) await sleep(CHUNK_PAUSE_MS);
      const rows = await fetchCandlesChunk(url);
      for (const row of rows) {
        const t = row[0];
        const c = row[4];
        if (
          typeof t !== "number" ||
          typeof c !== "number" ||
          !Number.isFinite(t) ||
          !Number.isFinite(c) ||
          c <= 0
        ) {
          continue;
        }
        out.push({ t, c });
      }
      chunks += 1;
    } catch (err) {
      chunkErrors.push(
        `chunk ${chunks}: ${err instanceof Error ? err.message : "failed"}`,
      );
      chunks += 1;
    }
  }

  out.sort((a, b) => a.t - b.t);
  const deduped: DailyClose[] = [];
  for (const d of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.t === d.t) {
      deduped[deduped.length - 1] = d;
    } else {
      deduped.push(d);
    }
  }

  if (deduped.length < MA_WEEKS * 7 * 0.5) {
    throw new Error(
      chunkErrors.length
        ? `Insufficient Coinbase daily history (${deduped.length} days). ${chunkErrors.slice(-3).join("; ")}`
        : `Insufficient Coinbase daily history (${deduped.length} days)`,
    );
  }

  return { dailies: deduped, chunkErrors };
}

/**
 * ISO-week aggregation: week key = UTC year + ISO week number.
 * Weekly close = last daily close in that week (timestamp of that day).
 */
function dailyToWeekly(dailies: DailyClose[]): WeeklyClose[] {
  const byWeek = new Map<string, DailyClose>();
  for (const d of dailies) {
    const key = isoWeekKey(d.t);
    const prev = byWeek.get(key);
    if (!prev || d.t >= prev.t) byWeek.set(key, d);
  }
  const weeks: WeeklyClose[] = [];
  for (const d of byWeek.values()) {
    weeks.push({ t: d.t, price: d.c });
  }
  weeks.sort((a, b) => a.t - b.t);
  return weeks;
}

/** UTC ISO week key YYYY-Www (week starts Monday). */
function isoWeekKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  const thu = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day),
  );
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function buildMaSeries(weeks: WeeklyClose[]): {
  points: MaPoint[];
  firstMaT: number | null;
} {
  const points: MaPoint[] = [];
  let firstMaT: number | null = null;
  for (let i = MA_WEEKS - 1; i < weeks.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - (MA_WEEKS - 1); j <= i; j++) {
      const p = weeks[j]!.price;
      if (!Number.isFinite(p) || p <= 0) {
        ok = false;
        break;
      }
      sum += p;
    }
    if (!ok) continue;
    const w = weeks[i]!;
    const ma = sum / MA_WEEKS;
    const pctFromMa = ((w.price - ma) / ma) * 100;
    const absFromMa = w.price - ma;
    if (firstMaT == null) firstMaT = w.t;
    points.push({
      t: w.t,
      price: w.price,
      ma200w: ma,
      pctFromMa,
      absFromMa,
    });
  }
  return { points, firstMaT };
}

async function fetchSpot(): Promise<number | null> {
  try {
    const res = await fetch(`${CB}/products/BTC-USD/ticker`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ticker = (await res.json()) as { price?: string };
    const p = Number(ticker.price);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { dailies, chunkErrors } = await fetchDailyCloses(DAYS_BACK);
    const weeks = dailyToWeekly(dailies);
    if (weeks.length < MA_WEEKS) {
      return Response.json(
        {
          ok: false,
          error: `Need at least ${MA_WEEKS} weekly closes for the 200-week MA (got ${weeks.length})`,
          errors: chunkErrors.length ? chunkErrors : undefined,
        },
        { status: 502 },
      );
    }

    const { points, firstMaT } = buildMaSeries(weeks);
    if (points.length < 2) {
      return Response.json(
        {
          ok: false,
          error: "Could not compute 200-week MA series",
        },
        { status: 502 },
      );
    }

    const spot = await fetchSpot();
    const latest = points[points.length - 1]!;
    const price = spot ?? latest.price;
    const ma200w = latest.ma200w;
    const pctFromMa = ((price - ma200w) / ma200w) * 100;
    const absFromMa = price - ma200w;

    return Response.json(
      {
        ok: true,
        current: {
          t: latest.t,
          price,
          ma200w,
          pctFromMa,
          absFromMa,
          spotIsLive: spot != null,
        },
        points,
        maWindowWeeks: MA_WEEKS,
        firstMaDate: firstMaT
          ? new Date(firstMaT * 1000).toISOString().slice(0, 10)
          : null,
        historyStart: weeks[0]
          ? new Date(weeks[0].t * 1000).toISOString().slice(0, 10)
          : null,
        weeklyCount: weeks.length,
        dailyCount: dailies.length,
        source:
          "Coinbase Exchange BTC-USD (daily candles → weekly closes → SMA 200)",
        sourceUrl: "https://www.coinbase.com/price/bitcoin",
        note: "200-week simple moving average of weekly closes. Educational cycle framing only — not financial advice (NFA).",
        asOf: new Date().toISOString(),
        warnings: chunkErrors.length ? chunkErrors : undefined,
      },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Coinbase BTC-USD feed unavailable",
      },
      {
        status: 502,
        headers: {
          "Cache-Control":
            "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  }
}
