/**
 * Adirindin 46-year gold-led commodity cycle observational sketch.
 *
 * Peak-zone anchors (Jan-dated, LOCKED): 1934 → 1980 → 2026 → 2072 (~46y apart).
 *
 * ONE silhouette shape repeats identically on every ~46y lap — same approach as
 * the bond yield / real estate / BTC cycle charts (one ridge, many laps):
 *
 *   peak zone → post-peak decline → trough zone (~20y after the peak)
 *             → primary advance → mid-run correction (shoulder) → final run → next peak zone
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
 * The single repeating silhouette: [frac along peak→peak lap, unit height]
 * (0 = trough zone, 1 = peak zone). Shape language only — not data.
 */
const SHAPE_KNOTS: [number, number][] = [
  [0, 1],
  [0.025, 0.93],
  [0.06, 0.74],
  [0.11, 0.52],
  [0.17, 0.38],
  [0.26, 0.21],
  [0.35, 0.08],
  [GOLD_TROUGH_FRAC, 0],
  [0.5, 0.05],
  [0.57, 0.19],
  [0.64, 0.39],
  [0.7, 0.53],
  [0.755, 0.585],
  [0.8, 0.6],
  [0.85, 0.67],
  [0.91, 0.81],
  [0.955, 0.92],
  [0.983, 0.98],
  [1, 1],
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
  // Flat tangent at the summit (frac 0 ≡ 1) → rounded peak zone, same on every lap
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
 * Model unit in [0, 1] for a fraction along one peak→peak lap.
 * Identical on every lap — this is the one repeating silhouette.
 */
export function goldModelUnit(frac: number): number {
  const f = ((frac % 1) + 1) % 1;
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
  return Math.min(1, Math.max(0, v));
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

/** Model unit at an absolute timestamp. */
export function goldModelUnitAt(ms: number): number {
  return goldModelUnit(goldCycleProgress(ms).frac);
}

export type GoldPhaseName =
  | "Post-peak decline"
  | "Range-bound zone"
  | "Advance from trough"
  | "Final run to peak zone";

/**
 * Silhouette geometry shared with the tile (src/lib/cycles/goldSilhouette.ts):
 * the peak sits at tile s = 0.38 and the sharp post-peak drop ends at s = 0.50 — the
 * knot where the long "down-sideways" drift (rebound hump, ripples, later hump) begins.
 */
export const GOLD_TILE_PEAK_S = 0.38;
export const GOLD_TILE_RANGE_START_S = 0.5;
/**
 * Range-bound zone start as a fraction of the peak→peak lap. The tile maps the peak→trough
 * leg (GOLD_TROUGH_FRAC of the lap) linearly onto s 0.38 → 1, so
 * (0.50 − 0.38) ÷ (1 − 0.38) × 20y ≈ 3.9 years after each peak.
 */
export const GOLD_RANGE_START_FRAC =
  ((GOLD_TILE_RANGE_START_S - GOLD_TILE_PEAK_S) / (1 - GOLD_TILE_PEAK_S)) * (GOLD_TROUGH_OFFSET_YEARS / GOLD_CYCLE_YEARS);
/** Years from a peak-zone marker to the start of the range-bound zone (≈ 3.9). */
export const GOLD_DECLINE_YEARS = GOLD_RANGE_START_FRAC * GOLD_CYCLE_YEARS;
/** Years of the range-bound zone, to the next trough zone (≈ 16.1). */
export const GOLD_RANGE_YEARS = GOLD_TROUGH_OFFSET_YEARS - GOLD_DECLINE_YEARS;

/** Mid-run correction shoulder ends here; final run into the peak zone follows. */
export const GOLD_FINAL_RUN_FRAC = 0.8;

export function goldPhaseName(frac: number): GoldPhaseName {
  if (frac < GOLD_RANGE_START_FRAC) return "Post-peak decline";
  if (frac < GOLD_TROUGH_FRAC) return "Range-bound zone";
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
    "Calendar peak-zone marker under study — not a guaranteed top. Observational only, not a predictive model.",
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
  "Long-run gold (USD/oz, log) with an illustrative ~46-year gold-led commodity cycle silhouette — one shape repeating every lap. Peak zones Jan 1934 / 1980 / 2026 / 2072*; trough zones ~1954 / ~2000 / ~2046*; historical marker 15 Aug 1971 (Nixon Shock / end of US$ gold convertibility). Observational study of public gold history — not a predictive model or forecast. Markers and the price series update as new data comes in.";
