/**
 * Power Level — a light-hearted "scouter" reading of standard of living, 0–100,000.
 *
 * Everything runs in the browser. Nothing is stored or sent. For fun and education only:
 * not financial advice and not a measure of anyone's worth as a person.
 *
 * ── How the score is built (all money in AUD) ──────────────────────────────────────────
 *
 * 1. Net worth (NW)
 *      NW = cash + investments + home value (if owned) − mortgage
 *           + car value − car loan − other debts
 *
 * 2. Household sharing. Wealth and income are shared across the household, so both are
 *    divided by √(household size), the OECD "square-root" equivalence scale:
 *      NW_eq = NW ÷ √n,  income_eq = after-tax income ÷ √n
 *
 * 3. Effective wealth (E). Income counts as capitalised earning power: each dollar of
 *    after-tax income is worth INCOME_YEARS (3) dollars in the stockpile:
 *      E_base = max(0, NW_eq + 3 × income_eq)
 *
 * 4. Habit multipliers (each roughly ±10–15%, so habits nudge rather than dominate):
 *      runway  = liquid assets (cash + investments) ÷ monthly spending, in months
 *      M_runway  = 0.85 + 0.30 × min(1, log10(1 + runway) ÷ log10(1 + 120))
 *                  (0 months → ×0.85, 10+ years → ×1.15)
 *      savings rate s = (after-tax income − 12 × monthly spending) ÷ after-tax income
 *      M_savings = 1 + 0.30 × clamp(s, −0.5, 0.6)   (×0.85 … ×1.18; ×1 with no income)
 *      body fat % (optional): left blank → ×1.0. Otherwise a smooth lifestyle nudge
 *        (NOT medical advice, NOT a health claim):
 *        M_bf = clamp(1 + 0.11·e^(−((bf−15)/6.5)²)
 *                       − 0.12·σ((bf−26)/4.5)
 *                       − 0.07·σ((6.5−bf)/2),  0.90, 1.12)
 *        where σ(z) = softplus(z)/(1+softplus(z)). Peaks ≈ ×1.10 near 15%; athletic
 *        ~12–18% lifts; very high (~35%+) holds back toward ×0.90–0.92; extremely low
 *        (<6%) also holds back slightly (unsustainable), not a reward.
 *      E = E_base × M_runway × M_savings × M_bf
 *
 * 5. One smooth curve from E to the 0–100,000 reading, on a log scale of wealth.
 *    With x = log10(1 + E):
 *      raw(x) = 60,000 ÷ (1 + e^(−3.3 · (x − 6.15)))            — logistic "climb", centred ≈ A$1.4M
 *             + 9,600 · 0.53 · ln(1 + e^((x − 4.65) ÷ 0.53))     — softplus tail, ≈ 9,600 per ×10
 *      P = 100,000 × (raw(x) − raw(0)) ÷ (raw(log10(1 + E_CAP)) − raw(0))
 *    Both terms are smooth and always rising, so there are no kinks or jumps. The climb is
 *    steepest around A$1–1.5M (≈ 45,000 points per ×10 in wealth, ≈ 13,000 per doubling) and
 *    flattens to ≈ 7,500 points per ×10 at the top.
 *    E_CAP = A$600 billion (about US$400B+ at recent exchange rates).
 *    The reading is capped at 99,999 on screen; 100,000 is the theoretical maximum.
 *
 * Calibration (illustrative personas): no income or assets → 0; a uni student renting
 * → ~3.4k; a median-ish Aussie household → ~20k; a homeowner millionaire → ~41k;
 * A$10M → ~62k; A$100M → ~72k; A$1B → ~79k; the top 10 billionaires → high 90s;
 * Elon-level wealth → 99,999.
 *
 * Gross income is converted to after-tax with 2026–27 Australian resident rates
 * (ATO), the low income tax offset and a 2% Medicare levy with the 2025–26 single
 * low-income shade-in — treated as one taxpayer, so it is a rough estimate only.
 */

export type HomeStatus = "rent" | "own" | "mortgage" | "family" | "homeless";
export type IncomeBasis = "net" | "gross";

export type PowerInputs = {
  income: number; // annual
  incomeBasis: IncomeBasis;
  monthlySpend: number;
  cash: number;
  investments: number;
  home: HomeStatus;
  homeValue: number;
  mortgage: number;
  carValue: number;
  carLoan: number;
  otherDebts: number;
  householdSize: number;
  /** Optional body-fat %, blank/null = no effect. Lifestyle nudge only — not health advice. */
  bodyFatPct: number | null;
};

