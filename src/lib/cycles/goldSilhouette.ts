/**
 * Gold-led ~46y commodity cycle silhouette for the Market cycles hub.
 * Path + Live timing share phase math with GoldCommodityCycleChart / goldCommodityCycle.ts.
 * Educational observational sketch · NFA.
 */

import {
  goldCycleProgress,
  goldLivePhaseLine,
  goldModelUnit,
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

const RIDGE_PATH = (() => {
  const parts: string[] = [];
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const x = X0 + frac * W;
    const y = modelToY(goldModelUnit(frac));
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
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
  const x = X0 + frac * W;
  const y = modelToY(goldModelUnit(frac));
  return { pt: { x, y }, phaseLine: goldLivePhaseLine(nowMs) };
}
