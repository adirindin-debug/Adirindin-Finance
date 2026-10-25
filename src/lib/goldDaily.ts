/**
 * Daily gold tail from PAX Gold (PAXG-USD), a gold-backed token (1 token = 1 fine troy oz
 * LBMA bar) that tracks spot within a small premium/discount. Public exchange APIs only:
 * Coinbase Exchange daily candles (listed 8 May 2025), Kraken public OHLC as fallback.
 *
 * Stitching with the long monthly series (datasets/gold-prices + IMF PCPS PGOLD):
 *  - PAXG closes are scaled by one constant factor = mean(monthly print / PAXG monthly
 *    average) across overlapping full months, removing the token premium so the join
 *    has no level jump. Constant scale ⇒ daily % moves are unchanged.
 *  - Relative chart: monthly points before the first PAXG day, scaled daily after.
 *  - Commodity chart (monthly): monthly series kept as is; months after the latest
 *    monthly print are extended with scaled PAXG monthly averages (current month = MTD).
 */
import { getGoldHistory, type GoldPoint } from "@/lib/goldHistory";

const DAY = 86400;
const CB_START = Date.UTC(2025, 4, 1) / 1000;
const FRESH_MS = 60 * 60 * 1000;

export type GoldStitched = {
  monthly: GoldPoint[];
  daily: GoldPoint[]; // scaled PAXG daily closes
  dailyVenue: "coinbase" | "kraken" | null;
  dailyStart: string | null;
  factor: number;
  snapshot: boolean;
  stale: boolean;
};

let cache: { at: number; v: GoldPoint[]; venue: "coinbase" | "kraken" } | null = null;

async function fetchCoinbase(): Promise<GoldPoint[]> {
  const now = Math.floor(Date.now() / 1000);
  const chunks: Promise<GoldPoint[]>[] = [];
  for (let s = CB_START; s < now; s += 290 * DAY) {
    const e = Math.min(s + 290 * DAY, now + DAY);
    const u = `https://api.exchange.coinbase.com/products/PAXG-USD/candles?granularity=86400&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    chunks.push(
      fetch(u, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "AdirindinFinance/1.0" }, next: { revalidate: 3600 } })
        .then((r) => {
          if (!r.ok) throw new Error(`coinbase PAXG HTTP ${r.status}`);
          return r.json() as Promise<number[][]>;
        })
        .then((rows) => rows.map((x) => ({ t: x[0]!, c: x[4]! }))),
    );
  }
  const all = (await Promise.all(chunks)).flat();
  const m = new Map<number, number>();
  for (const p of all) if (Number.isFinite(p.c) && p.c > 0) m.set(p.t, p.c);
  const out = [...m.entries()].map(([t, c]) => ({ t, c })).sort((a, b) => a.t - b.t);
  if (out.length < 30) throw new Error("coinbase PAXG too short");
  return out;
}

async function fetchKraken(): Promise<GoldPoint[]> {
  const r = await fetch("https://api.kraken.com/0/public/OHLC?pair=PAXGUSD&interval=1440", {
    signal: AbortSignal.timeout(10_000),
    next: { revalidate: 3600 },
  });
  if (!r.ok) throw new Error(`kraken PAXG HTTP ${r.status}`);
  const j = (await r.json()) as { error?: string[]; result?: Record<string, unknown> };
  const rows = Object.entries(j.result ?? {}).find(([k]) => k !== "last")?.[1] as Array<Array<string | number>> | undefined;
  const out = (rows ?? []).map((x) => ({ t: Number(x[0]), c: Number(x[4]) })).filter((p) => p.c > 0);
  if (out.length < 30) throw new Error("kraken PAXG too short");
  return out;
}

export async function getPaxgDaily(): Promise<{ points: GoldPoint[]; venue: "coinbase" | "kraken" } | null> {
  if (cache && Date.now() - cache.at < FRESH_MS) return { points: cache.v, venue: cache.venue };
  for (const [venue, fn] of [["coinbase", fetchCoinbase], ["kraken", fetchKraken]] as const) {
    try {
      const v = await fn();
      cache = { at: Date.now(), v, venue };
      return { points: v, venue };
    } catch {
      /* next */
    }
  }
  return cache ? { points: cache.v, venue: cache.venue } : null;
}

const monthKey = (t: number) => new Date(t * 1000).toISOString().slice(0, 7);

function monthlyAverages(daily: GoldPoint[]): Map<string, { avg: number; n: number }> {
  const acc = new Map<string, { s: number; n: number }>();
  for (const p of daily) {
    const k = monthKey(p.t);
    const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += p.c;
    a.n += 1;
    acc.set(k, a);
  }
  return new Map([...acc].map(([k, a]) => [k, { avg: a.s / a.n, n: a.n }]));
}

export async function getGoldStitched(): Promise<GoldStitched | null> {
  const [h, px] = await Promise.all([getGoldHistory(), getPaxgDaily()]);
  if (!h.ok) return null;
  const monthly = h.body.points.filter((p) => Number.isFinite(p.c) && p.c > 0);
  const base = { monthly, snapshot: Boolean(h.body.snapshot), stale: Boolean(h.body.stale) };
  if (!px || !px.points.length) return { ...base, daily: [], dailyVenue: null, dailyStart: null, factor: 1 };
  const avgs = monthlyAverages(px.points);
  const firstMonth = monthKey(px.points[0]!.t);
  const ratios: number[] = [];
  for (const p of monthly) {
    const k = monthKey(p.t);
    const a = avgs.get(k);
    if (a && k > firstMonth && a.n >= 15) ratios.push(p.c / a.avg); // full months only
  }
  const factor = ratios.length ? ratios.reduce((s, x) => s + x, 0) / ratios.length : 1;
  const daily = px.points.map((p) => ({ t: p.t, c: p.c * factor }));
  return {
    ...base,
    daily,
    dailyVenue: px.venue,
    dailyStart: new Date(daily[0]!.t * 1000).toISOString().slice(0, 10),
    factor,
  };
}

/** Monthly series extended past the last monthly print with scaled PAXG monthly averages. */
export function extendMonthly(g: GoldStitched): { points: GoldPoint[]; extendedFrom: string | null } {
  if (!g.daily.length || !g.monthly.length) return { points: g.monthly, extendedFrom: null };
  const lastK = monthKey(g.monthly[g.monthly.length - 1]!.t);
  const ext = [...monthlyAverages(g.daily)]
    .filter(([k]) => k > lastK)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, a]) => ({ t: Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, 15) / 1000, c: a.avg }));
  return { points: [...g.monthly, ...ext], extendedFrom: ext.length ? monthKey(ext[0]!.t) : null };
}

/** Daily-axis series for the relative chart: monthly before PAXG start, scaled daily after. */
export function stitchedDaily(g: GoldStitched): GoldPoint[] {
  if (!g.daily.length) return g.monthly;
  const start = g.daily[0]!.t;
  return [...g.monthly.filter((p) => p.t < start), ...g.daily];
}
