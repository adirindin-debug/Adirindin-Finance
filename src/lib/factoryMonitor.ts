/**
 * Philly Fed Manufacturing monitor — shared levels, state machine and helpers.
 *
 * Data: Federal Reserve Bank of Philadelphia, Manufacturing Business Outlook
 * Survey, Current General Activity diffusion index (SA, monthly), via FRED
 * (GACDFSA066MSFRBPHI). This is NOT the ISM Manufacturing PMI; ISM data is
 * licensed and not used or shown anywhere on this site.
 *
 * Levels (how they were set):
 * An ISM-style diffusion index is 50 + (% higher − % lower) / 2, while the
 * Philly Fed index is (% higher − % lower), centred on zero. So an ISM-style
 * level L sits at roughly 2 × (L − 50) on the Philly Fed scale:
 *   60 → +20, 50 → 0, 46 → −8, 42 → −16.
 * Rounded to clean numbers (nearest 5): +20 / 0 / −10 / −15, then Late heat
 * raised to +25 to allow for the noisier single-question survey (about 19% of
 * months since 1968 at or above +25, vs about 27% at +20).
 * Lines used: +25 / 0 / −10 / −15.
 * These are research reference lines, not official thresholds.
 *
 * Educational only — not financial advice (NFA).
 */

export const FACTORY_SERIES_ID = "GACDFSA066MSFRBPHI";
export const FACTORY_FRED_URL = `https://fred.stlouisfed.org/series/${FACTORY_SERIES_ID}`;
export const FACTORY_PHILLY_URL =
  "https://www.philadelphiafed.org/surveys-and-data/regional-economic-analysis/manufacturing-business-outlook-survey";

/** Reference levels on the Philly Fed (zero-centred) scale. */
export const FACTORY_LEVELS = {
  lateHeat: 25,
  zero: 0,
  watch: -10,
  recession: -15,
} as const;

export const FACTORY_KEY_LINE =
  "≥+25 late heat · 0 expansion line · −10 watch · <−15 recession zone";

export const FACTORY_LEVELS_FOOTNOTE =
  "Levels converted from ISM-style reference lines (60 / 50 / 46 / 42) with diffusion-index arithmetic (Philly ≈ 2 × (ISM-style − 50)), rounded: ISM-style 60 converts to about +20, with Late heat set at +25 to allow for the noisier single-question survey (about 19% of months since 1968). Not official thresholds.";

export const FACTORY_NOT_ISM_NOTE =
  "This is the Philadelphia Fed manufacturing survey, not the ISM Manufacturing PMI. ISM data is licensed and not shown here. Readings are a diffusion index centred on zero.";

export const FACTORY_FOOTER =
  "Research tool. Not financial advice. Length of slumps is not a forecast date.";

export type FactoryStateKey =
  | "late-heat"
  | "expansion"
  | "soft"
  | "risk-off-watch"
  | "recession-zone";

export type FactoryState = {
  key: FactoryStateKey;
  label: string;
  color: string;
  note?: string;
};

export const FACTORY_STATES: Record<FactoryStateKey, FactoryState> = {
  "late-heat": {
    key: "late-heat",
    label: "Late heat",
    color: "#f87171",
    note: "Not a dated top",
  },
  expansion: { key: "expansion", label: "Expansion", color: "#2dd4bf" },
  soft: {
    key: "soft",
    label: "Soft / stagnation",
    color: "#fbbf24",
    note: "Manufacturing contracting. Not automatically NBER recession",
  },
  "risk-off-watch": {
    key: "risk-off-watch",
    label: "Risk-off watch",
    color: "#fb923c",
  },
  "recession-zone": {
    key: "recession-zone",
    label: "Recession zone",
    color: "#ef4444",
  },
};

export function factoryState(v: number): FactoryState {
  if (v >= FACTORY_LEVELS.lateHeat) return FACTORY_STATES["late-heat"];
  if (v >= FACTORY_LEVELS.zero) return FACTORY_STATES.expansion;
  if (v >= FACTORY_LEVELS.watch) return FACTORY_STATES.soft;
  if (v >= FACTORY_LEVELS.recession) return FACTORY_STATES["risk-off-watch"];
  return FACTORY_STATES["recession-zone"];
}

