/**
 * Gold-led ~46y commodity cycle silhouette for the Market cycles hub.
 * Same framing as the sibling tiles: trough zone (left) → run-up → mid-cycle
 * correction → second run-up → peak zone → drawdown to a HIGHER next trough
 * zone (right). The ridge is the repeating lap shape from goldCommodityCycle.ts
 * (goldTileUnit), so the hub and /tools/gold-cycle always match.
 * Educational observational sketch · NFA.
 */

import {
  GOLD_TROUGH_FRAC,
  goldCycleProgress,
  goldLivePhaseLine,
  goldTileUnit,
} from "@/lib/goldCommodityCycle";

type Pt = { x: number; y: number };

const X0 = 88;
const X1 = 760;
const Y_PEAK = 48;
const Y_BASE = 300;
const W = X1 - X0;

function modelToY(unit: number): number {
  return Y_BASE - unit * (Y_BASE - Y_PEAK);
}

/** Tile x (0..1 across) → fraction along the peak→peak lap, starting at the trough. */
function tileToLapFrac(u: number): number {
  return (GOLD_TROUGH_FRAC + u) % 1;
}

const RIDGE_PATH = (() => {
  const parts: string[] = [];
  const steps = 240;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = X0 + u * W;
    // Exact peak at the wrap point (frac 1 → 0 is the same summit); the right
    // edge is the next (higher) trough, not the starting one.
    const f = GOLD_TROUGH_FRAC + u;
    if (i === steps) {
      parts.push(`L ${x.toFixed(2)} ${modelToY(goldTileUnit(GOLD_TROUGH_FRAC - 1e-6)).toFixed(2)}`);
      continue;
    }
    const unit = Math.abs(f - 1) < 1e-9 ? 1 : goldTileUnit(tileToLapFrac(u));
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${modelToY(unit).toFixed(2)}`);
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

export function goldLiveSilhouette(nowMs: number): GoldLiveSilhouette {
  const { frac } = goldCycleProgress(nowMs);
  const u = (frac - GOLD_TROUGH_FRAC + 1) % 1;
  const x = X0 + u * W;
  const y = modelToY(goldTileUnit(frac));
  return { pt: { x, y }, phaseLine: goldLivePhaseLine(nowMs) };
}