export const INCOME_YEARS = 3;
/** Smooth-curve parameters (x = log10(1 + E), E in A$). */
export const CURVE = {
  /** Height of the logistic "middle-class climb" term. */
  A: 60_000,
  /** Steepness of the logistic (per decade of wealth). */
  k: 3.3,
  /** Logistic midpoint: 10^6.15 ≈ A$1.4M. */
  x0: 6.15,
  /** Long-run slope of the softplus tail, per decade of wealth. */
  C: 9_600,
  /** Softplus elbow: 10^4.65 ≈ A$45k. */
  x1: 4.65,
  /** Softplus softness (decades). */
  s: 0.53,
} as const;
export const E_CAP = 600_000_000_000;
export const P_MAX = 100_000;
export const P_DISPLAY_MAX = 99_999;

/** 2026–27 Australian resident tax (ATO) + LITO + Medicare levy (2025–26 single thresholds). */
export function auAfterTax(gross: number): number {
  const g = Math.max(0, gross);
  let tax = 0;
  if (g > 190_000) tax = 51_370 + 0.45 * (g - 190_000);
  else if (g > 135_000) tax = 31_020 + 0.37 * (g - 135_000);
  else if (g > 45_000) tax = 4_020 + 0.3 * (g - 45_000);
  else if (g > 18_200) tax = 0.15 * (g - 18_200);
  let lito = 0;
  if (g <= 37_500) lito = 700;
  else if (g <= 45_000) lito = 700 - 0.05 * (g - 37_500);
  else if (g <= 66_667) lito = 325 - 0.015 * (g - 45_000);
  tax = Math.max(0, tax - Math.max(0, lito));
  let medicare = 0;
  if (g > 35_013) medicare = 0.02 * g;
  else if (g > 28_011) medicare = 0.1 * (g - 28_011);
  return g - tax - medicare;
}

const n0 = (v: number) => (Number.isFinite(v) ? v : 0);

export function netWorth(i: PowerInputs): number {
  const owns = i.home === "own" || i.home === "mortgage";
  const home = owns ? n0(i.homeValue) : 0;
  const mort = i.home === "mortgage" ? n0(i.mortgage) : 0;
  return n0(i.cash) + n0(i.investments) + home - mort + n0(i.carValue) - n0(i.carLoan) - n0(i.otherDebts);
}

const softplus = (z: number) => (z > 30 ? z : Math.log1p(Math.exp(z)));

/** Raw curve: logistic climb + softplus tail, both smooth in x = log10(1 + E). */
function rawCurve(x: number): number {
  const { A, k, x0, C, x1, s } = CURVE;
  return A / (1 + Math.exp(-k * (x - x0))) + C * s * softplus((x - x1) / s);
}
const RAW_ZERO = rawCurve(0);
const RAW_CAP = rawCurve(Math.log10(1 + E_CAP));

/**
 * Smooth reading 0–100,000 from effective wealth E (A$). Rescaled so E = 0 → 0 and
 * E = E_CAP → 100,000; anything above the cap stays at 100,000.
 */
export function readingFromE(E: number): number {
  if (!(E > 0)) return 0;
  const p = (P_MAX * (rawCurve(Math.log10(1 + E)) - RAW_ZERO)) / (RAW_CAP - RAW_ZERO);
  return Math.min(P_MAX, Math.max(0, p));
}

/** Integer reading for display: floor, capped at 99,999. */
export function displayReading(p: number): number {
  return Math.max(0, Math.min(P_DISPLAY_MAX, Math.floor(p)));
}

export function runwayMultiplier(months: number): number {
  const m = Math.max(0, months);
  return 0.85 + 0.3 * Math.min(1, Math.log10(1 + m) / Math.log10(1 + 120));
}

export function savingsMultiplier(rate: number | null): number {
  if (rate == null) return 1;
  return 1 + 0.3 * Math.min(0.6, Math.max(-0.5, rate));
}

const softplus01 = (z: number) => {
  const sp = z > 30 ? z : Math.log1p(Math.exp(z));
  return sp / (1 + sp);
};

/**
 * Optional body-fat lifestyle nudge. Blank/null → ×1. Peak ≈ ×1.10 near 15%.
 * Clamped to ×0.90 … ×1.12. Rough habit signal only — not medical or health advice.
 */
