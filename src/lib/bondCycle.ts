/**
 * US 10-year Treasury yield secular regime sketch: dates for the theory chart.
 * Source framing: Anthony's research pack (1 Oct 2026). Observation, not a named law.
 *
 * Regime markers are Jan-dated zones on ~40-year half-swings (~80-year full loop):
 *   trough zone 1 Jan 1940 → peak zone 1 Jan 1980 → trough zone 1 Jan 2020
 *   → peak zone 1 Jan 2060 (THEORETICAL) → trough zone 1 Jan 2100 (THEORETICAL) → …
 * The only yield figures allowed are the two historical FRED DGS10 prints below.
 * No yield target or number for any future date (regime direction only) · NFA.
 */

export const HALF_SWING_YEARS = 40;
export const FULL_CYCLE_YEARS = HALF_SWING_YEARS * 2;

/** Trough zone that starts the current lap (lap 0). */
export const ANCHOR_TROUGH_YEAR = 2020;
/** Last historical marker year; later markers are theoretical. */
export const LAST_HISTORICAL_MARKER_YEAR = 2020;

/** 1 Jan of a year as UTC ms (regime zones are Jan-dated). */
export function janMs(year: number): number {
  return Date.UTC(year, 0, 1, 0, 0, 0, 0);
}

export type BondLap = {
  lap: number;
  startYear: number;
  peakYear: number;
  endYear: number;
};

/** Lap k: trough (2020 + 80k) → peak (2060 + 80k) → trough (2100 + 80k). */
export function bondLap(lap: number): BondLap {
  const startYear = ANCHOR_TROUGH_YEAR + lap * FULL_CYCLE_YEARS;
  return {
    lap,
    startYear,
    peakYear: startYear + HALF_SWING_YEARS,
    endYear: startYear + FULL_CYCLE_YEARS,
  };
}

/**
 * Active lap for a timestamp: the lap whose [start trough, end trough) contains it.
 * Clamped to lap 0 before Jan 2020 (the chart only walks the current loop forward).
 * Switches to the next lap at 1 Jan 2100, 1 Jan 2180, …
 */
export function bondLapIndexAt(ms: number): number {
  let lap = Math.max(0, Math.floor((ms - janMs(ANCHOR_TROUGH_YEAR)) / (FULL_CYCLE_YEARS * 365.2425 * 86_400_000)));
  while (lap > 0 && janMs(bondLap(lap).startYear) > ms) lap -= 1;
  while (janMs(bondLap(lap).endYear) <= ms) lap += 1;
  return lap;
}

export function isTheoreticalYear(year: number): boolean {
  return year > LAST_HISTORICAL_MARKER_YEAR;
}

export type BondCycleRow = { title: string; detail: string; print?: boolean };

/** Peak-zone history (FRED DGS10 actual high cited). */
export const BOND_PEAK_HISTORY: ReadonlyArray<BondCycleRow> = [
  { title: "Peak zone (regime)", detail: "Jan 1980" },
  { title: "Actual high · FRED DGS10", detail: "Sep 1981 · 15.84%", print: true },
];

/** Trough-zone history (FRED DGS10 actual low cited). */
export const BOND_TROUGH_HISTORY: ReadonlyArray<BondCycleRow> = [
  { title: "Trough zone (regime)", detail: "Jan 1940" },
  { title: "Trough zone (regime)", detail: "Jan 2020" },
  { title: "Actual low · FRED DGS10", detail: "Aug 2020 · 0.52%", print: true },
];

const monthYear = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});

/** "~Jan 2060" — theoretical regime-zone date, no yield attached. */
export function approxMonthYear(ms: number): string {
  return `~${monthYear.format(new Date(ms))}`;
}

/**
 * Projected (theoretical) rows for the active lap: next peak zone and the
 * trough zone that ends the lap. Lap 0 → ~Jan 2060 peak zone, ~Jan 2100 trough zone.
 */
export function projectedBondRows(lap: number = 0): BondCycleRow[] {
  const l = bondLap(lap);
  return [
    { title: "Peak zone (theoretical)", detail: approxMonthYear(janMs(l.peakYear)) },
    { title: "Trough zone (theoretical)", detail: approxMonthYear(janMs(l.endYear)) },
  ];
}

export const BOND_PROJECTED_NOTE =
  "Projected dates are theoretical, based on the observed ~40-year half-swings — no yield target. Research / educational only, not financial advice (NFA).";

export const BOND_HISTORY_NOTE =
  "Regime zones are Jan-dated markers; actual extremes printed later (Sep 1981 high, Aug 2020 low). Prints cited to FRED DGS10 / Fed H.15.";

export const BOND_SOURCE_LINE =
  "Source framing: FRED DGS10 / Fed H.15 · Homer & Sylla · educational sketch";

export const BOND_CAPTION =
  "US long-rate secular regime sketch. 40-year half-swings observed on the chart. 2060 marker theoretical.";
