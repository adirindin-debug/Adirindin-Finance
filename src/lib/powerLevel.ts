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
 * 4. Habit multipliers (each roughly ±15%, so habits nudge rather than dominate):
 *      runway  = liquid assets (cash + investments) ÷ monthly spending, in months
 *      M_runway  = 0.85 + 0.30 × min(1, log10(1 + runway) ÷ log10(1 + 120))
 *                  (0 months → ×0.85, 10+ years → ×1.15)
 *      savings rate s = (after-tax income − 12 × monthly spending) ÷ after-tax income
 *      M_savings = 1 + 0.30 × clamp(s, −0.5, 0.6)   (×0.85 … ×1.18; ×1 with no income)
 *      E = E_base × M_runway × M_savings
 *
 * 5. Log-scale ladder from E to the 0–100,000 reading (straight segments on a log chart):
 *      E ≤ A$300k:          P = 523 × (E ÷ 300k)              — gentle start (log–log slope 1)
 *      A$300k < E ≤ A$2M:   P = 523 × (E ÷ 300k)^2.5          — the steep climb (slope 2.5),
 *                                                               reaching 60,000 at A$2M
 *      E > A$2M:            P = 60,000 + 40,000 × log10(E ÷ 2M) ÷ log10(E_CAP ÷ 2M)
 *                           — pure log scale: every ×10 in E adds the same ~7,300 points
 *      E_CAP = A$600 billion (about US$400B+ at recent exchange rates).
 *    The reading is capped at 99,999 on screen; 100,000 is the theoretical maximum.
 *
 * Calibration (illustrative personas): no income or assets → ~0; a uni student renting
 * → a few hundred; a median-ish Aussie household → low thousands; a homeowner
 * millionaire → ~50k–70k; Elon-level wealth → 99,999.
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
};

export const INCOME_YEARS = 3;
export const E_KNEE = 300_000;
export const E_MID = 2_000_000;
export const P_MID = 60_000;
export const MID_EXP = 2.5;
/** Reading at the knee, so the curve is continuous: 60,000 × (0.3M ÷ 2M)^2.5 ≈ 523. */
export const P_KNEE = P_MID * Math.pow(E_KNEE / E_MID, MID_EXP);
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

export function readingFromE(E: number): number {
  if (!(E > 0)) return 0;
  if (E <= E_KNEE) return P_KNEE * (E / E_KNEE);
  if (E <= E_MID) return P_KNEE * Math.pow(E / E_KNEE, MID_EXP);
  const p = P_MID + (P_MAX - P_MID) * (Math.log10(E / E_MID) / Math.log10(E_CAP / E_MID));
  return Math.min(P_MAX, p);
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

  // Sequential build-up for the lifts/drags bar.
  const s1 = readingFromE(Math.max(0, assets / sq));
  const s2 = readingFromE(Math.max(0, nw / sq));
  const eBase = Math.max(0, (nw + INCOME_YEARS * afterTax) / sq);
  const s3 = readingFromE(eBase);
  const s4 = readingFromE(eBase * mRunway);
  const E = eBase * mRunway * mSavings;
  const s5 = readingFromE(E);

  const breakdown = [
    { key: "assets", label: "Assets", points: s1, note: "Cash, investments, home and car" },
    { key: "debts", label: "Debts", points: s2 - s1, note: "Mortgage, car loan and other debts" },
    { key: "income", label: "Income", points: s3 - s2, note: `After-tax income × ${INCOME_YEARS} as earning power` },
    { key: "runway", label: "Runway", points: s4 - s3, note: "Months of spending covered by cash + investments" },
    { key: "savings", label: "Savings rate", points: s5 - s4, note: "Share of after-tax income not spent" },
  ];

  return {
    reading: s5,
    display: displayReading(s5),
    netWorth: nw,
    afterTaxIncome: afterTax,
    equivScale: sq,
    runwayMonths,
    savingsRate,
    effectiveWealth: E,
    mRunway,
    mSavings,
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
  { min: 300, name: "Trainee", blurb: "The basics are in place and the reps are adding up.", colour: "#7fc4ff" },
  { min: 1_500, name: "Fighter", blurb: "Solid footing. Steady habits are building real power.", colour: "#4fd1c5" },
  { min: 9_001, name: "Over 9,000", blurb: "The scouter is starting to sweat. Serious momentum.", colour: "#3dcc9a" },
  { min: 25_000, name: "Elite Warrior", blurb: "A strong position with plenty of breathing room.", colour: "#a3e635" },
  { min: 50_000, name: "Golden Aura", blurb: "Glowing. Wealth is now doing a lot of the work.", colour: "#ffe14a" },
  { min: 75_000, name: "Celestial", blurb: "Rarefied air — the top sliver of the planet.", colour: "#f59e0b" },
  { min: 95_000, name: "Limit Breaker", blurb: "Off the charts for almost everyone alive.", colour: "#fb7185" },
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
    },
  },
];

export const DEFAULT_INPUTS: PowerInputs = PERSONAS.find((p) => p.id === "median")!.inputs;