export function bodyFatMultiplier(pct: number | null): number {
  if (pct == null || !(pct > 0) || !Number.isFinite(pct)) return 1;
  const x = Math.min(60, Math.max(1, pct));
  const lift = 0.11 * Math.exp(-Math.pow((x - 15) / 6.5, 2));
  const high = 0.12 * softplus01((x - 26) / 4.5);
  const low = 0.07 * softplus01((6.5 - x) / 2);
  return Math.max(0.9, Math.min(1.12, 1 + lift - high - low));
}

export type PowerResult = {
  reading: number; // raw 0–100,000
  display: number; // floor, ≤ 99,999
  netWorth: number;
  afterTaxIncome: number;
  equivScale: number;
  runwayMonths: number | null; // null when spending is 0
  savingsRate: number | null; // null when income is 0
  effectiveWealth: number;
  mRunway: number;
  mSavings: number;
  mBodyFat: number;
  bodyFatPct: number | null;
  /** Sequential contribution of each factor, in reading points (sum = reading). */
  breakdown: { key: string; label: string; points: number; note: string }[];
};

export function computePower(i: PowerInputs): PowerResult {
  const hh = Math.max(1, Math.round(n0(i.householdSize)) || 1);
  const sq = Math.sqrt(hh);
  const afterTax = i.incomeBasis === "gross" ? auAfterTax(n0(i.income)) : Math.max(0, n0(i.income));
  const nw = netWorth(i);
  const owns = i.home === "own" || i.home === "mortgage";
  const assets = n0(i.cash) + n0(i.investments) + (owns ? n0(i.homeValue) : 0) + n0(i.carValue);
  const liquid = Math.max(0, n0(i.cash) + n0(i.investments));
  const spend = Math.max(0, n0(i.monthlySpend));
  const runwayMonths = spend > 0 ? liquid / spend : null;
  const savingsRate = afterTax > 0 ? (afterTax - 12 * spend) / afterTax : null;
  const mRunway = runwayMultiplier(runwayMonths ?? (liquid > 0 ? 1200 : 0));
  const mSavings = savingsMultiplier(savingsRate);
  const bfRaw = i.bodyFatPct;
  const bodyFatPct =
    bfRaw != null && Number.isFinite(bfRaw) && bfRaw > 0 ? Math.min(60, Math.max(1, bfRaw)) : null;
  const mBodyFat = bodyFatMultiplier(bodyFatPct);

  // Sequential build-up for the lifts/drags bar.
  const s1 = readingFromE(Math.max(0, assets / sq));
  const s2 = readingFromE(Math.max(0, nw / sq));
  const eBase = Math.max(0, (nw + INCOME_YEARS * afterTax) / sq);
  const s3 = readingFromE(eBase);
  const s4 = readingFromE(eBase * mRunway);
  const s5 = readingFromE(eBase * mRunway * mSavings);
  const E = eBase * mRunway * mSavings * mBodyFat;
  const s6 = readingFromE(E);

  const breakdown = [
    { key: "assets", label: "Assets", points: s1, note: "Cash, investments, home and car" },
    { key: "debts", label: "Debts", points: s2 - s1, note: "Mortgage, car loan and other debts" },
    { key: "income", label: "Income", points: s3 - s2, note: `After-tax income × ${INCOME_YEARS} as earning power` },
    { key: "runway", label: "Runway", points: s4 - s3, note: "Months of spending covered by cash + investments" },
    { key: "savings", label: "Savings rate", points: s5 - s4, note: "Share of after-tax income not spent" },
  ];
  if (bodyFatPct != null) {
    breakdown.push({
      key: "bodyFat",
      label: "Body fat",
      points: s6 - s5,
      note: "Optional lifestyle nudge — not health advice",
    });
  }

  return {
    reading: s6,
    display: displayReading(s6),
    netWorth: nw,
    afterTaxIncome: afterTax,
    equivScale: sq,
    runwayMonths,
    savingsRate,
    effectiveWealth: E,
    mRunway,
    mSavings,
    mBodyFat,
    bodyFatPct,
    breakdown: breakdown.map((b) => ({ ...b, points: Math.abs(b.points) < 0.5 ? 0 : b.points })),
  };
}

/** Billionaire reading: net worth only (other inputs unknown), one-person household. */
export function readingFromNetWorthAud(nwAud: number): number {
  return readingFromE(Math.max(0, nwAud));
}

