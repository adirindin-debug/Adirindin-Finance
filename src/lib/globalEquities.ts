/**
 * Global equities · sentiment state — shared phase rules and maths.
 *
 * Price spine: iShares MSCI World ETF (URTH), adjusted close (dividends
 * reinvested), as a labelled PROXY for MSCI World. Official MSCI index data
 * needs a licence to redistribute (https://www.msci.com/legal/index-terms),
 * so it is not used. URTH history begins 12 Jan 2012, so "ATH" means the
 * highest adjusted close since then.
 *
 * Sentiment: CBOE VIX close via FRED (VIXCLS; "Copyrighted: Citation
 * required") and its percentile against the prior 5 years of daily closes.
 * Sentiment only tilts the label one notch; drawdown is the primary key.
 * No CNN Fear & Greed (no clean public feed) and no crypto Fear & Greed.
 *
 * Heuristic state from price and public sentiment. Not a psychology model.
 * No top/bottom dates. Not financial advice.
 */

/** One trading day: date (YYYY-MM-DD), URTH adj close, VIX close, VIX 5y percentile (0–100). */
export type EqRow = [string, number, number | null, number | null];

export type PhaseKey =
  | "peak"
  | "cooling"
  | "stress"
  | "washout"
  | "capitulation";

export type Phase = { key: PhaseKey; label: string; color: string; band: string };

export const PHASES: Record<PhaseKey, Phase> = {
  peak: { key: "peak", label: "Peak / late heat", color: "#f87171", band: "0% to −5%" },
  cooling: { key: "cooling", label: "Cooling", color: "#fbbf24", band: "−5% to −12%" },
  stress: { key: "stress", label: "Stress", color: "#fb923c", band: "−12% to −20%" },
  washout: { key: "washout", label: "Washout", color: "#a78bfa", band: "−20% to −30%" },
  capitulation: {
    key: "capitulation",
    label: "Capitulation zone",
    color: "#e879f9",
    band: "worse than −30%",
  },
};

export const REPAIR_COLOR = "#2dd4bf";

/** Drawdown band edges (fractions). */
export const DD_LEVELS = [-0.05, -0.12, -0.2, -0.3] as const;

/** VIX tilt thresholds (5-year percentile and absolute spike level). */
export const VIX_VERY_LOW_PCT = 10;
export const VIX_NERVOUS_PCT = 75;
export const VIX_SPIKE_PCT = 90;
export const VIX_SPIKE_LEVEL = 30;
export const VIX_ELEVATED_PCT = 60;

/** Repair: still >12% below ATH, ≥5% off the low since the ATH, higher than 3 months (63 sessions) ago. */
export const REPAIR_BOUNCE = 0.05;
export const REPAIR_LOOKBACK = 63;

export const EQ_FOOTER =
  "Heuristic state from price and public sentiment. Not a psychology model. Not financial advice.";

export function phaseFromDd(dd: number): Phase {
  if (dd > -0.05) return PHASES.peak;
  if (dd > -0.12) return PHASES.cooling;
  if (dd > -0.2) return PHASES.stress;
  if (dd > -0.3) return PHASES.washout;
  return PHASES.capitulation;
}

export type EqPoint = {
  d: string;
  px: number;
  ath: number;
  dd: number; // fraction, ≤ 0
  vix: number | null;
  vixPct: number | null;
  phase: Phase;
  repair: boolean;
  /** One-notch tilt / tag text, or null. */
  tag: string | null;
};

function tagFor(
  phase: Phase,
  repair: boolean,
  vix: number | null,
  vixPct: number | null,
  vixPrev: number | null,
): string | null {
  if (repair) {
    return vixPct != null && vixPct >= VIX_ELEVATED_PCT
      ? "Repair · fear still high (normal here)"
      : "Repair";
  }
  if (vix == null || vixPct == null) {
    return phase.key === "capitulation" ? "Extreme" : null;
  }
  switch (phase.key) {
    case "peak":
      if (vixPct <= VIX_VERY_LOW_PCT) return "Heat+ · vol very low (complacent)";
      if (vixPct >= VIX_NERVOUS_PCT) return "Heat but nervous · vol elevated";
      return null;
    case "cooling":
      return vixPrev != null && vix > vixPrev && vixPct >= 50
        ? "Cooling · vol rising"
        : null;
    case "stress":
      return null;
    case "washout":
      return vixPct >= VIX_SPIKE_PCT || vix >= VIX_SPIKE_LEVEL
        ? "Washout+ · vol spike"
        : null;
    case "capitulation":
      return "Extreme";
  }
}

