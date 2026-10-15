/**
 * Global liquidity from public FRED CSVs (Fed H.4.1 / H.10, NY Fed, ECB, Fed H.6).
 * Cached and revalidated about twice a week; any series that can't be fetched falls back to the
 * stored month-end copy in src/data/global-liquidity-snapshot.json and the payload is flagged.
 */
import snapshot from "@/data/global-liquidity-snapshot.json";
import {
  SERIES_IDS,
  computeLiquidity,
  parseFredCsv,
  toMonthly,
  type LiqPayload,
  type MonthSeries,
  type SeriesId,
} from "@/lib/globalLiquidity";

export const runtime = "nodejs";
/** ~3.5 days: the inputs update weekly. */
export const revalidate = 302400;

type Snap = { fetched: string; series: Record<SeriesId, MonthSeries>; lastObs: Record<SeriesId, string> };
const SNAP = snapshot as unknown as Snap;

async function fetchSeries(id: SeriesId): Promise<{ months: MonthSeries; last: string }> {
  const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, {
    next: { revalidate: 302400 },
    signal: AbortSignal.timeout(9000),
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AdirindinFinance/1.0)" },
  });
  if (!res.ok) throw new Error(`${id} HTTP ${res.status}`);
  const obs = parseFredCsv(await res.text());
  return { months: toMonthly(obs), last: obs[obs.length - 1]![0] };
}

export async function GET() {
  const results = await Promise.allSettled(SERIES_IDS.map(fetchSeries));
  const series = {} as Record<SeriesId, MonthSeries>;
  const lastObs: LiqPayload["lastObs"] = {};
  const storedSeries: SeriesId[] = [];
  SERIES_IDS.forEach((id, i) => {
    const r = results[i]!;
    if (r.status === "fulfilled") {
      series[id] = r.value.months;
      lastObs[id] = r.value.last;
    } else {
      series[id] = SNAP.series[id];
      lastObs[id] = SNAP.lastObs[id];
      storedSeries.push(id);
    }
  });
  const stored = storedSeries.length > 0;
  const storedTo = stored ? storedSeries.map((id) => SNAP.lastObs[id]).sort()[0]! : null;
  try {
    const res = computeLiquidity(series);
    const body: LiqPayload = { ok: true, generated: new Date().toISOString(), lastObs, stored, storedTo, storedSeries, ...res };
    return Response.json(body);
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "compute failed", generated: new Date().toISOString(), lastObs, stored, storedTo, storedSeries } satisfies LiqPayload,
      { status: 500 },
    );
  }
}