/** Monthly observation: month key "YYYY-MM" and reading. */
export type FactoryPoint = { m: string; v: number };

export type FactoryPayload = {
  ok: boolean;
  seriesId?: string;
  points?: FactoryPoint[];
  asOf?: string; // YYYY-MM of the latest observation
  origin?: string;
  snapshot?: boolean;
  source?: string;
  error?: string;
  warnings?: string[];
};

export const FACTORY_SOURCE_LINE = (asOfLabel: string) =>
  `Source: Federal Reserve Bank of Philadelphia, Manufacturing Business Outlook Survey, via FRED (${FACTORY_SERIES_ID}). As of ${asOfLabel}.`;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-09" → "Sep 2026" (no locale/timezone drift). */
export function fmtMonthKey(m: string): string {
  const [y, mo] = m.split("-");
  const idx = Number(mo) - 1;
  return `${MONTHS[idx] ?? mo} ${y}`;
}

/** Signed reading with a true minus sign, one decimal. */
export function fmtReading(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v > 0) return `+${v.toFixed(1)}`;
  if (v < 0) return `−${Math.abs(v).toFixed(1)}`;
  return "0.0";
}

/** Month key → month index (months since year 0) for x-axis maths. */
export function monthIndex(m: string): number {
  const [y, mo] = m.split("-");
  return Number(y) * 12 + (Number(mo) - 1);
}

/** Consecutive months, counting back from the latest, where pred holds. */
export function trailingRun(
  points: FactoryPoint[],
  pred: (v: number) => boolean,
): number {
  let n = 0;
  for (let i = points.length - 1; i >= 0; i--) {
    if (!pred(points[i]!.v)) break;
    n++;
  }
  return n;
}

/**
 * Card hover summary, e.g.
 * "Sep 2026 · +37.8 · 4 months above 0 · 11 months not below −10".
 * Counts are computed from the data; wording adapts to the current state.
 */
export function factorySummary(points: FactoryPoint[]): string | null {
  const last = points[points.length - 1];
  if (!last) return null;
  const head = `${fmtMonthKey(last.m)} · ${fmtReading(last.v)}`;
  const plural = (n: number) => (n === 1 ? "month" : "months");
  const capped = (n: number) =>
    n >= points.length ? `${n}+ ${plural(n)}` : `${n} ${plural(n)}`;
  const watch = FACTORY_LEVELS.watch;
  if (last.v > 0) {
    const above = trailingRun(points, (v) => v > 0);
    const notBelow = trailingRun(points, (v) => v >= watch);
    return `${head} · ${capped(above)} above 0 · ${capped(notBelow)} not below −${Math.abs(watch)}`;
  }
  const atOrBelow = trailingRun(points, (v) => v <= 0);
  if (last.v >= watch) {
    const notBelow = trailingRun(points, (v) => v >= watch);
    return `${head} · ${capped(atOrBelow)} at or below 0 · ${capped(notBelow)} not below −${Math.abs(watch)}`;
  }
  const below = trailingRun(points, (v) => v < watch);
  return `${head} · ${capped(atOrBelow)} at or below 0 · ${capped(below)} below −${Math.abs(watch)}`;
}

/**
 * NBER US business cycle recessions since the survey began (peak month →
 * trough month). Public dates from https://www.nber.org/research/data/us-business-cycle-expansions-and-contractions
 * Shown as grey context bands only — not a signal.
 */
export const NBER_RECESSIONS: ReadonlyArray<{ start: string; end: string }> = [
  { start: "1969-12", end: "1970-11" },
  { start: "1973-11", end: "1975-03" },
  { start: "1980-01", end: "1980-07" },
  { start: "1981-07", end: "1982-11" },
  { start: "1990-07", end: "1991-03" },
  { start: "2001-03", end: "2001-11" },
  { start: "2007-12", end: "2009-06" },
  { start: "2020-02", end: "2020-04" },
];
