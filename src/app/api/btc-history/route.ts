/**
 * Same-origin BTC history for the cycle map (weekly + daily + spot).
 * Browser→Yahoo hits CORS; browser→Coinbase candles often 429; public CORS
 * proxies 403. Fetches server-side: Yahoo first, then splices pre-Yahoo
 * closes from blockchain.info (fills ~2010–Sep 2014 gap Yahoo skips),
 * Coinbase (chunked + 429 backoff) / Kraken fallbacks. Soft-fails to
 * last-good in-memory cache. Educational — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const CB = "https://api.exchange.coinbase.com";
const YAHOO_1 = "https://query1.finance.yahoo.com/v8/finance/chart/BTC-USD";
const YAHOO_2 = "https://query2.finance.yahoo.com/v8/finance/chart/BTC-USD";
const YAHOO_PERIOD1 = Math.floor(Date.UTC(2014, 8, 1) / 1000);
const BC_MARKET_PRICE =
  "https://api.blockchain.info/charts/market-price?timespan=all&format=json&sampled=false";
const COINBASE_START_MS = Date.UTC(2015, 6, 1);
const CHUNK_DAYS = 280;
const CHUNK_PAUSE_MS = 320;
const FETCH_MS = 12_000;
const MAX_RETRIES = 3;

type Bar = { t: number; o: number; h: number; l: number; c: number };
type PairBar = [string, number, number, number, number]; // date, o, h, l, c

type CachePayload = {
  ok: true;
  weekly: PairBar[];
  daily: PairBar[];
  spot: number | null;
  source: string;
  asOf: string;
  warnings?: string[];
  stale?: boolean;
};

let lastGood: CachePayload | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isoDate(tsSec: number) {
  return new Date(tsSec * 1000).toISOString().slice(0, 10);
}

function toPairs(bars: Bar[]): PairBar[] {
  return bars.map((b) => [
    isoDate(b.t),
    Math.round(b.o * 100) / 100,
    Math.round(b.h * 100) / 100,
    Math.round(b.l * 100) / 100,
    Math.round(b.c * 100) / 100,
  ]);
}

async function fetchJson(url: string, timeoutMs = FETCH_MS): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function yahooBars(
  interval: "1d" | "1wk",
): Promise<{ bars: Bar[]; spot: number | null }> {
  const period2 = Math.floor(Date.now() / 1000);
  const urls = [YAHOO_1, YAHOO_2].map(
    (base) =>
      `${base}?interval=${interval}&period1=${YAHOO_PERIOD1}&period2=${period2}`,
  );
  let lastErr: Error | null = null;
  for (const url of urls) {
    try {
      const json = (await fetchJson(url)) as {
        chart?: {
          result?: Array<{
            timestamp?: number[];
            meta?: { regularMarketPrice?: number };
            indicators?: {
              quote?: Array<{
                open?: (number | null)[];
                high?: (number | null)[];
                low?: (number | null)[];
                close?: (number | null)[];
              }>;
            };
          }>;
        };
      };
      const result = json.chart?.result?.[0];
      const ts = result?.timestamp ?? [];
      const q = result?.indicators?.quote?.[0] ?? {};
      const bars: Bar[] = [];
      for (let i = 0; i < ts.length; i++) {
        const c = q.close?.[i];
        if (typeof c !== "number" || !Number.isFinite(c) || c <= 0) continue;
        const o =
          typeof q.open?.[i] === "number" && (q.open![i] as number) > 0
            ? (q.open![i] as number)
            : c;
        const h =
          typeof q.high?.[i] === "number" && (q.high![i] as number) > 0
            ? (q.high![i] as number)
            : c;
        const l =
          typeof q.low?.[i] === "number" && (q.low![i] as number) > 0
            ? (q.low![i] as number)
            : c;
        bars.push({ t: ts[i]!, o, h, l, c });
      }
      if (bars.length < 50) {
        lastErr = new Error(`Yahoo BTC ${interval}: too short (${bars.length})`);
        continue;
      }
      const spotRaw = result?.meta?.regularMarketPrice;
      const spot =
        spotRaw != null && Number.isFinite(spotRaw) && spotRaw > 0
          ? spotRaw
          : bars[bars.length - 1]!.c;
      return { bars, spot };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`Yahoo BTC ${interval} unavailable`);
}

async function fetchCandlesChunk(url: string): Promise<number[][]> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_MS),
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
      if (!res.ok) throw new Error(`Coinbase HTTP ${res.status}`);
      const rows = (await res.json()) as number[][];
      if (!Array.isArray(rows)) throw new Error("Coinbase candles: bad payload");
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

async function coinbaseDailyBars(): Promise<{ bars: Bar[]; warnings: string[] }> {
  const end = Math.floor(Date.now() / 1000);
  const start = Math.floor(COINBASE_START_MS / 1000);
  const out: Bar[] = [];
  const warnings: string[] = [];
  let chunks = 0;

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
        const l = row[1];
        const h = row[2];
        const o = row[3];
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
        out.push({
          t,
          o: typeof o === "number" && o > 0 ? o : c,
          h: typeof h === "number" && h > 0 ? h : c,
          l: typeof l === "number" && l > 0 ? l : c,
          c,
        });
      }
    } catch (err) {
      warnings.push(
        `chunk ${chunks}: ${err instanceof Error ? err.message : "failed"}`,
      );
    }
    chunks += 1;
  }

  out.sort((a, b) => a.t - b.t);
  const deduped: Bar[] = [];
  const seen = new Set<string>();
  for (const b of out) {
    const k = isoDate(b.t);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(b);
  }
  if (deduped.length < 200) {
    throw new Error(`Coinbase daily too short (${deduped.length})`);
  }
  return { bars: deduped, warnings };
}

function isoWeekKey(tSec: number): string {
  const d = new Date(tSec * 1000);
  const day = d.getUTCDay() || 7;
  const thu = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day),
  );
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function dailyToWeekly(dailies: Bar[]): Bar[] {
  const byWeek = new Map<string, Bar>();
  for (const d of dailies) {
    const key = isoWeekKey(d.t);
    const prev = byWeek.get(key);
    if (!prev) {
      byWeek.set(key, { ...d });
      continue;
    }
    if (d.t >= prev.t) {
      byWeek.set(key, {
        t: d.t,
        o: prev.o,
        h: Math.max(prev.h, d.h),
        l: Math.min(prev.l, d.l),
        c: d.c,
      });
    } else {
      byWeek.set(key, {
        t: prev.t,
        o: d.o,
        h: Math.max(prev.h, d.h),
        l: Math.min(prev.l, d.l),
        c: prev.c,
      });
    }
  }
  return [...byWeek.values()].sort((a, b) => a.t - b.t);
}

async function krakenBars(interval: 1440 | 10080): Promise<Bar[]> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=${interval}`;
  const json = (await fetchJson(url)) as {
    result?: Record<string, unknown>;
  };
  const result = json.result ?? {};
  const key = Object.keys(result).find((k) => k !== "last");
  if (!key) throw new Error("Kraken OHLC empty");
  const rows = result[key] as number[][];
  const bars: Bar[] = [];
  for (const r of rows) {
    const t = Number(r[0]);
    const o = Number(r[1]);
    const h = Number(r[2]);
    const l = Number(r[3]);
    const c = Number(r[4]);
    if (!Number.isFinite(t) || !Number.isFinite(c) || c <= 0) continue;
    bars.push({
      t,
      o: Number.isFinite(o) && o > 0 ? o : c,
      h: Number.isFinite(h) && h > 0 ? h : c,
      l: Number.isFinite(l) && l > 0 ? l : c,
      c,
    });
  }
  if (bars.length < 50) throw new Error(`Kraken ${interval} too short`);
  return bars;
}


/** Close-only daily bars from blockchain.info (covers pre-Yahoo BTC). */
async function blockchainDailyBars(): Promise<Bar[]> {
  const json = (await fetchJson(BC_MARKET_PRICE, 20_000)) as {
    values?: Array<{ x?: number; y?: number }>;
  };
  const values = json.values ?? [];
  const bars: Bar[] = [];
  for (const p of values) {
    const t = p.x;
    const c = p.y;
    if (typeof t !== "number" || typeof c !== "number") continue;
    if (!Number.isFinite(t) || !Number.isFinite(c) || c <= 0) continue;
    bars.push({ t, o: c, h: c, l: c, c });
  }
  if (bars.length < 200) {
    throw new Error(`blockchain.info too short (${bars.length})`);
  }
  return bars;
}

