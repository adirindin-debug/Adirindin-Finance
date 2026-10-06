/**
 * Adirindin 46-year gold-led commodity cycle observational sketch.
 *
 * Peak-zone anchors (Jan-dated, LOCKED): 1934 → 1980 → 2026 → 2072 (~46y apart).
 *
 * ONE silhouette shape repeats on every ~46y lap — same approach as the bond
 * yield / real estate / BTC cycle charts (one ridge, many laps) — but each lap
 * steps UP by GOLD_STEP_UP (gold's extended secular uptrend / scarcity):
 *
 *   trough zone → first run-up → mid-cycle correction → second run-up (same shape)
 *             → peak zone → drawdown to a HIGHER low (~20y after the peak) → …
 *
 * So peaks and troughs both rise lap after lap: the drawdown never round-trips
 * to the cycle's starting low. Peak / trough TIMING is unchanged.
 *
 * Trough zones are derived from the shape (peak + GOLD_TROUGH_OFFSET_YEARS), not
 * separately locked — 2000 lines up with the 1999–2001 free-market low; 1954 sits
 * in the US$35 peg era (model position only).
 *
 * Observational sketch only — not “the Kondratiev law”, not Cardo IP, not a
 * price target model. Tweak anchors / knots HERE only. Educational · NFA.
 */

export const GOLD_CYCLE_YEARS = 46;

/**
 * Peak-zone anchors (calendar year of 1 Jan marker).
 * Locked peak-zone anchors — edit this array to move the whole clock.
 */
export const GOLD_PEAK_ANCHORS = [1934, 1980, 2026, 2072] as const;

export type GoldPeakAnchor = (typeof GOLD_PEAK_ANCHORS)[number];

/** Years from a peak-zone marker to the derived trough zone on the same lap. */
export const GOLD_TROUGH_OFFSET_YEARS = 20;

/** Trough position as a fraction along one peak→peak lap. */
export const GOLD_TROUGH_FRAC = GOLD_TROUGH_OFFSET_YEARS / GOLD_CYCLE_YEARS;

/** Last year treated as observed history (later markers are theoretical *). */
export const GOLD_LAST_OBSERVED_YEAR = 2026;

export function isTheoreticalGoldYear(year: number): boolean {
  return year > GOLD_LAST_OBSERVED_YEAR;
}

/**
 * Secular step-up per lap, in units of one post-peak drawdown (peak → trough = 1).
 * Each trough (and peak) sits this much above the one before, so a full
 * trough → peak advance is 1 + GOLD_STEP_UP and the drawdown retraces ~74% of it.
 */
export const GOLD_STEP_UP = 0.35;

/** Mid-cycle correction depth (same units). */
const GOLD_CORRECTION = 0.25;

/**
 * The two run-up legs have the same length and the same rise, with a short
 * correction between them: 2 × leg + correction = the trough → peak span.
 */
const ADVANCE_SPAN = 1 - GOLD_TROUGH_FRAC;
const CORRECTION_SPAN = 0.09; // ≈ 4y of the ~46y lap
const LEG_SPAN = (ADVANCE_SPAN - CORRECTION_SPAN) / 2;
const LEG_RISE = (1 + GOLD_STEP_UP + GOLD_CORRECTION) / 2;

/** Mid-cycle top (end of the first run-up). */
export const GOLD_MID_TOP_FRAC = GOLD_TROUGH_FRAC + LEG_SPAN;
/** Mid-cycle correction low (start of the second run-up). */
export const GOLD_MID_LOW_FRAC = GOLD_MID_TOP_FRAC + CORRECTION_SPAN;

/** One run-up leg: [fraction of leg, fraction of rise] — slow start, firm middle, rounded top. */
const LEG_TEMPLATE: [number, number][] = [
  [0, 0],
  [0.22, 0.1],
  [0.48, 0.38],
  [0.72, 0.7],
  [0.9, 0.93],
  [1, 1],
];

function leg(fromFrac: number, fromLevel: number): [number, number][] {
  return LEG_TEMPLATE.map(([a, b]) => [fromFrac + a * LEG_SPAN, fromLevel + b * LEG_RISE]);
}

