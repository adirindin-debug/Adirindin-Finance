/**
 * Bond yield cycle theory silhouette for the Market cycles hub.
 * Ridge geometry and Live timing match BondYieldCycleChart.tsx exactly.
 * Educational · no yield targets · NFA.
 */

import { bondLap, bondLapIndexAt, janMs } from "@/lib/bondCycle";

type Pt = { x: number; y: number };

const TROUGH: Pt = { x: 88, y: 300 };
const PEAK: Pt = { x: 424, y: 64 };
const NEXT_TROUGH: Pt = { x: 760, y: 300 };
const HALF_W = PEAK.x - TROUGH.x;

const LEFT_KNOTS: [number, number][] = [
  [0, 300],
  [0.14, 295],
  [0.28, 282],
  [0.42, 256],
  [0.53, 230],
  [0.63, 218],
  [0.75, 172],
  [0.87, 112],
  [0.95, 76],
  [1, 64],
];
const RIGHT_KNOTS: [number, number][] = [
  [0.05, 76],
  [0.13, 106],
  [0.25, 150],
  [0.37, 182],
  [0.47, 194],
  [0.56, 206],
  [0.68, 238],
  [0.8, 270],
  [0.91, 291],
  [1, 300],
];

const KNOTS: Pt[] = [
  ...LEFT_KNOTS.map(([u, y]) => ({ x: TROUGH.x + u * HALF_W, y })),
  ...RIGHT_KNOTS.map(([v, y]) => ({ x: PEAK.x + v * HALF_W, y })),
];

const TANGENTS: number[] = (() => {
  const n = KNOTS.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((KNOTS[i + 1].y - KNOTS[i].y) / (KNOTS[i + 1].x - KNOTS[i].x));
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
})();

function ridgeY(x: number): number {
  const cx = Math.min(NEXT_TROUGH.x, Math.max(TROUGH.x, x));
  let i = 0;
  while (i < KNOTS.length - 2 && cx > KNOTS[i + 1].x) i++;
  const p0 = KNOTS[i];
  const p1 = KNOTS[i + 1];
  const h = p1.x - p0.x;
  const t = (cx - p0.x) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0.y +
    (t3 - 2 * t2 + t) * h * TANGENTS[i] +
    (-2 * t3 + 3 * t2) * p1.y +
    (t3 - t2) * h * TANGENTS[i + 1]
  );
}

const RIDGE_PATH = (() => {
  const parts: string[] = [];
  for (let x = TROUGH.x; x <= NEXT_TROUGH.x; x += 2) {
    parts.push(`${parts.length === 0 ? "M" : "L"} ${x} ${ridgeY(x).toFixed(2)}`);
  }
  return parts.join(" ");
})();

export const BOND_SILHOUETTE = {
  path: RIDGE_PATH,
  viewBox: "70 40 710 290",
  color: "#d4a017",
} as const;

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

const YEAR_MS = 365.2425 * 86_400_000;

export type BondLiveSilhouette = {
  pt: Pt;
  phaseLine: string;
};

export function bondLiveSilhouette(nowMs: number): BondLiveSilhouette {
  const day = melbourneDayMs(nowMs);
  const lap = bondLapIndexAt(day);
  const { startYear, peakYear, endYear } = bondLap(lap);
  const startMs = janMs(startYear);
  const peakMs = janMs(peakYear);
  const endMs = janMs(endYear);
  const rising = day < peakMs;
  const frac = rising
    ? Math.max(0, (day - startMs) / (peakMs - startMs))
    : Math.min(1, (day - peakMs) / (endMs - peakMs));
  const x = rising ? TROUGH.x + frac * HALF_W : PEAK.x + frac * HALF_W;
  const nextMs = rising ? peakMs : endMs;
  const yearsToNext = Math.max(0, Math.round((nextMs - day) / YEAR_MS));
  const nextZoneYear = rising ? peakYear : endYear;
  const phaseLine =
    yearsToNext < 1
      ? `Near ~${nextZoneYear} theoretical ${rising ? "peak" : "trough"} zone`
      : `~${yearsToNext}y to ~${nextZoneYear} theoretical ${rising ? "peak" : "trough"} zone`;
  return { pt: { x, y: ridgeY(x) }, phaseLine };
}