/** Running ATH, drawdown, phase, Repair flag and tilt for every day. */
export function enrich(rows: EqRow[]): EqPoint[] {
  const out: EqPoint[] = [];
  let ath = -Infinity;
  let lowSinceAth = Infinity;
  for (let i = 0; i < rows.length; i++) {
    const [d, px, vix, vixPct] = rows[i]!;
    if (px > ath) {
      ath = px;
      lowSinceAth = px;
    }
    lowSinceAth = Math.min(lowSinceAth, px);
    const dd = px / ath - 1;
    const phase = phaseFromDd(dd);
    const back = i >= REPAIR_LOOKBACK ? rows[i - REPAIR_LOOKBACK]![1] : null;
    const repair =
      dd <= -0.12 &&
      px >= lowSinceAth * (1 + REPAIR_BOUNCE) &&
      back != null &&
      px > back;
    const vixPrev = i >= 21 ? rows[i - 21]![2] : null;
    out.push({
      d,
      px,
      ath,
      dd,
      vix,
      vixPct,
      phase,
      repair,
      tag: tagFor(phase, repair, vix, vixPct, vixPrev),
    });
  }
  return out;
}

function sma(vals: number[], n: number): number | null {
  if (vals.length < n) return null;
  let s = 0;
  for (let i = vals.length - n; i < vals.length; i++) s += vals[i]!;
  return s / n;
}

/** Last close of each ISO week (Mon–Sun), for the 200-week MA. */
function weeklyCloses(points: EqPoint[]): number[] {
  const out: number[] = [];
  let lastKey = "";
  for (const p of points) {
    const t = Date.parse(`${p.d}T00:00:00Z`);
    const day = (new Date(t).getUTCDay() + 6) % 7; // Mon=0
    const monday = new Date(t - day * 86400000).toISOString().slice(0, 10);
    if (monday === lastKey) out[out.length - 1] = p.px;
    else {
      out.push(p.px);
      lastKey = monday;
    }
  }
  return out;
}

export type EqSummary = {
  date: string;
  px: number;
  ath: number;
  athDate: string;
  dd: number;
  ret12m: number | null;
  ma200d: number | null;
  dist200d: number | null;
  ma200w: number | null;
  dist200w: number | null;
  vix: number | null;
  vixPct: number | null;
  phase: Phase;
  repair: boolean;
  tag: string | null;
};

export function summarise(points: EqPoint[]): EqSummary | null {
  const last = points[points.length - 1];
  if (!last) return null;
  let athDate = points[0]!.d;
  for (const p of points) if (p.px >= p.ath) athDate = p.d;
  // 12-month total return: last close vs the last close on/before the same date a year earlier.
  const target = new Date(Date.parse(`${last.d}T00:00:00Z`) - 365 * 86400000)
    .toISOString()
    .slice(0, 10);
  let base: EqPoint | null = null;
  for (const p of points) {
    if (p.d <= target) base = p;
    else break;
  }
  const closes = points.map((p) => p.px);
  const ma200d = sma(closes, 200);
  const ma200w = sma(weeklyCloses(points), 200);
  return {
    date: last.d,
    px: last.px,
    ath: last.ath,
    athDate,
    dd: last.dd,
    ret12m: base ? last.px / base.px - 1 : null,
    ma200d,
    dist200d: ma200d ? last.px / ma200d - 1 : null,
    ma200w,
    dist200w: ma200w ? last.px / ma200w - 1 : null,
    vix: last.vix,
    vixPct: last.vixPct,
    phase: last.phase,
    repair: last.repair,
    tag: last.tag,
  };
}

export type EqPayload = {
  ok: boolean;
  rows?: EqRow[];
  asOf?: string;
  vixAsOf?: string | null;
  origin?: string;
  snapshot?: boolean;
  priceSource?: string;
  vixSource?: string;
  error?: string;
  warnings?: string[];
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-30" → "30 Sep 2026". */
export function fmtDay(d: string): string {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${MON[Number(m) - 1] ?? m} ${y}`;
}

/** Signed percent with a true minus, one decimal. */
export function fmtPct(f: number | null | undefined): string {
  if (f == null || !Number.isFinite(f)) return "—";
  const v = f * 100;
  if (Math.abs(v) < 0.05) return "0.0%";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
}

export function fmtPx(n: number): string {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Card hover: "30 Sep 2026 · URTH 206.23 · −2.5% from ATH · VIX 16.0 (5y p33) · Peak / late heat". */
export function eqHoverLine(s: EqSummary): string {
  const vix =
    s.vix != null
      ? `VIX ${s.vix.toFixed(1)}${s.vixPct != null ? ` (5y p${Math.round(s.vixPct)})` : ""}`
      : "VIX —";
  return `${fmtDay(s.date)} · URTH ${fmtPx(s.px)} · ${fmtPct(s.dd)} from ATH · ${vix} · ${s.phase.label}${s.tag ? ` · ${s.tag}` : ""}`;
}