/**
 * The single repeating lap, peak → next peak: [frac along the lap, level].
 * Level 1 = this lap's starting peak, 0 = its trough zone, 1 + GOLD_STEP_UP =
 * the next (higher) peak. Shape language only — not data.
 */
const SHAPE_KNOTS: [number, number][] = [
  // Post-peak drawdown: quick step down, then a long grind into the trough zone
  [0, 1],
  [0.025, 0.93],
  [0.06, 0.74],
  [0.11, 0.52],
  [0.17, 0.38],
  [0.26, 0.21],
  [0.35, 0.08],
  // First run-up from the trough zone
  ...leg(GOLD_TROUGH_FRAC, 0),
  // Mid-cycle correction, then the second run-up (same shape) into the next peak
  ...leg(GOLD_MID_LOW_FRAC, LEG_RISE - GOLD_CORRECTION),
];

/** Monotone cubic (Fritsch–Carlson) tangents → smooth, no overshoot. */
const SHAPE_TANGENTS: number[] = (() => {
  const k = SHAPE_KNOTS;
  const n = k.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((k[i + 1]![1] - k[i]![1]) / (k[i + 1]![0] - k[i]![0]));
  }
  const m: number[] = new Array(n).fill(0);
  // Flat tangent at the summits (frac 0 and 1) → rounded peak zones, same on every lap
  m[0] = 0;
  m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1]! * d[i]! <= 0 ? 0 : (d[i - 1]! + d[i]!) / 2;
  }
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

/**
 * Lap-relative level for a fraction along one peak→peak lap (see SHAPE_KNOTS):
 * 1 at the starting peak, 0 at the trough zone, 1 + GOLD_STEP_UP at frac 1.
 * Identical on every lap — this is the one repeating silhouette.
 */
export function goldLapLevel(frac: number): number {
  if (frac >= 1) return 1 + GOLD_STEP_UP;
  const f = Math.max(0, frac);
  const k = SHAPE_KNOTS;
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
    (t3 - 2 * t2 + t) * h * SHAPE_TANGENTS[i]! +
    (-2 * t3 + 3 * t2) * y1 +
    (t3 - t2) * h * SHAPE_TANGENTS[i + 1]!;
  return Math.min(1 + GOLD_STEP_UP, Math.max(0, v));
}

/**
 * Hub tile unit in [0, 1] for a fraction along the peak→peak lap, on ONE
 * trough → trough cycle: 0 = starting trough zone, 1 = peak zone. The advance
 * (frac ≥ trough) belongs to the lap before the peak; the drawdown (frac <
 * trough) ends at the next, higher trough ≈ GOLD_STEP_UP / (1 + GOLD_STEP_UP).
 */
export function goldTileUnit(frac: number): number {
  const f = ((frac % 1) + 1) % 1;
  const span = 1 + GOLD_STEP_UP;
  // Small tolerance: (TROUGH + 0) % 1 can land one ulp under the trough.
  return f >= GOLD_TROUGH_FRAC - 1e-9
    ? goldLapLevel(f) / span
    : (goldLapLevel(f) + GOLD_STEP_UP) / span;
}

/** Laps since the first locked anchor (1934 = 0, 1980 = 1, 2026 = 2, …). */
function lapIndex(peakYear: number): number {
  return Math.round((peakYear - GOLD_PEAK_ANCHORS[0]) / GOLD_CYCLE_YEARS);
}

/** Absolute model level of a peak zone (rises GOLD_STEP_UP per lap). */
export function goldPeakLevel(peakYear: number): number {
  return 1 + lapIndex(peakYear) * GOLD_STEP_UP;
}

/** Absolute model level of a trough zone (peak year + offset; higher every lap). */
export function goldTroughLevel(troughYear: number): number {
  return lapIndex(troughYear - GOLD_TROUGH_OFFSET_YEARS) * GOLD_STEP_UP;
}

/** Absolute model level for a lap's peak year + fraction along that lap. */
export function goldLevelOnLap(peakYear: number, frac: number): number {
  return lapIndex(peakYear) * GOLD_STEP_UP + goldLapLevel(frac);
}

