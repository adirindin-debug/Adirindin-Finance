/**
 * ETH / SOL overlay history for the BTC cycle map.
 * Query: ?symbol=ETH|SOL (also accepts ETH-USD / SOL-USD).
 * Yahoo chart primary; Kraken early splice for ETH (~2015-08 before
 * Yahoo ETH-USD ~2017-11); Coinbase / Kraken fallbacks. Returns
 * weekly + daily close pairs like /api/mstr-history. Educational — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const FETCH_MS = 12_000;

type Pair = [string, number];
type SymbolKey = "ETH" | "SOL";

type SymbolCfg = {
  key: SymbolKey;
  name: string;
  yahoo: string;
  coinbase: string;
  kraken: string;
  /** Prefer Kraken weekly splice before this ISO date when Yahoo starts later. */
  earlySplice?: boolean;
};

const SYMBOLS: Record<SymbolKey, SymbolCfg> = {
  ETH: {
    key: "ETH",
    name: "Ethereum",
    yahoo: "ETH-USD",
    coinbase: "ETH-USD",
    kraken: "ETHUSD",
    earlySplice: true,
  },
  SOL: {
    key: "SOL",
    name: "Solana",
    yahoo: "SOL-USD",
    coinbase: "SOL-USD",
    kraken: "SOLUSD",
  },
};

type CachePayload = {
  ok: true;
  ticker: SymbolKey;
  name: string;
  asOf: string;
  last: number | null;
  weekly: Pair[];
  daily: Pair[];
  source: string;
  from: string | null;
  to: string | null;
  note: string;
  errors?: string[];
};

const lastGood = new Map<SymbolKey, CachePayload>();

function isoDate(ts: number) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function parseSymbol(raw: string | null): SymbolKey | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/-USD$/, "");
  if (s === "ETH" || s === "ETHEREUM") return "ETH";
  if (s === "SOL" || s === "SOLANA") return "SOL";
  return null;
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

