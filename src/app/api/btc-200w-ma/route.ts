/**
 * Bitcoin price vs 200-week simple moving average.
 * Modern history: Yahoo Finance BTC-USD weekly closes (from ~Sep 2014). Fallback:
 * Coinbase Exchange BTC-USD daily candles → weekly closes when Yahoo is unavailable.
 * Pre-2014 extension: Blockchain.com Charts `market-price` (daily average USD across
 * major exchanges) resampled to weekly closes, stitched before Yahoo/Coinbase without
 * double-counting overlap (modern source wins). Soft-fails to Yahoo-era chart if the
 * pre-history fetch fails. Live spot prefers Coinbase ticker. Educational — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow coinbase fallback chunking on slower hosts. */
export const maxDuration = 60;

const CB = "https://api.exchange.coinbase.com";
const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD";
const YAHOO_CHART_2 = "https://query2.finance.yahoo.com/v8/finance/chart/BTC-USD";
/** Blockchain.com Charts — composite average USD market price (daily). */
const BLOCKCHAIN_MARKET_PRICE =
  "https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false";
const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindin.finance)";

/** Coinbase BTC-USD daily history starts ~2015-07-20; pad slightly earlier. */
const COINBASE_START_MS = Date.UTC(2015, 6, 1);
/** Yahoo BTC-USD weekly reliably from mid-Sep 2014. */
const YAHOO_PERIOD1 = Math.floor(Date.UTC(2014, 8, 1) / 1000);
/** Coinbase candles max ~300 per request; stay under. */
const CHUNK_DAYS = 280;
const CHUNK_PAUSE_MS = 320;
const MA_WEEKS = 200;
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;

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
          ? Math.min(Math.max(retryAfter * 1000, 800), 10_000)
          : 600 * 2 ** attempt;
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
        await sleep(500 * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr ?? new Error("Coinbase candles failed");
}

/**
 * Coinbase candles: [time, low, high, open, close, volume]; max ~300 per call.
 * Fetches newest→oldest so partial runs still cover recent cycles.
 */
async function fetchCoinbaseDailyCloses(): Promise<{
  dailies: DailyClose[];
  chunkErrors: string[];
}> {
  const end = Math.floor(Date.now() / 1000);
  const start = Math.floor(COINBASE_START_MS / 1000);
  const out: DailyClose[] = [];
  const chunkErrors: string[] = [];
  let chunks = 0;

  // Walk backwards from now so rate-limit cuts still leave multi-year history.
  for (let e = end; e > start; e -= CHUNK_DAYS * 86400) {
    const s = Math.max(e - CHUNK_DAYS * 86400, start);
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

/** Yahoo chart weekly closes (period1/period2 — range=max undersamples). */
async function fetchYahooWeeklyCloses(): Promise<WeeklyClose[]> {
  const period2 = Math.floor(Date.now() / 1000);
  const urls = [YAHOO_CHART, YAHOO_CHART_2].map(
    (base) =>
      `${base}?interval=1wk&period1=${YAHOO_PERIOD1}&period2=${period2}`,
  );
  let lastErr: Error | null = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (!res.ok) {
        lastErr = new Error(`Yahoo BTC-USD HTTP ${res.status}`);
        continue;
      }
      const data = (await res.json()) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
          error?: { description?: string };
        };
      };
      const result = data.chart?.result?.[0];
      const ts = result?.timestamp ?? [];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const weeks: WeeklyClose[] = [];
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i];
        const c = closes[i];
        if (
          typeof t !== "number" ||
          typeof c !== "number" ||
          !Number.isFinite(t) ||
          !Number.isFinite(c) ||
          c <= 0
        ) {
          continue;
        }
        weeks.push({ t, price: c });
      }
      weeks.sort((a, b) => a.t - b.t);
      // Dedupe same-week stamps if any
      const deduped: WeeklyClose[] = [];
      for (const w of weeks) {
        const prev = deduped[deduped.length - 1];
        if (prev && isoWeekKey(prev.t) === isoWeekKey(w.t)) {
          deduped[deduped.length - 1] = w;
        } else {
          deduped.push(w);
        }
      }
      if (deduped.length >= MA_WEEKS) return deduped;
      lastErr = new Error(
        `Yahoo BTC-USD: insufficient weekly history (${deduped.length})`,
      );
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error("Yahoo BTC-USD weekly feed unavailable");
}

