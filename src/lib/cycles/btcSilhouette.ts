/**
 * BTC 4y cycle theory silhouette for the Market cycles hub.
 * Geometry and Live timing match BtcFourYearCycleChart.tsx exactly —
 * not price data, not invented dates. Educational · NFA.
 */

import {
  THEORY_CYCLE_YEARS,
  approxFullDate,
  theoryPeakMs,
  theoryTroughMs,
} from "@/lib/btcCycleExtremes";
import {
  bezierPathD,
  pointAtX,
  smoothBeziers,
  type Pt,
} from "@/lib/smoothCurve";

const TROUGH: Pt = { x: 88, y: 300 };
const MID_UP: Pt = { x: 470, y: 215 };
const PEAK: Pt = { x: 620, y: 48 };
const NEXT_TROUGH: Pt = { x: 760, y: 300 };

const CLIMB_WOBBLE: Pt[] = [
  { x: 150, y: 282 },
  { x: 162, y: 287 },
  { x: 228, y: 266 },
  { x: 240, y: 270 },
  { x: 318, y: 246 },
  { x: 334, y: 252 },
  { x: 400, y: 228 },
  { x: 412, y: 232 },
];
const RUNUP_WOBBLE: Pt[] = [
  { x: 520, y: 178 },
  { x: 532, y: 190 },
  { x: 572, y: 112 },
  { x: 583, y: 126 },
  { x: 603, y: 58 },
  { x: 610, y: 68 },
];
const DRAWDOWN_WOBBLE: Pt[] = [
  { x: 640, y: 118 },
  { x: 648, y: 104 },
  { x: 672, y: 182 },
  { x: 680, y: 171 },
  { x: 703, y: 238 },
  { x: 710, y: 230 },
];

const LINE_KNOTS: Pt[] = [
  TROUGH,
  ...CLIMB_WOBBLE,
  MID_UP,
  ...RUNUP_WOBBLE,
  PEAK,
  ...DRAWDOWN_WOBBLE,
  NEXT_TROUGH,
];
const LINE_BEZ = smoothBeziers(LINE_KNOTS);

export const BTC_SILHOUETTE = {
  path: bezierPathD(LINE_BEZ),
  viewBox: "70 30 710 290",
  color: "#3b82c4",
} as const;

type TheoryLap = { lowMs: number; peakMs: number; nextLowMs: number };

function theoryLapAt(nowMs: number): TheoryLap {
  const approxYears =
    (nowMs - theoryPeakMs(0)) / (365.25 * 86_400_000) / THEORY_CYCLE_YEARS;
  let lap = Math.floor(approxYears) - 1;
  while (theoryTroughMs(lap) < nowMs) lap += 1;
  while (theoryTroughMs(lap - 1) >= nowMs) lap -= 1;
  return {
    lowMs: theoryTroughMs(lap - 1),
    peakMs: theoryPeakMs(lap),
    nextLowMs: theoryTroughMs(lap),
  };
}

function melbourneYmd(nowMs: number): { y: number; m: number; d: number } {
  const melParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  return {
    y: Number(melParts.find((p) => p.type === "year")!.value),
    m: Number(melParts.find((p) => p.type === "month")!.value),
    d: Number(melParts.find((p) => p.type === "day")!.value),
  };
}

function melbourneDayMs(nowMs: number): number {
  const { y, m, d } = melbourneYmd(nowMs);
  return Date.UTC(y, m - 1, d, 12, 0, 0, 0);
}

export type BtcLiveSilhouette = {
  pt: Pt;
  phaseLine: string;
};

export function btcLiveSilhouette(nowMs: number): BtcLiveSilhouette {
  const now = melbourneDayMs(nowMs);
  const { lowMs, peakMs, nextLowMs } = theoryLapAt(now);
  const descending = now > peakMs;
  const frac = Math.min(
    1,
    Math.max(
      0,
      descending
        ? (now - peakMs) / (nextLowMs - peakMs)
        : (now - lowMs) / (peakMs - lowMs),
    ),
  );
  const x = descending
    ? PEAK.x + frac * (NEXT_TROUGH.x - PEAK.x)
    : TROUGH.x + frac * (PEAK.x - TROUGH.x);
  const pt = pointAtX(LINE_BEZ, x);
  const daysToTrough = Math.max(0, Math.round((nextLowMs - now) / 86_400_000));
  const phaseLine = descending
    ? `~${daysToTrough}d to theory trough (${approxFullDate(nextLowMs)})`
    : `Ascent toward theory peak (${approxFullDate(peakMs)})`;
  return { pt, phaseLine };
}