async function yahoo(
  ticker: string,
  interval: "1d" | "1wk",
): Promise<{ rows: Pair[]; last: number | null }> {
  const period2 = Math.floor(Date.now() / 1000);
  const bases = [
    "https://query1.finance.yahoo.com/v8/finance/chart/",
    "https://query2.finance.yahoo.com/v8/finance/chart/",
  ];
  let lastErr: Error | null = null;
  for (const base of bases) {
    const url =
      `${base}${ticker}?period1=0&period2=${period2}&interval=${interval}` +
      `&events=div%2Csplit&includeAdjustedClose=true`;
    try {
      const json = (await fetchJson(url)) as {
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
      if (!result?.timestamp?.length) {
        lastErr = new Error(`Yahoo ${ticker} ${interval}: no data`);
        continue;
      }
      const quote = result.indicators?.quote?.[0]?.close ?? [];
      const adj = result.indicators?.adjclose?.[0]?.adjclose ?? [];
      const rows: Pair[] = [];
      for (let i = 0; i < result.timestamp.length; i++) {
        const c = pickClose(quote, adj, i);
        if (c == null) continue;
        rows.push([
          isoDate(result.timestamp[i]!),
          Math.round(c * 100) / 100,
        ]);
      }
      if (rows.length < 20) {
        lastErr = new Error(
          `Yahoo ${ticker} ${interval}: too short (${rows.length})`,
        );
        continue;
      }
      const spot = result.meta?.regularMarketPrice;
      const last =
        spot != null && Number.isFinite(spot) && spot > 0
          ? Math.round(spot * 100) / 100
          : rows[rows.length - 1]![1];
      return { rows, last };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`Yahoo ${ticker} ${interval} unavailable`);
}

async function krakenOhlc(
  pair: string,
  interval: 1440 | 10080,
): Promise<Pair[]> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`;
  const json = (await fetchJson(url)) as {
    error?: string[];
    result?: Record<string, unknown>;
  };
  if (json.error?.length) {
    throw new Error(`Kraken ${pair}: ${json.error.join(", ")}`);
  }
  const result = json.result ?? {};
  const key = Object.keys(result).find((k) => k !== "last");
  if (!key) throw new Error(`Kraken ${pair}: empty`);
  const raw = result[key] as Array<Array<string | number>>;
  const rows: Pair[] = [];
  for (const r of raw) {
    const t = Number(r[0]);
    const c = Number(r[4]);
    if (!Number.isFinite(t) || !Number.isFinite(c) || c <= 0) continue;
    rows.push([isoDate(t), Math.round(c * 100) / 100]);
  }
  if (rows.length < 20) {
    throw new Error(`Kraken ${pair} ${interval}: too short (${rows.length})`);
  }
  return rows;
}

async function coinbaseDaily(product: string): Promise<Pair[]> {
  const CB = "https://api.exchange.coinbase.com";
  const end = Math.floor(Date.now() / 1000);
  // ETH listed ~2016-05; SOL ~2021 on Coinbase — pull from 2016 for both.
  const start = Math.floor(Date.UTC(2016, 4, 1) / 1000);
  const CHUNK_DAYS = 280;
  const out: Pair[] = [];
  let chunks = 0;
  for (let e = end; e > start; e -= CHUNK_DAYS * 86400) {
    const s = Math.max(e - CHUNK_DAYS * 86400, start);
    const url =
      `${CB}/products/${product}/candles?granularity=86400` +
      `&start=${new Date(s * 1000).toISOString()}` +
      `&end=${new Date(e * 1000).toISOString()}`;
    try {
      if (chunks > 0) await new Promise((r) => setTimeout(r, 280));
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(FETCH_MS),
        cache: "no-store",
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200));
        chunks += 1;
        continue;
      }
      if (!res.ok) {
        chunks += 1;
        continue;
      }
      const rows = (await res.json()) as number[][];
      if (!Array.isArray(rows)) {
        chunks += 1;
        continue;
      }
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
        out.push([isoDate(t), Math.round(c * 100) / 100]);
      }
    } catch {
      /* skip chunk */
    }
    chunks += 1;
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const deduped: Pair[] = [];
  const seen = new Set<string>();
  for (const p of out) {
    if (seen.has(p[0])) continue;
    seen.add(p[0]);
    deduped.push(p);
  }
  if (deduped.length < 50) {
    throw new Error(`Coinbase ${product}: too short (${deduped.length})`);
  }
  return deduped;
}

function dailyToWeekly(daily: Pair[]): Pair[] {
  // Group by ISO week (Thu-based like Yahoo weekly stamps); keep last close.
  const byWeek = new Map<string, Pair>();
  for (const [date, c] of daily) {
    const d = new Date(date + "T00:00:00Z");
    const day = d.getUTCDay() || 7;
    const thu = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day),
    );
    const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
    const week = Math.ceil(
      ((thu.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    const key = `${thu.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
    const prev = byWeek.get(key);
    if (!prev || date >= prev[0]) byWeek.set(key, [date, c]);
  }
  return [...byWeek.values()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );
}

/** Prefer primary rows; prepend early rows whose dates are before primary start. */
function spliceEarly(early: Pair[], primary: Pair[]): Pair[] {
  if (!early.length) return primary;
  if (!primary.length) return early;
  const start = primary[0]![0];
  const head = early.filter((r) => r[0] < start);
  if (!head.length) return primary;
  return head.concat(primary);
}

function stampLast(rows: Pair[], last: number | null, today: string): Pair[] {
  if (!rows.length || last == null || last <= 0) return rows;
  const out = rows.slice();
  const prev = out[out.length - 1]!;
  if (prev[0] === today) out[out.length - 1] = [today, last];
  else if (prev[0] < today) out.push([today, last]);
  return out;
}

function span(rows: Pair[]): { from: string | null; to: string | null } {
  if (!rows.length) return { from: null, to: null };
  return { from: rows[0]![0], to: rows[rows.length - 1]![0] };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sym = parseSymbol(url.searchParams.get("symbol"));
  if (!sym) {
    return Response.json(
      {
        ok: false,
        error: "symbol required (ETH or SOL)",
        symbols: ["ETH", "SOL"],
      },
      { status: 400 },
    );
  }
  const cfg = SYMBOLS[sym];
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let weekly: Pair[] = [];
  let daily: Pair[] = [];
  let last: number | null = null;
  let source = "Yahoo Finance";

  try {
    const [w, d] = await Promise.all([
      yahoo(cfg.yahoo, "1wk"),
      yahoo(cfg.yahoo, "1d"),
    ]);
    weekly = w.rows;
    daily = d.rows;
    last = d.last ?? w.last;
    source = "Yahoo Finance";
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Yahoo failed");
  }

  // ETH: splice Kraken weekly (and daily if needed) before Yahoo ~2017-11.
  if (cfg.earlySplice) {
    try {
      const kWeek = await krakenOhlc(cfg.kraken, 10080);
      if (weekly.length) {
        const yahooStart = weekly[0]![0];
        weekly = spliceEarly(kWeek, weekly);
        if (kWeek[0] && kWeek[0][0] < yahooStart) {
          source = "Kraken early · Yahoo history";
        }
      } else {
        weekly = kWeek;
        source = "Kraken";
      }
      // Extend daily with Coinbase early if Yahoo daily starts late.
      if (daily.length && daily[0]![0] > "2016-06-01") {
        try {
          const cb = await coinbaseDaily(cfg.coinbase);
          const yahooDailyStart = daily[0]![0];
          daily = spliceEarly(cb, daily);
          if (cb[0] && cb[0][0] < yahooDailyStart) {
            if (source.startsWith("Kraken early")) {
              source = "Kraken early · Coinbase · Yahoo";
            } else if (source === "Yahoo Finance") {
              source = "Coinbase early · Yahoo history";
            }
          }
        } catch (e2) {
          errors.push(e2 instanceof Error ? e2.message : "Coinbase early failed");
        }
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Kraken early failed");
    }
  }

  // Full fallbacks if Yahoo produced nothing.
  if (!weekly.length && !daily.length) {
    try {
      const cb = await coinbaseDaily(cfg.coinbase);
      daily = cb;
      weekly = dailyToWeekly(cb);
      last = daily.length ? daily[daily.length - 1]![1] : null;
      source = "Coinbase";
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Coinbase failed");
      try {
        const [kw, kd] = await Promise.all([
          krakenOhlc(cfg.kraken, 10080),
          krakenOhlc(cfg.kraken, 1440),
        ]);
        weekly = kw;
        daily = kd;
        last = daily.length
          ? daily[daily.length - 1]![1]
          : weekly.at(-1)?.[1] ?? null;
        source = "Kraken";
      } catch (e2) {
        errors.push(e2 instanceof Error ? e2.message : "Kraken failed");
      }
    }
  } else if (!weekly.length && daily.length) {
    weekly = dailyToWeekly(daily);
  } else if (!daily.length && weekly.length) {
    daily = weekly.slice();
  }

  weekly = stampLast(weekly, last, today);
  daily = stampLast(daily, last, today);

  if (!weekly.length && !daily.length) {
    const cached = lastGood.get(sym);
    if (cached) {
      return Response.json(
        { ...cached, stale: true, errors },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
          },
        },
      );
    }
    return Response.json(
      { ok: false, error: `Could not load ${sym} history`, errors },
      { status: 502 },
    );
  }

  const { from, to } = span(weekly.length ? weekly : daily);
  const payload: CachePayload = {
    ok: true,
    ticker: cfg.key,
    name: cfg.name,
    asOf: new Date().toISOString(),
    last,
    weekly,
    daily,
    source,
    from,
    to,
    note: `${cfg.name} (${cfg.yahoo}) closes for optional cycle-map overlay. Educational — NFA.`,
    errors: errors.length ? errors : undefined,
  };
  lastGood.set(sym, payload);

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
