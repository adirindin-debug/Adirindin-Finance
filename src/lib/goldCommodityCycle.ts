/**
 * Anthony / Adirindin 46-year gold-led commodity cycle sketch.
 *
 * Peak-zone anchors (Jan-dated): 1934 → 1980 → 2026 → 2072 (~46y apart).
 * Shape per cycle (peak → next peak): post-peak settle → flat for years →
 * huge multi-year run → third-quarter pause → final run into peak zone.
 *
 * Observational sketch only — not “the Kondratiev law”, not Cardo IP, not a
 * price target model. Tweak anchors / phase fractions HERE only. Educational · NFA.
 */

export const GOLD_CYCLE_YEARS = 46;

/**
 * Peak-zone anchors (calendar year of 1 Jan marker).
 * Anthony’s locked sketch — edit this array to move the whole clock.
 */
export const GOLD_PEAK_ANCHORS = [1934, 1980, 2026, 2072] as const;

export type GoldPeakAnchor = (typeof GOLD_PEAK_ANCHORS)[number];

/**
 * Phase fractions along one peak→peak lap (0 = prior peak, 1 = next peak).
 * Easy to retune after the first preview without touching chart glue.
 */
export const GOLD_PHASE = {
  /** Post-peak unwind finishes; flat base begins. */
  settleEnd: 0.14,
  /** Long flat / quiet base ends; primary run begins. */
  flatEnd: 0.42,
  /** Huge multi-year run ends; third-quarter pause begins. */
  runEnd: 0.68,
  /** Pause ends; final run into peak zone. */
  pauseEnd: 0.82,
} as const;

/** Model unit heights (0 = cycle base, 1 = peak zone). Illustrative only. */
export const GOLD_MODEL_LEVELS = {
  afterPeak: 1,
  flat: 0.1,
  runShoulder: 0.72,
  pauseDip: 0.66,
  peak: 1,
} as const;

export function janMs(year: number): number {
  return Date.UTC(year, 0, 1, 0, 0, 0, 0);
}

/** Expand anchors forward/back so Live / chart never fall off the ends. */
export function goldPeakYearsCovering(fromYear: number, toYear: number): number[] {
  const out: number[] = [...GOLD_PEAK_ANCHORS];
  const first = out[0]!;
  const last = out[out.length - 1]!;
  let y = first - GOLD_CYCLE_YEARS;
  while (y >= fromYear - GOLD_CYCLE_YEARS) {
    out.unshift(y);
    y -= GOLD_CYCLE_YEARS;
  }
  y = last + GOLD_CYCLE_YEARS;
  while (y <= toYear + GOLD_CYCLE_YEARS) {
    out.push(y);
    y += GOLD_CYCLE_YEARS;
  }
  return out;
}

/**
 * Fraction along the active peak→peak lap for a timestamp.
 * Returns { priorPeak, nextPeak, frac } with frac in [0, 1).
 */
export function goldCycleProgress(ms: number): {
  priorPeak: number;
  nextPeak: number;
  frac: number;
} {
  const year = new Date(ms).getUTCFullYear();
  const start = janMs(year);
  const nextJan = janMs(year + 1);
  const y = year + (ms - start) / Math.max(nextJan - start, 1);
  const peaks = goldPeakYearsCovering(y - GOLD_CYCLE_YEARS, y + GOLD_CYCLE_YEARS);
  let i = 0;
  while (i < peaks.length - 2 && peaks[i + 1]! <= y) i++;
  const priorPeak = peaks[i]!;
  const nextPeak = peaks[i + 1]!;
  const frac = Math.min(0.9999, Math.max(0, (y - priorPeak) / (nextPeak - priorPeak)));
  return { priorPeak, nextPeak, frac };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Illustrative model unit in [0, 1] for a fraction along one lap.
 * Smooth curved silhouette matching Anthony’s phase description.
 */
export function goldModelUnit(frac: number): number {
  const { settleEnd, flatEnd, runEnd, pauseEnd } = GOLD_PHASE;
  const L = GOLD_MODEL_LEVELS;
  const f = Math.min(1, Math.max(0, frac));

  if (f <= settleEnd) {
    const t = smoothstep(f / settleEnd);
    return lerp(L.afterPeak, L.flat, t);
  }
  if (f <= flatEnd) {
    return L.flat;
  }
  if (f <= runEnd) {
    const t = smoothstep((f - flatEnd) / (runEnd - flatEnd));
    return lerp(L.flat, L.runShoulder, t);
  }
  if (f <= pauseEnd) {
    const t = smoothstep((f - runEnd) / (pauseEnd - runEnd));
    return lerp(L.runShoulder, L.pauseDip, t);
  }
  const t = smoothstep((f - pauseEnd) / (1 - pauseEnd));
  return lerp(L.pauseDip, L.peak, t);
}

/** Model unit at an absolute timestamp. */
export function goldModelUnitAt(ms: number): number {
  return goldModelUnit(goldCycleProgress(ms).frac);
}

export type GoldPhaseName =
  | "Post-peak settle"
  | "Flat base"
  | "Primary run"
  | "Third-quarter pause"
  | "Final run to peak zone";

export function goldPhaseName(frac: number): GoldPhaseName {
  const { settleEnd, flatEnd, runEnd, pauseEnd } = GOLD_PHASE;
  if (frac < settleEnd) return "Post-peak settle";
  if (frac < flatEnd) return "Flat base";
  if (frac < runEnd) return "Primary run";
  if (frac < pauseEnd) return "Third-quarter pause";
  return "Final run to peak zone";
}

export function goldLivePhaseLine(nowMs: number): string {
  const { priorPeak, nextPeak, frac } = goldCycleProgress(nowMs);
  const phase = goldPhaseName(frac);
  const yearsToPeak = Math.max(0, Math.round((1 - frac) * (nextPeak - priorPeak)));
  if (yearsToPeak < 1) {
    return `Near ~Jan ${nextPeak} peak-zone marker · ${phase}`;
  }
  return `~${yearsToPeak}y to ~Jan ${nextPeak} peak-zone marker · ${phase}`;
}

export const GOLD_ANCHOR_NOTES: Record<number, string> = {
  1934:
    "Revaluation / policy era (US Gold Reserve Act lifted the official price to $35/oz) — not a free-market peak like 1980.",
  1980: "Free-market secular peak zone after the 1970s bull market.",
  2026:
    "Calendar peak-zone marker under study — not a guaranteed top. Anthony will retune after preview.",
  2072: "Theoretical next peak-zone marker from the ~46-year spacing — illustrative only.",
};

export const GOLD_CAVEAT_SHORT =
  "Anthony / Adirindin observational sketch · gold-led · ~46y peak zones · not Kondratiev-as-law · NFA";

export const GOLD_SOURCE_LINE =
  "Gold USD: datasets/gold-prices (historical monthly) + Yahoo Finance GC=F for recent closes · peg-era levels are documented official/historical series, not invented";

export const GOLD_CAPTION =
  "Long-run gold (USD/oz, log) with Anthony’s ~46-year gold-led commodity cycle silhouette. Peak-zone markers Jan 1934 / 1980 / 2026 / 2072.";
