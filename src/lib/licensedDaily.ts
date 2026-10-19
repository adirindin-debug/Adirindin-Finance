/**
 * Daily closes from public, displayable sources only (replaces Yahoo Finance).
 *  - "AUDUSD=X": FRED DEXUSAL (Federal Reserve H.10, USD per AUD; public domain).
 *  - Crypto pairs (BTC-USD, ETH-AUD …): Coinbase Exchange public daily candles.
 *  - Anything else (shares, ETFs, indices) throws: no free licensed source.
 * Server-side only.
 */

export type DailyClose = { t: number; c: number };

const UA = "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const FETCH_MS = 10_000;
const DAY = 86400;
/** Coinbase Exchange daily history starts mid-2015. */
const CB_EARLIEST = Math.floor(Date.UTC(2015, 0, 1) / 1000);

export function coinbaseProductFor(symbol: string): string | null {
  const m = /^([A-Z0-9]{2,10})-(USD|AUD)$/.exec(symbol.trim().toUpperCase());
  return m ? `${m[1]}-${m[2]}` : null;
}

async function fredDexusal(period1: number): Promise<DailyClose[]> {
  const cosd = new Date(Math.max(0, period1) * 1000).toISOString().slice(0, 10);
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXUSAL&cosd=${cosd}`, {
    headers: { "User-Agent": UA, Accept: "text/csv,text/plain,*/*" },
    signal: AbortSignal.timeout(FETCH_MS),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`FRED DEXUSAL: HTTP ${res.status}`);
  const out: DailyClose[] = [];
  for (const line of (await res.text()).trim().split(/\r?\n/).slice(1)) {
    const [d, raw] = line.split(",");
    const v = Number(raw);
    if (!d || !Number.isFinite(v) || v <= 0) continue;
    out.push({ t: Math.floor(Date.parse(`${d}T00:00:00Z`) / 1000), c: v });
  }
  if (!out.length) throw new Error("FRED DEXUSAL: no observations");
  return out;
}

async function coinbaseDaily(product: string, period1: number): Promise<DailyClose[]> {
  const CHUNK = 290 * DAY;
  const floor = Math.max(CB_EARLIEST, Math.floor(period1));
  const byT = new Map<number, number>();
  let empty = 0;
  for (let stop = Math.floor(Date.now() / 1000); stop > floor && empty < 2; stop -= CHUNK) {
    const start = Math.max(floor, stop - CHUNK);
    const url =
      `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400` +
      `&start=${new Date(start * 1000).toISOString()}&end=${new Date(stop * 1000).toISOString()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (res.status === 404) throw new Error(`${product} is not listed on Coinbase Exchange`);
    if (!res.ok) throw new Error(`Coinbase ${product}: HTTP ${res.status}`);
    const rows = (await res.json()) as Array<[number, number, number, number, number, number]>;
    if (!Array.isArray(rows) || !rows.length) {
      empty++;
      continue;
    }
    empty = 0;
    for (const r of rows) if (Number.isFinite(r[4]) && r[4] > 0) byT.set(r[0], r[4]);
    await new Promise((r) => setTimeout(r, 120));
  }
  const out = [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, c]) => ({ t, c }));
  if (!out.length) throw new Error(`Coinbase ${product}: no data`);
  return out;
}

export async function fetchLicensedDaily(symbol: string, period1: number): Promise<DailyClose[]> {
  const s = symbol.trim().toUpperCase();
  if (s === "AUDUSD=X") return fredDexusal(period1);
  const product = coinbaseProductFor(s);
  if (product) return coinbaseDaily(product, period1);
  throw new Error(`${s}: no free licensed price source (shares, ETFs and indices are not supported)`);
}
