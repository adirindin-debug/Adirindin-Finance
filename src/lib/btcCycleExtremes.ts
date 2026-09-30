/**
 * Desk cycle extreme dates for the BTC 4y theory schematic hover cards.
 * Sourced from Anthony (Adirindin) — exchange prints can differ; educational only · NFA.
 */

export type CycleExtremeRow = {
  title: string;
  detail: string;
  /** True when the calendar day is incomplete in the desk source. */
  incomplete?: boolean;
};

/** Cycle tops (chronological). */
export const CYCLE_TOPS: ReadonlyArray<CycleExtremeRow> = [
  { title: "Cycle top", detail: "Fri 29 Nov 2013" },
  { title: "Cycle top", detail: "Sun 17 Dec 2017" },
  { title: "Cycle top", detail: "Wed 10 Nov 2021" },
  { title: "Cycle top", detail: "Mon 6 Oct 2025" },
];

/**
 * Cycle bottoms (chronological).
 * "Current bottom" is the desk-logged low so far this cycle (Anthony's date) —
 * a recorded print, not the equal-4y theory trough below.
 */
export const CYCLE_BOTTOMS: ReadonlyArray<CycleExtremeRow> = [
  { title: "Cycle bottom", detail: "Wed 14 Jan 2015" },
  { title: "Cycle bottom", detail: "Sat 15 Dec 2018" },
  { title: "Cycle bottom", detail: "Mon 21 Nov 2022" },
  { title: "Current bottom", detail: "Wed 1 Jul 2026" },
];

export const CYCLE_EXTREMES_DISCLAIMER =
  "Based on data available to this desk. Different exchanges sometimes print different top/bottom dates. Educational only · NFA.";

/* -------------------------------------------------------------------------- */
/* Equal ~4-year theory timing (shared by the Live dot and projected rows)    */
/* -------------------------------------------------------------------------- */

/**
 * Theory anchor = latest desk cycle top, Mon 6 Oct 2025.
 * Equal spacing: one lap = 4 years (~3y up + ~1y down).
 *   theory trough (lap k) = anchor + (4k + 1) years
 *   theory peak   (lap k) = anchor + 4k years
 * History rhymes with this: tops Dec 2017 → Nov 2021 → Oct 2025 (~4y apart);
 * each ~1y drawdown: Dec 2017 → Dec 2018, Nov 2021 → Nov 2022, Oct 2025 → ~Oct 2026.
 * Schematic timing theory only — not a forecast · NFA.
 */
export const THEORY_PEAK_ANCHOR = { year: 2025, month: 10, day: 6 } as const;
export const THEORY_CYCLE_YEARS = 4;
export const THEORY_DRAWDOWN_YEARS = 1;

/** End-of-day UTC ms for a calendar date shifted by whole years from the anchor. */
export function theoryAnchorMs(yearOffset: number): number {
  const { year, month, day } = THEORY_PEAK_ANCHOR;
  return Date.UTC(year + yearOffset, month - 1, day, 23, 59, 59, 999);
}

/** Theory peak for lap k (k = 0 → ~Oct 2025, 1 → ~Oct 2029, …). */
export function theoryPeakMs(lap: number): number {
  return theoryAnchorMs(lap * THEORY_CYCLE_YEARS);
}

/** Theory trough that ends lap k (k = 0 → ~Oct 2026, 1 → ~Oct 2030, …). */
export function theoryTroughMs(lap: number): number {
  return theoryAnchorMs(lap * THEORY_CYCLE_YEARS + THEORY_DRAWDOWN_YEARS);
}

const monthYear = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

/** "~Oct 2029" style — approximate month + year only. */
export function approxMonthYear(ms: number): string {
  return `~${monthYear.format(new Date(ms))}`;
}

export type ProjectedRow = { title: string; detail: string };

/**
 * Projected (theoretical) cycle peaks: Oct 2025 top + 4y, + 8y
 * → ~Oct 2029, ~Oct 2033.
 */
export const PROJECTED_CYCLE_PEAKS: ReadonlyArray<ProjectedRow> = [1, 2].map((lap) => ({
  title: `Projected peak (top + ${lap * THEORY_CYCLE_YEARS}y)`,
  detail: approxMonthYear(theoryPeakMs(lap)),
}));

/**
 * Projected (theoretical) cycle lows: each ~1y after a theory peak
 * → ~Oct 2026 (current-cycle theory trough), ~Oct 2030, ~Oct 2034.
 */
export const PROJECTED_CYCLE_LOWS: ReadonlyArray<ProjectedRow> = [0, 1, 2].map((lap) => ({
  title:
    lap === 0
      ? "Theory trough (top + 1y)"
      : `Projected low (top + ${lap * THEORY_CYCLE_YEARS + THEORY_DRAWDOWN_YEARS}y)`,
  detail: approxMonthYear(theoryTroughMs(lap)),
}));

export const PROJECTED_DATES_NOTE =
  "Projected dates are theoretical, based on equal ~4-year spacing — not a forecast. Research / educational only, not financial advice (NFA).";

export function cycleTopHoverRows(): CycleExtremeRow[] {
  return [...CYCLE_TOPS];
}

export function cycleBottomHoverRows(): CycleExtremeRow[] {
  return [...CYCLE_BOTTOMS];
}

export function projectedPeakHoverRows(): ProjectedRow[] {
  return [...PROJECTED_CYCLE_PEAKS];
}

export function projectedLowHoverRows(): ProjectedRow[] {
  return [...PROJECTED_CYCLE_LOWS];
}
