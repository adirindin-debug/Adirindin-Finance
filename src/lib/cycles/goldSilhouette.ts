/**
 * Gold-led ~46y commodity cycle silhouette for the Market cycles hub tile.
 * Same framing as the sibling tiles: trough zone (left) → peak zone → next
 * trough zone (right), with the same calendar timing as /tools/gold-cycle
 * (peak zones from goldCommodityCycle.ts, trough zone ~20y after each peak).
 *
 * The tile shape is also the lap shape on /tools/gold-cycle (GoldCycleChart
 * repeats goldTileUnit across laps via goldTileX). It is modelled on the
 * 1970s–80s gold pattern: flat low → steep run-up → sharp
 * mid-way correction → parabolic spike to the peak → sharp drop → long
 * "down sideways" drift ending ~58% of the way up — well above the start,
 * reflecting gold's long secular uptrend. Educational observational sketch · NFA.
 */

import {
  GOLD_TILE_PEAK_S,
  GOLD_TILE_RANGE_START_S,
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
/* Tile shape: [s across the tile 0..1, unit height 0..1]                     */
/* -------------------------------------------------------------------------- */

/** Peak's place in the lap (trough → peak is ~26y of the ~46y lap). */
const PEAK_U = 1 - GOLD_TROUGH_FRAC;
/**
 * Peak's place across the tile. Like the 1970s–80s gold reference, the run-up is
 * compressed (~38% of the width) and the long post-peak drift gets the rest.
 * Live timing is warped to match (see tileX), so the dot stays just after the peak.
 */
const PEAK_S = GOLD_TILE_PEAK_S;
/** Right-side ending level, as a share of the peak's height above the starting trough. */
export const GOLD_TILE_END_LOW = 0.58;
/** Starting (left trough) level of the tile shape — first knot height. */
export const GOLD_TILE_START_LOW = 0.015;

/**
 * Hand-placed knots after Anthony's 1970s–80s gold reference, smoothed through a
 * monotone cubic: flat, slightly choppy base → steep run-up → sharp mid-way
 * correction (~55% → ~43%) → steeper parabolic spike to the peak → sharp drop
 * to ~35% below the peak → long "down sideways" drift with a rebound hump, a
 * smaller later hump, and an end ~58% of the way up (well above the start).
 */
const KNOTS: [number, number][] = [
  // flat, choppy base
  [0, GOLD_TILE_START_LOW],
  [0.035, 0.03],
  [0.075, 0.005],
  [0.105, 0.035],
  // steep first run-up with a brief pause
  [0.128, 0.14],
  [0.142, 0.165],
  [0.163, 0.34],
  [0.186, 0.49],
  [0.203, 0.55],
  // sharp mid-way correction
  [0.222, 0.5],
  [0.248, 0.43],
  [0.266, 0.455],
  // steeper parabolic spike into the peak
  [0.29, 0.52],
  [0.312, 0.6],
  [0.333, 0.71],
  [0.352, 0.85],
  [0.369, 0.97],
  [PEAK_S, 1],
  // rounded top just after the peak (Live sits here), then the sharp drop
  [0.395, 0.975],
  [0.412, 0.87],
  [0.428, 0.775],
  [0.443, 0.785],
  [0.468, 0.69],
  // end of the sharp drop = start of the range-bound zone (GOLD_TILE_RANGE_START_S)
  [GOLD_TILE_RANGE_START_S, 0.645],
  // long down-sideways drift (range-bound zone): rebound hump, ripples, smaller later hump
  [0.523, 0.665],
  [0.556, 0.765],
  [0.584, 0.78],
  [0.618, 0.725],
  [0.642, 0.738],
  [0.676, 0.705],
  [0.718, 0.69],
  [0.752, 0.708],
  [0.79, 0.735],
  [0.822, 0.738],
  [0.86, 0.668],
  [0.9, 0.636],
  [0.935, 0.62],
  [0.968, 0.6],
  [1, GOLD_TILE_END_LOW],
];

/** Lap position u (0 = trough, PEAK_U = peak, 1 = next trough) → tile s. */
export function goldTileX(u: number): number {
  return tileX(u);
}

function tileX(u: number): number {
  const f = Math.min(1, Math.max(0, u));
  return f <= PEAK_U ? (f / PEAK_U) * PEAK_S : PEAK_S + ((f - PEAK_U) / (1 - PEAK_U)) * (1 - PEAK_S);
}

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

/** Tile unit height (0 = starting trough, 1 = peak zone) at s across the tile. */
export function goldTileUnit(s: number): number {
  const f = Math.min(1, Math.max(0, s));
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
  const s = tileX((frac - GOLD_TROUGH_FRAC + 1) % 1);
  const x = X0 + s * W;
  const y = unitToY(goldTileUnit(s));
  return { pt: { x, y }, phaseLine: goldLivePhaseLine(nowMs) };
}