export type Tier = { min: number; name: string; blurb: string; colour: string };

/** Original, light-hearted tier names (no franchise names or assets). */
export const TIERS: Tier[] = [
  { min: 0, name: "Civilian", blurb: "Every legend starts here. The training arc begins.", colour: "#9eb0c8" },
  { min: 1_000, name: "Trainee", blurb: "The basics are in place and the reps are adding up.", colour: "#7fc4ff" },
  { min: 3_000, name: "Fighter", blurb: "Solid footing. Steady habits are building real power.", colour: "#4fd1c5" },
  { min: 9_001, name: "Over 9,000", blurb: "The scouter is starting to sweat. Serious momentum.", colour: "#3dcc9a" },
  { min: 25_000, name: "Elite Warrior", blurb: "A strong position with plenty of breathing room.", colour: "#a3e635" },
  { min: 40_000, name: "Golden Aura", blurb: "Glowing. Wealth is now doing a lot of the work.", colour: "#ffe14a" },
  { min: 60_000, name: "Celestial", blurb: "Rarefied air — the top sliver of the planet.", colour: "#f59e0b" },
  { min: 79_000, name: "Limit Breaker", blurb: "Off the charts for almost everyone alive.", colour: "#fb7185" },
  { min: 99_999, name: "Infinite Instinct", blurb: "Scouter maxed out. The scale stops here.", colour: "#e879f9" },
];

export function tierFor(display: number): Tier {
  let t = TIERS[0]!;
  for (const x of TIERS) if (display >= x.min) t = x;
  return t;
}

export type Persona = { id: string; label: string; note: string; inputs: PowerInputs };

/** Illustrative examples only — round made-up numbers, not statistics about real people. */
export const PERSONAS: Persona[] = [
  {
    id: "homeless",
    label: "Homeless",
    note: "No regular income, a little cash, a small debt",
    inputs: {
      income: 0,
      incomeBasis: "net",
      monthlySpend: 600,
      cash: 150,
      investments: 0,
      home: "homeless",
      homeValue: 0,
      mortgage: 0,
      carValue: 0,
      carLoan: 0,
      otherDebts: 1_500,
      householdSize: 1,
      bodyFatPct: null,
    },
  },
  {
    id: "student",
    label: "Uni student renting",
    note: "Part-time work, share house, HELP debt",
    inputs: {
      income: 24_000,
      incomeBasis: "net",
      monthlySpend: 1_800,
      cash: 3_000,
      investments: 4_000,
      home: "rent",
      homeValue: 0,
      mortgage: 0,
      carValue: 0,
      carLoan: 0,
      otherDebts: 25_000,
      householdSize: 1,
      bodyFatPct: null,
    },
  },
  {
    id: "median",
    label: "Median Aussie household",
    note: "Couple + child, mortgage, super and a car",
    inputs: {
      income: 110_000,
      incomeBasis: "net",
      monthlySpend: 7_000,
      cash: 30_000,
      investments: 180_000,
      home: "mortgage",
      homeValue: 850_000,
      mortgage: 480_000,
      carValue: 25_000,
      carLoan: 8_000,
      otherDebts: 4_000,
      householdSize: 3,
      bodyFatPct: null,
    },
  },
  {
    id: "millionaire",
    label: "Homeowner millionaire",
    note: "Paid-off home, shares and super, couple",
    inputs: {
      income: 160_000,
      incomeBasis: "gross",
      monthlySpend: 6_500,
      cash: 80_000,
      investments: 450_000,
      home: "own",
      homeValue: 1_300_000,
      mortgage: 0,
      carValue: 40_000,
      carLoan: 0,
      otherDebts: 0,
      householdSize: 2,
      bodyFatPct: null,
    },
  },
  {
    id: "elon",
    label: "Elon (99,999)",
    note: "Illustrative mega-fortune ≈ A$1.5 trillion in shares",
    inputs: {
      income: 0,
      incomeBasis: "net",
      monthlySpend: 1_000_000,
      cash: 1_000_000_000,
      investments: 1_500_000_000_000,
      home: "rent",
      homeValue: 0,
      mortgage: 0,
      carValue: 150_000,
      carLoan: 0,
      otherDebts: 0,
      householdSize: 1,
      bodyFatPct: null,
    },
  },
];

export const DEFAULT_INPUTS: PowerInputs = PERSONAS.find((p) => p.id === "median")!.inputs;
