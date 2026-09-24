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
  { title: "Cycle top", detail: "Sun 17 Dec 2017" },
  { title: "Cycle top", detail: "Wed 10 Nov 2021" },
  { title: "Cycle top", detail: "Mon 6 Oct 2025" },
];

/**
 * Cycle bottoms (chronological).
 */
export const CYCLE_BOTTOMS: ReadonlyArray<CycleExtremeRow> = [
  { title: "Cycle bottom", detail: "Fri 29 Nov 2013" },
  { title: "Cycle bottom", detail: "Wed 14 Jan 2015" },
  { title: "Cycle bottom", detail: "Sat 15 Dec 2018" },
  { title: "Cycle bottom", detail: "Mon 21 Nov 2022" },
  { title: "Current bottom", detail: "Wed 1 Jul 2026" },
];

export const CYCLE_EXTREMES_DISCLAIMER =
  "Based on data available to this desk. Different exchanges sometimes print different top/bottom dates. Educational only · NFA.";

export function cycleTopHoverRows(): CycleExtremeRow[] {
  return [...CYCLE_TOPS];
}

export function cycleBottomHoverRows(): CycleExtremeRow[] {
  return [...CYCLE_BOTTOMS];
}
