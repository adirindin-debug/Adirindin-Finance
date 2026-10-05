/**
 * Compound interest maths for /tools/compound-interest.
 * Pure functions only — no fetching. Illustrative projections, not advice (NFA).
 */

export type ContributionFrequency = "weekly" | "fortnightly" | "monthly" | "annually";
export type CompoundingFrequency = "monthly" | "annually";

export const CONTRIBUTION_PER_YEAR: Record<ContributionFrequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  annually: 1,
};

export const COMPOUNDING_PER_YEAR: Record<CompoundingFrequency, number> = {
  monthly: 12,
  annually: 1,
};

/**
 * Default inflation for the optional real-value view: 2.5% p.a.
 * Midpoint of the Reserve Bank of Australia's 2–3% CPI target band, and close to
 * Australia's average annual CPI inflation since inflation targeting began in 1993
 * (ABS Consumer Price Index, roughly 2.5–3% a year over that span). Editable in the UI.
 */
export const DEFAULT_INFLATION_PCT = 2.5;

export const MAX_YEARS = 100;

export type ProjectionInput = {
  initial: number;
  contribution: number;
  contributionFrequency: ContributionFrequency;
  /** Annual rate in percent (e.g. 7 = 7%). Unlimited upward; values ≤ −100% wipe the balance. */
  annualRatePct: number;
  /**
   * "nominal": bank-style nominal rate split evenly across compounding periods (rate ÷ n),
   * the usual savings-calculator convention.
   * "effective": the rate is an effective annual growth rate (e.g. a historical CAGR), so the
   * per-period rate is (1 + r)^(1/n) − 1 and compounding frequency does not inflate it.
   */
  rateBasis: "nominal" | "effective";
  compounding: CompoundingFrequency;
  years: number;
  /** Optional inflation in percent p.a. for real (today's dollars) values; null = off. */
  inflationPct: number | null;
};

export type ProjectionPoint = {
  year: number;
  contributions: number;
  balance: number;
  /** Balance deflated to today's dollars (only when inflation is on). */
  real: number | null;
};

export type ProjectionResult = {
  points: ProjectionPoint[];
  finalBalance: number;
  totalContributions: number;
  totalGrowth: number;
  finalReal: number | null;
  periodRate: number;
};

/** Parse a user-typed number; blank / junk → 0. Accepts "10,000" and "$500". */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[$,\s%]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function periodRateFor(annualRatePct: number, basis: "nominal" | "effective", periodsPerYear: number): number {
  const r = annualRatePct / 100;
  if (basis === "nominal") return Math.max(-1, r / periodsPerYear);
  if (r <= -1) return -1;
  return Math.pow(1 + r, 1 / periodsPerYear) - 1;
}

/**
 * Project a balance with an initial deposit plus regular deposits.
 * Deposits are made at the end of each contribution period; growth is credited at the end of
 * each compounding period on the balance held through that period (deposits land after growth).
 * Weekly deposits under monthly compounding fall 4 or 5 to a month, as on a calendar.
 */
export function projectGrowth(input: ProjectionInput): ProjectionResult {
  const years = Math.max(0, Math.min(MAX_YEARS, Math.floor(input.years || 0)));
  const n = COMPOUNDING_PER_YEAR[input.compounding];
  const f = CONTRIBUTION_PER_YEAR[input.contributionFrequency];
  const i = periodRateFor(input.annualRatePct, input.rateBasis, n);
  const inf = input.inflationPct == null ? null : input.inflationPct / 100;
  const initial = Math.max(0, input.initial || 0);
  const contribution = Math.max(0, input.contribution || 0);

  const deflate = (v: number, t: number) => {
    if (inf == null) return null;
    const d = Math.pow(1 + inf, t);
    return d > 0 && Number.isFinite(d) ? v / d : null;
  };

  let balance = initial;
  let contributions = initial;
  let depositsMade = 0;
  const points: ProjectionPoint[] = [{ year: 0, contributions, balance, real: deflate(balance, 0) }];

  const totalPeriods = years * n;
  for (let k = 1; k <= totalPeriods; k++) {
    balance = balance * (1 + i);
    if (!(balance > 0)) balance = 0; // −100% or worse wipes it, never negative
    const due = Math.floor((k * f) / n + 1e-9);
    const newDeposits = due - depositsMade;
    if (newDeposits > 0) {
      balance += newDeposits * contribution;
      contributions += newDeposits * contribution;
      depositsMade = due;
    }
    if (k % n === 0) {
      const year = k / n;
      points.push({ year, contributions, balance, real: deflate(balance, year) });
    }
  }

  const last = points[points.length - 1]!;
  return {
    points,
    finalBalance: last.balance,
    totalContributions: last.contributions,
    totalGrowth: last.balance - last.contributions,
    finalReal: last.real,
    periodRate: i,
  };
}

/** Compound annual growth rate between two prices over a span in years. */
export function cagr(startPrice: number, endPrice: number, years: number): number | null {
  if (!(startPrice > 0) || !(endPrice > 0) || !(years > 0)) return null;
  return Math.pow(endPrice / startPrice, 1 / years) - 1;
}

export type PricePoint = { t: number; c: number };

/**
 * CAGR from a sorted daily series over the trailing `lookbackYears` (clamped to the data).
 * Uses the first valid close on/after the window start and the last valid close.
 */
export function cagrFromSeries(
  points: PricePoint[],
  lookbackYears: number | null,
): {
  cagr: number;
  start: PricePoint;
  end: PricePoint;
  yearsUsed: number;
  availableYears: number;
  clamped: boolean;
} | null {
  if (points.length < 2) return null;
  const first = points[0]!;
  const end = points[points.length - 1]!;
  const yearSec = 365.25 * 86400;
  const availableYears = (end.t - first.t) / yearSec;
  let start = first;
  let clamped = false;
  if (lookbackYears != null && lookbackYears > 0) {
    if (lookbackYears >= availableYears) {
      clamped = lookbackYears > availableYears + 0.02;
    } else {
      const target = end.t - lookbackYears * yearSec;
      start = points.find((p) => p.t >= target) ?? first;
    }
  }
  const yearsUsed = (end.t - start.t) / yearSec;
  const g = cagr(start.c, end.c, yearsUsed);
  if (g == null) return null;
  return { cagr: g, start, end, yearsUsed, availableYears, clamped };
}