export function janMs(year: number): number {
  return Date.UTC(year, 0, 1, 0, 0, 0, 0);
}

/** Expand anchors forward/back so Live / chart never fall off the ends. */
export function goldPeakYearsCovering(fromYear: number, toYear: number): number[] {
  const out: number[] = [...GOLD_PEAK_ANCHORS];
  let y = out[0]! - GOLD_CYCLE_YEARS;
  while (y >= fromYear - GOLD_CYCLE_YEARS) {
    out.unshift(y);
    y -= GOLD_CYCLE_YEARS;
  }
  y = out[out.length - 1]! + GOLD_CYCLE_YEARS;
  while (y <= toYear + GOLD_CYCLE_YEARS) {
    out.push(y);
    y += GOLD_CYCLE_YEARS;
  }
  return out;
}

export type GoldMarker = {
  year: number;
  kind: "peak" | "trough";
  /** Fraction along a peak→peak lap (0 for peaks, GOLD_TROUGH_FRAC for troughs). */
  frac: number;
  locked: boolean;
  theoretical: boolean;
};

/** All peak + trough zone markers whose Jan date falls within [fromYear, toYear]. */
export function goldMarkersBetween(fromYear: number, toYear: number): GoldMarker[] {
  const out: GoldMarker[] = [];
  for (const p of goldPeakYearsCovering(fromYear, toYear)) {
    const tr = p + GOLD_TROUGH_OFFSET_YEARS;
    if (p >= fromYear && p <= toYear) {
      out.push({
        year: p,
        kind: "peak",
        frac: 0,
        locked: (GOLD_PEAK_ANCHORS as readonly number[]).includes(p),
        theoretical: isTheoreticalGoldYear(p),
      });
    }
    if (tr >= fromYear && tr <= toYear) {
      out.push({
        year: tr,
        kind: "trough",
        frac: GOLD_TROUGH_FRAC,
        locked: false,
        theoretical: isTheoreticalGoldYear(tr),
      });
    }
  }
  return out.sort((a, b) => a.year - b.year);
}

/** Fractional calendar year (UTC) for a timestamp. */
function fracYear(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  const start = janMs(year);
  return year + (ms - start) / Math.max(janMs(year + 1) - start, 1);
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
  const y = fracYear(ms);
  const peaks = goldPeakYearsCovering(y - GOLD_CYCLE_YEARS, y + GOLD_CYCLE_YEARS);
  let i = 0;
  while (i < peaks.length - 2 && peaks[i + 1]! <= y) i++;
  const priorPeak = peaks[i]!;
  const nextPeak = peaks[i + 1]!;
  const frac = Math.min(0.9999, Math.max(0, (y - priorPeak) / (nextPeak - priorPeak)));
  return { priorPeak, nextPeak, frac };
}

/** Absolute model level at a timestamp (rising staircase of laps). */
export function goldModelLevelAt(ms: number): number {
  const { priorPeak, frac } = goldCycleProgress(ms);
  return goldLevelOnLap(priorPeak, frac);
}

/**
 * Level range to scale a chart window [fromMs, toMs]: the lowest / highest
 * model level inside it, widened to the trough a window starts after (or the
 * peak it ends before) while it sits mid-advance — so a short window shows
 * where it sits on the lap rather than stretching to fill the band.
 */
export function goldLevelRange(fromMs: number, toMs: number, samples: number[]): { lo: number; hi: number } {
  let lo = Math.min(...samples);
  let hi = Math.max(...samples);
  const a = goldCycleProgress(fromMs);
  if (a.frac >= GOLD_TROUGH_FRAC) lo = Math.min(lo, goldTroughLevel(a.priorPeak + GOLD_TROUGH_OFFSET_YEARS));
  const b = goldCycleProgress(toMs);
  if (b.frac >= GOLD_TROUGH_FRAC) hi = Math.max(hi, goldPeakLevel(b.nextPeak));
  return { lo, hi: hi > lo ? hi : lo + 1 };
}

export type GoldPhaseName = "Post-peak decline" | "Advance from trough" | "Final run to peak zone";

