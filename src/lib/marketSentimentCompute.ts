/**
 * Pure compute for the market sentiment gauge (shared by /api/risk-sentiment
 * and the offline backtest). Inputs are raw public series; nothing is filled in.
 */
import type { MonthClose } from "@/lib/seasonality";
import { baseMonthlyReturns, buildSeasonality } from "@/lib/riskSentiment";
import {
  IDX,
  INPUTS,
  SMOOTH,
  CAP_BIT,
  WATCH_NEEDED,
  WATCH_SCORE,
  V2_WEIGHTS,
  alignStep,
  bitCount,
  blendRow,
  breadthAvailable,
  capApplies,
  ema,
  rollingPercentile,
  shiftDays,
  type Series,
} from "@/lib/marketSentiment";

export type OfrCols = { ofr: Series; ofrVol: Series; ofrEq: Series; ofrCredit: Series };
export type MsRaw = {
  ofr: OfrCols | null;
  nfci: Series | null;
  stlfsi: Series | null;
  cryptoFng: Series | null;
  /** Monthly breadth [YYYY-MM, share %, countries]. */
  breadth: Array<[string, number, number]> | null;
  spxMonths: MonthClose[] | null;
};

/** Weekly Fed indices are dated Friday and published the following Wednesday/Thursday. */
export const WEEKLY_LAG_DAYS = 6;

const flip = (s: Series): Series => s.map(([d, v]) => [d, Math.round((100 - v) * 10) / 10]);
const minusDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

export type MsComputed = {
  dates: string[];
  /** subs[k][i] — sub-score of INPUTS[k] on dates[i]. */
  subs: Array<Array<number | null>>;
  raw: Array<number | null>;
  e10: Array<number | null>;
  e42: Array<number | null>;
  /** v2 reproduction (v2 weights, no breadth, no cap). */
  v2raw: Array<number | null>;
  v2e42: Array<number | null>;
  flags: number[];
  watch: number[];
  season: ReturnType<typeof buildSeasonality>;
};

export function computeMs(inp: MsRaw, fallbackFrom = "2005-01-03"): MsComputed {
  let dates: string[] = inp.ofr ? inp.ofr.ofr.map(([d]) => d).filter((d) => d >= "2000-01-01") : [];
  if (!dates.length) {
    for (let t = Date.parse(fallbackFrom); t <= Date.now(); t += 86_400_000) {
      const d = new Date(t);
      if (d.getUTCDay() % 6 !== 0) dates.push(d.toISOString().slice(0, 10));
    }
  }
  const nul = () => dates.map(() => null as number | null);
  const subs: Array<Array<number | null>> = [];
  const ofrSub = (s?: Series) => (s ? alignStep(dates, flip(rollingPercentile(s, 5, 250)), 7) : nul());
  subs.push(ofrSub(inp.ofr?.ofr), ofrSub(inp.ofr?.ofrVol), ofrSub(inp.ofr?.ofrEq), ofrSub(inp.ofr?.ofrCredit));
  const weekly = (s: Series | null) =>
    s ? alignStep(dates, shiftDays(flip(rollingPercentile(s, 10, 260)), WEEKLY_LAG_DAYS), 21) : nul();
  subs.push(weekly(inp.nfci), weekly(inp.stlfsi));
  subs.push(alignStep(dates, inp.cryptoFng, 4));
  const monthKeys = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const season = buildSeasonality(baseMonthlyReturns({ spx: null, world: null, spxMonths: inp.spxMonths }), monthKeys);
  subs.push(dates.map((d) => season.get(d.slice(0, 7))?.score ?? null));
  // Breadth: each month from its publication date; stale after ~2 months.
  const bAvail: Series = (inp.breadth ?? []).map(([m, v]) => [breadthAvailable(m), v]);
  subs.push(inp.breadth ? alignStep(dates, bAvail, 62) : nul());
  if (subs.length !== INPUTS.length) throw new Error("input count mismatch");

  const sub = (k: number, i: number) => subs[k]![i]!;
  const raw = dates.map((_, i) => blendRow(INPUTS.map((_, k) => sub(k, i))));
  const v2raw = dates.map((_, i) => blendRow(INPUTS.map((_, k) => sub(k, i)), V2_WEIGHTS, false));
  const e10 = ema(raw, SMOOTH.ema10);
  const e42 = ema(raw, SMOOTH.ema42);
  const v2e42 = ema(v2raw, SMOOTH.ema42);

  // Complacency conditions (raw levels where needed).
  const credLvl = inp.ofr ? alignStep(dates, inp.ofr.ofrCredit, 7) : nul();
  const credLvl3 = inp.ofr ? alignStep(dates.map((d) => minusDays(d, 91)), inp.ofr.ofrCredit, 7) : nul();
  const nfciPub = inp.nfci ? shiftDays(inp.nfci, WEEKLY_LAG_DAYS) : null;
  const nfciNow = nfciPub ? alignStep(dates, nfciPub, 21) : nul();
  const b3 = inp.breadth ? alignStep(dates.map((d) => minusDays(d, 91)), bAvail, 62) : nul();
  // Lowest published NFCI over the prior ~13 weeks (excluding today's reading).
  const nfciMin: Array<number | null> = [];
  {
    let lo = 0;
    for (let i = 0; i < dates.length; i++) {
      if (!nfciPub) {
        nfciMin.push(null);
        continue;
      }
      const from = minusDays(dates[i]!, 91);
      let m: number | null = null;
      while (lo < nfciPub.length && nfciPub[lo]![0] < from) lo++;
      for (let j = lo; j < nfciPub.length && nfciPub[j]![0] <= dates[i]!; j++) m = m == null ? nfciPub[j]![1] : Math.min(m, nfciPub[j]![1]);
      nfciMin.push(m);
    }
  }
  const flags: number[] = [];
  const watch: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    const vol = sub(IDX.ofrVol, i);
    const eq = sub(IDX.ofrEq, i);
    const br = sub(IDX.breadth, i);
    let f = 0;
    if (vol != null && vol >= 90) f |= 1;
    if (credLvl[i] != null && credLvl3[i] != null && credLvl[i]! > credLvl3[i]! && eq != null && eq >= 60) f |= 2;
    if (br != null && b3[i] != null && br <= b3[i]! - 15 && eq != null && eq >= 70) f |= 4;
    if (nfciMin[i] != null && nfciNow[i] != null && nfciMin[i]! < -0.4 && nfciNow[i]! >= nfciMin[i]! + 0.1) f |= 8;
    if (capApplies(INPUTS.map((_, k) => sub(k, i)))) f |= CAP_BIT;
    flags.push(f);
    watch.push(e42[i] != null && e42[i]! >= WATCH_SCORE && bitCount(f) >= WATCH_NEEDED ? 1 : 0);
  }
  return { dates, subs, raw, e10, e42, v2raw, v2e42, flags, watch, season };
}