/**
 * Blockchain.com Charts market-price: daily average USD across major exchanges.
 * Early years are a composite/index USD print — not the same as Yahoo BTC-USD.
 */
async function fetchBlockchainDailyCloses(): Promise<DailyClose[]> {
  const res = await fetch(BLOCKCHAIN_MARKET_PRICE, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Blockchain.com market-price HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    status?: string;
    values?: Array<{ x?: number; y?: number }>;
  };
  const values = data.values ?? [];
  if (!values.length) {
    throw new Error("Blockchain.com market-price: empty values");
  }
  const out: DailyClose[] = [];
  for (const row of values) {
    const t = row.x;
    const c = row.y;
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
  out.sort((a, b) => a.t - b.t);
  if (!out.length) {
    throw new Error("Blockchain.com market-price: no positive prices");
  }
  return out;
}

/**
 * Prefer modern (Yahoo/Coinbase) weeks on overlap; keep Blockchain weeks strictly
 * before the first modern week (by ISO week key + timestamp).
 */
function stitchWeeklyPrehistory(
  pre: WeeklyClose[],
  modern: WeeklyClose[],
): WeeklyClose[] {
  if (!modern.length) return pre.filter((w) => w.price > 0);
  if (!pre.length) return modern;
  const modernKeys = new Set(modern.map((w) => isoWeekKey(w.t)));
  const firstModernT = modern[0]!.t;
  const preOnly = pre.filter(
    (w) =>
      w.price > 0 &&
      w.t < firstModernT &&
      !modernKeys.has(isoWeekKey(w.t)),
  );
  return [...preOnly, ...modern];
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

async function fetchCoinbaseSpot(): Promise<number | null> {
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
  const warnings: string[] = [];
  let modernWeeks: WeeklyClose[] = [];
  let dailyCount = 0;
  let modernSource: "yahoo-weekly" | "coinbase-daily" | null = null;
  let prehistorySource: "blockchain-market-price" | null = null;
  let prehistoryWeeklyCount = 0;
  let stitchSeamDate: string | null = null;

  try {
    modernWeeks = await fetchYahooWeeklyCloses();
    modernSource = "yahoo-weekly";
  } catch (e) {
    warnings.push(
      e instanceof Error ? `Yahoo weekly: ${e.message}` : "Yahoo weekly failed",
    );
    try {
      const { dailies, chunkErrors } = await fetchCoinbaseDailyCloses();
      dailyCount = dailies.length;
      if (chunkErrors.length) warnings.push(...chunkErrors);
      modernWeeks = dailyToWeekly(dailies);
      modernSource = "coinbase-daily";
    } catch (e2) {
      warnings.push(
        e2 instanceof Error
          ? `Coinbase daily: ${e2.message}`
          : "Coinbase daily failed",
      );
    }
  }

  let weeks = modernWeeks;
  let preWeeks: WeeklyClose[] = [];
  try {
    const preDailies = await fetchBlockchainDailyCloses();
    preWeeks = dailyToWeekly(preDailies);
    if (preWeeks.length) {
      const stitched = stitchWeeklyPrehistory(preWeeks, modernWeeks);
      const added = stitched.length - modernWeeks.length;
      if (added > 0) {
        weeks = stitched;
        prehistorySource = "blockchain-market-price";
        prehistoryWeeklyCount = added;
        stitchSeamDate = modernWeeks[0]
          ? new Date(modernWeeks[0]!.t * 1000).toISOString().slice(0, 10)
          : null;
      } else if (!modernWeeks.length) {
        weeks = stitched;
        prehistorySource = "blockchain-market-price";
        prehistoryWeeklyCount = stitched.length;
      }
    }
  } catch (e) {
    warnings.push(
      e instanceof Error
        ? `Pre-2014 Blockchain.com: ${e.message} — using modern history only`
        : "Pre-2014 Blockchain.com failed — using modern history only",
    );
  }

  const historySource = prehistorySource
    ? (`${prehistorySource}+${modernSource ?? "none"}` as const)
    : modernSource;

  try {
    if (weeks.length < MA_WEEKS) {
      return Response.json(
        {
          ok: false,
          error: `Need at least ${MA_WEEKS} weekly closes for the 200-week MA (got ${weeks.length})`,
          errors: warnings.length ? warnings : undefined,
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

    const spot = await fetchCoinbaseSpot();
    const latest = points[points.length - 1]!;
    const price = spot ?? latest.price;
    const ma200w = latest.ma200w;
    const pctFromMa = ((price - ma200w) / ma200w) * 100;
    const absFromMa = price - ma200w;

    const historyStart = weeks[0]
      ? new Date(weeks[0].t * 1000).toISOString().slice(0, 10)
      : null;
    const historyEnd = weeks[weeks.length - 1]
      ? new Date(weeks[weeks.length - 1]!.t * 1000).toISOString().slice(0, 10)
      : null;
    const historyYears =
      weeks.length >= 2
        ? (weeks[weeks.length - 1]!.t - weeks[0]!.t) / (86400 * 365.25)
        : 0;

    let source: string;
    let sourceUrl: string;
    if (prehistorySource && modernSource === "yahoo-weekly") {
      source =
        "Stitched weekly closes: Blockchain.com Charts market-price (pre-seam composite USD average) + Yahoo Finance BTC-USD; live spot via Coinbase when available";
      sourceUrl = "https://www.blockchain.com/explorer/charts/market-price";
    } else if (prehistorySource && modernSource === "coinbase-daily") {
      source =
        "Stitched weekly closes: Blockchain.com Charts market-price (pre-seam composite USD average) + Coinbase Exchange BTC-USD daily→weekly";
      sourceUrl = "https://www.blockchain.com/explorer/charts/market-price";
    } else if (modernSource === "yahoo-weekly") {
      source =
        "Yahoo Finance BTC-USD (weekly closes → SMA 200); live spot via Coinbase when available";
      sourceUrl = "https://finance.yahoo.com/quote/BTC-USD";
    } else {
      source =
        "Coinbase Exchange BTC-USD (daily candles → weekly closes → SMA 200)";
      sourceUrl = "https://www.coinbase.com/price/bitcoin";
    }

    const noteParts = [
      "200-week simple moving average of weekly closes.",
      prehistorySource
        ? "Early years before the Yahoo/Coinbase seam use Blockchain.com's composite average USD market price (not Yahoo BTC-USD)."
        : null,
      "Educational cycle framing only — not financial advice (NFA).",
    ].filter(Boolean);

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
        historyStart,
        historyEnd,
        historyYears: Math.round(historyYears * 10) / 10,
        maPointCount: points.length,
        weeklyCount: weeks.length,
        dailyCount: dailyCount || undefined,
        prehistoryWeeklyCount: prehistoryWeeklyCount || undefined,
        stitchSeamDate: stitchSeamDate || undefined,
        modernSource: modernSource || undefined,
        prehistorySource: prehistorySource || undefined,
        historySource,
        source,
        sourceUrl,
        note: noteParts.join(" "),
        asOf: new Date().toISOString(),
        warnings: warnings.length ? warnings : undefined,
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
            : "BTC-USD 200-week MA feed unavailable",
        errors: warnings.length ? warnings : undefined,
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