/** Mid-cycle correction low; the second run-up into the peak zone follows. */
export const GOLD_FINAL_RUN_FRAC = GOLD_MID_LOW_FRAC;

export function goldPhaseName(frac: number): GoldPhaseName {
  if (frac < GOLD_TROUGH_FRAC) return "Post-peak decline";
  if (frac < GOLD_FINAL_RUN_FRAC) return "Advance from trough";
  return "Final run to peak zone";
}

/** Next marker (trough or peak zone) ahead of the timestamp, sibling-style Live copy. */
export function goldLivePhaseLine(nowMs: number): string {
  const { priorPeak, nextPeak, frac } = goldCycleProgress(nowMs);
  const y = fracYear(nowMs);
  const troughYear = priorPeak + GOLD_TROUGH_OFFSET_YEARS;
  const toTrough = frac < GOLD_TROUGH_FRAC;
  const zoneYear = toTrough ? troughYear : nextPeak;
  const kind = toTrough ? "trough" : "peak";
  const years = Math.max(0, Math.round(zoneYear - y));
  const theo = isTheoreticalGoldYear(zoneYear) ? " theoretical" : "";
  const phase = goldPhaseName(frac);
  if (years < 1) return `Near ~${zoneYear}${theo} ${kind} zone · ${phase}`;
  return `~${years}y to ~${zoneYear}${theo} ${kind} zone · ${phase}`;
}


/** Extra historical data points (not peak/trough zone anchors). */
export type GoldHistoricalPoint = {
  /** UTC ms of the event. */
  t: number;
  /** Short on-chart label (Australian date style). */
  label: string;
  /** Longer note for the Cycle dates list. */
  note: string;
};

/**
 * 15 Aug 1971 — Nixon Shock / end of Bretton Woods dollar convertibility into gold.
 * The usual public date cited for the US leaving the gold standard. Observational
 * historical marker only — not a cycle peak or trough zone.
 */
export const GOLD_NIXON_SHOCK_MS = Date.UTC(1971, 7, 15, 0, 0, 0, 0);

export const GOLD_HISTORICAL_POINTS: readonly GoldHistoricalPoint[] = [
  {
    t: GOLD_NIXON_SHOCK_MS,
    label: "15 Aug 1971",
    note:
      "Nixon Shock — end of Bretton Woods dollar convertibility into gold; the usual public date for the US leaving the gold standard. Historical context only, not a cycle peak or trough zone.",
  },
];

export const GOLD_ANCHOR_NOTES: Record<number, string> = {
  1934:
    "Revaluation / policy era (US Gold Reserve Act lifted the official price to $35/oz) — not a free-market peak like 1980.",
  1980: "Free-market secular peak zone after the 1970s bull market.",
  2026:
    "Calendar peak-zone marker under study — not a guaranteed top. Markers and the gold series update as new public price data comes in; observational only, not a predictive model.",
  2072: "Theoretical next peak-zone marker from the ~46-year spacing — illustrative only.",
};

export const GOLD_TROUGH_NOTES: Record<number, string> = {
  1954: "Peg era (official US$35/oz) — model trough position only, not a market low.",
  2000: "Lines up with the 1999–2001 free-market low zone.",
  2046: "Theoretical trough zone from the repeating shape — illustrative only.",
};

export const GOLD_CAVEAT_SHORT =
  "Adirindin observational study · gold-led · ~46y peak zones · not Kondratiev-as-law · not a predictive model · NFA";

export const GOLD_SOURCE_LINE =
  "Gold USD: datasets/gold-prices (historical monthly) + Yahoo Finance GC=F for recent closes · peg-era levels are documented official/historical series, not invented";

export const GOLD_CAPTION =
  "Long-run gold (USD/oz, log) with an illustrative ~46-year gold-led commodity cycle silhouette — one shape repeating every lap, stepping up each time (run-up, mid-cycle correction, second run-up, then a drawdown to a higher low). Peak zones Jan 1934 / 1980 / 2026 / 2072*; trough zones ~1954 / ~2000 / ~2046*; historical marker 15 Aug 1971 (Nixon Shock / end of US$ gold convertibility). Observational study of public gold history — not a predictive model or forecast. Markers and the price series update as new data comes in.";
