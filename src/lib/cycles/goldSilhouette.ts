/**
 * Gold-led ~46y commodity cycle silhouette for the Market cycles hub tile.
 * Same framing as the sibling tiles: trough zone (left) → peak zone → next
 * trough zone (right), with the same calendar timing as /tools/gold-cycle
 * (peak zones from goldCommodityCycle.ts, trough zone ~20y after each peak).
 *
 * The tile has its OWN self-contained shape (the detail chart is unchanged):
 *   trough → first run-up → mid-cycle correction → second run-up (same shape)
 *   → peak zone → shallow, flat drawdown to a much higher low
 * The ending low sits ~62% of the way from the starting trough to the peak —
 * well above the mid-cycle correction low — reflecting gold's long secular
 * uptrend. Educational observational sketch · NFA.
 */

import {
  GOLD_TROUGH_FRAC,
  goldCycleProgress,
  goldLivePhaseLine,
} from "@/lib/goldCommodityCycle";

type Pt = { x: number; y: number };

const X0 = 88;
const X1 = 760;
const Y_PEAK = 48;
const Y_BASE = 300;
const W = X1 - X0;

function unitToY(unit: number): number {
  return Y_BASE - unit * (Y_BASE - Y_PEAK);
}

/* -------------------------------------------------------------------------- */
/* Tile shape: [u across the tile 0..1, unit height 0..1]                     */
/* -------------------------------------------------------------------------- */

/** Peak position across the tile (trough → peak is ~26y of the ~46y lap). */
const PEAK_U = 1 - GOLD_TROUGH_FRAC;
/** Mid-cycle correction length (≈4y of the lap). */
const CORRECTION_U = 0.09;
/** Both run-up legs have the same length and rise. */
const LEG_U = (PEAK_U - CORRECTION_U) / 2;
/** Correction depth; legs then rise (1 + depth) / 2 each to land exactly on the peak. */
const CORRECTION_DEPTH = 0.2;
const LEG_RISE = (1 + CORRECTION_DEPTH) / 2;
/** Right-side ending low, as a share of the peak's height above the starting trough. */
export const GOLD_TILE_END_LOW = 0.62;

/** One run-up leg: [share of leg length, share of rise] — slow start, firm middle, rounded top. */
const LEG_TEMPLATE: [number, number][] = [
  [0, 0],
  [0.22, 0.1],
  [0.48, 0.38],
  [0.72, 0.7],
  [0.9, 0.93],
  [1, 1],
];

/** Post-peak drawdown profile: [share of the drawdown span, share of the drop left]. */
const DRAWDOWN_TEMPLATE: [number, number][] = [
  [0, 1],
  [0.06, 0.9],
  [0.16, 0.7],
  [0.3, 0.5],
  [0.5, 0.3],
  [0.75, 0.12],
  [1, 0],
];

const legKnots = (u0: number, v0: number): [number, number][] =>
  LEG_TEMPLATE.map(([a, b]) => [u0 + a * LEG_U, v0 + b * LEG_RISE]);

const KNOTS: [number, number][] = [
  ...legKnots(0, 0),
  ...legKnots(LEG_U + CORRECTION_U, LEG_RISE - CORRECTION_DEPTH),
  ...DRAWDOWN_TEMPLATE.slice(1).map(
    ([a, b]): [number, number] => [PEAK_U + a * (1 - PEAK_U), GOLD_TILE_END_LOW + b * (1 - GOLD_TILE_END_LOW)],
  ),
];

/** Monotone cubic (Fritsch–Carlson) tangents → smooth, no overshoot, flat at turns. */
const TANGENTS: number[] = (() => {
  const k = KNOTS;
  const n = k.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((k[i + 1]![1] - k[i]![1]) / (k[i + 1]![0] - k[i]![0]));
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i]! / d[i]!;
    const b = m[i + 1]! / d[i]!;
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i]!;
      m[i + 1] = t * b * d[i]!;
    }
  }
  return m;
})();

/** Tile unit height (0 = starting trough, 1 = peak zone) at u across the tile. */
export function goldTileUnit(u: number): number {
  const f = Math.min(1, Math.max(0, u));
  const k = KNOTS;
  let i = 0;
  while (i < k.length - 2 && f > k[i + 1]![0]) i++;
  const [x0, y0] = k[i]!;
  const [x1, y1] = k[i + 1]!;
  const h = x1 - x0;
  const t = (f - x0) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const v =
    (2 * t3 - 3 * t2 + 1) * y0 +
    (t3 - 2 * t2 + t) * h * TANGENTS[i]! +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * h * TANGENTS[i + 1]!;
  return Math.min(1, Math.max(0, v));
}

const RIDGE_PATH = (() => {
  const parts: string[] = [];
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    parts.push(`${i === 0 ? "M" : "L"} ${(X0 + u * W).toFixed(2)} ${unitToY(goldTileUnit(u)).toFixed(2)}`);
  }
  return parts.join(" ");
})();

export const GOLD_SILHOUETTE = {
  path: RIDGE_PATH,
  viewBox: "70 30 710 300",
  /** Amber distinct from bond’s deeper gold. */
  color: "#f0c14a",
} as const;

export type GoldLiveSilhouette = {
  pt: Pt;
  phaseLine: string;
};

/** Live: same calendar position as the detail chart (fraction along the peak→peak lap). */
export function goldLiveSilhouette(nowMs: number): GoldLiveSilhouette {
  const { frac } = goldCycleProgress(nowMs);
  const u = (frac - GOLD_TROUGH_FRAC + 1) % 1;
  const x = X0 + u * W;
  const y = unitToY(goldTileUnit(u));
  return { pt: { x, y }, phaseLine: goldLivePhaseLine(nowMs) };
}