/** Prepend early bars that fall strictly before the live series start. */
function spliceBefore(live: Bar[], early: Bar[]): Bar[] {
  if (!early.length) return live;
  if (!live.length) return early.slice();
  const cut = live[0]!.t;
  const pre = early.filter((b) => b.t < cut);
  if (!pre.length) return live;
  return pre.concat(live);
}

async function coinbaseSpot(): Promise<number | null> {
  try {
    const ticker = (await fetchJson(`${CB}/products/BTC-USD/ticker`, 8_000)) as {
      price?: string;
    };
    const p = Number(ticker.price);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

async function krakenSpot(): Promise<number | null> {
  try {
    const json = (await fetchJson(
      "https://api.kraken.com/0/public/Ticker?pair=XBTUSD",
      8_000,
    )) as { result?: Record<string, { c?: string[] }> };
    const keys = Object.keys(json.result ?? {});
    const row = keys.length ? json.result![keys[0]!] : undefined;
    const p = Number(row?.c?.[0]);
    return Number.isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const warnings: string[] = [];
  let weekly: Bar[] = [];
  let daily: Bar[] = [];
  let spot: number | null = null;
  const sourceParts: string[] = [];

  try {
    const w = await yahooBars("1wk");
    weekly = w.bars;
    if (spot == null) spot = w.spot;
    sourceParts.push("Yahoo weekly");
  } catch (e) {
    warnings.push(
      e instanceof Error ? `Yahoo weekly: ${e.message}` : "Yahoo weekly failed",
    );
  }

  try {
    const d = await yahooBars("1d");
    daily = d.bars;
    if (spot == null) spot = d.spot;
    sourceParts.push("Yahoo daily");
  } catch (e) {
    warnings.push(
      e instanceof Error ? `Yahoo daily: ${e.message}` : "Yahoo daily failed",
    );
  }


  try {
    const earlyDaily = await blockchainDailyBars();
    const beforeDaily = daily.length;
    const beforeWeekly = weekly.length;
    daily = spliceBefore(daily, earlyDaily);
    weekly = spliceBefore(weekly, dailyToWeekly(earlyDaily));
    if (daily.length > beforeDaily || weekly.length > beforeWeekly) {
      sourceParts.push("blockchain.info early");
    }
  } catch (e) {
    warnings.push(
      e instanceof Error
        ? `blockchain.info early: ${e.message}`
        : "blockchain.info early failed",
    );
  }

  if (daily.length < 200) {
    try {
      const { bars, warnings: w } = await coinbaseDailyBars();
      daily = bars;
      warnings.push(...w);
      sourceParts.push("Coinbase daily");
      if (weekly.length < 50) {
        weekly = dailyToWeekly(bars);
        sourceParts.push("Coinbase→weekly");
      }
    } catch (e) {
      warnings.push(
        e instanceof Error
          ? `Coinbase daily: ${e.message}`
          : "Coinbase daily failed",
      );
    }
  }

  if (weekly.length < 50) {
    try {
      weekly = await krakenBars(10080);
      sourceParts.push("Kraken weekly");
    } catch (e) {
      warnings.push(
        e instanceof Error
          ? `Kraken weekly: ${e.message}`
          : "Kraken weekly failed",
      );
    }
  }

  if (daily.length < 200) {
    try {
      daily = await krakenBars(1440);
      sourceParts.push("Kraken daily");
    } catch (e) {
      warnings.push(
        e instanceof Error
          ? `Kraken daily: ${e.message}`
          : "Kraken daily failed",
      );
    }
  }

  if (spot == null) spot = await coinbaseSpot();
  if (spot == null) spot = await krakenSpot();
  if (spot == null && daily.length) spot = daily[daily.length - 1]!.c;

  if (weekly.length < 50 && daily.length < 200) {
    if (lastGood) {
      return Response.json(
        {
          ...lastGood,
          stale: true,
          warnings: [
            ...(warnings.length ? warnings : []),
            "Serving last-good cache; live upstreams unavailable",
          ],
        },
        {
          status: 200,
          headers: {
            "Cache-Control":
              "public, s-maxage=30, stale-while-revalidate=300",
          },
        },
      );
    }
    return Response.json(
      {
        ok: false,
        error: "Could not load BTC history",
        errors: warnings,
      },
      {
        status: 502,
        headers: {
          "Cache-Control":
            "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  }

  if (weekly.length < 50 && daily.length >= 200) {
    weekly = dailyToWeekly(daily);
    sourceParts.push("daily→weekly");
  }

  const payload: CachePayload = {
    ok: true,
    weekly: toPairs(weekly),
    daily: toPairs(daily),
    spot,
    source: sourceParts.join(" · ") || "mixed",
    asOf: new Date().toISOString(),
    warnings: warnings.length ? warnings : undefined,
  };
  lastGood = payload;

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
