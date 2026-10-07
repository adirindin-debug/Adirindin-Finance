"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_INPUTS,
  PERSONAS,
  P_DISPLAY_MAX,
  TIERS,
  computePower,
  displayReading,
  readingFromNetWorthAud,
  tierFor,
  type HomeStatus,
  type IncomeBasis,
  type PowerInputs,
} from "@/lib/powerLevel";

/* ── Shared styles (match the compound interest calculator) ─────────────────── */
const inputCls =
  "w-full rounded-md border border-border bg-[#0b1017] px-3 py-2 text-sm text-foreground tabular-nums placeholder:text-muted/50 focus:border-accent focus:outline-none";
const labelCls = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";
const toggleWrap = "inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1";
const toggleBtn =
  "min-h-10 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors sm:min-h-0 sm:py-1.5";
const toggleOn = "bg-accent text-white shadow-sm";
const toggleOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

type Currency = "AUD" | "USD";
type MoneyKey = "income" | "monthlySpend" | "cash" | "investments" | "homeValue" | "mortgage" | "carValue" | "carLoan" | "otherDebts";
type Form = Record<MoneyKey, string> & { incomeBasis: IncomeBasis; home: HomeStatus; householdSize: string; bodyFatPct: string; age: string };

const fmtGroup = (n: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(n);
const parseAmount = (raw: string) => {
  const c = raw.replace(/[$,\s]/g, "");
  if (!c) return 0;
  const n = Number(c);
  return Number.isFinite(n) ? n : 0;
};

function toForm(i: PowerInputs): Form {
  const m = (n: number) => (n ? fmtGroup(n) : "");
  return {
    income: m(i.income),
    monthlySpend: m(i.monthlySpend),
    cash: m(i.cash),
    investments: m(i.investments),
    homeValue: m(i.homeValue),
    mortgage: m(i.mortgage),
    carValue: m(i.carValue),
    carLoan: m(i.carLoan),
    otherDebts: m(i.otherDebts),
    incomeBasis: i.incomeBasis,
    home: i.home,
    householdSize: String(i.householdSize),
    bodyFatPct: i.bodyFatPct != null && i.bodyFatPct > 0 ? String(Math.round(i.bodyFatPct * 10) / 10) : "",
    age: i.age != null && i.age > 0 ? String(Math.round(i.age)) : "",
  };
}

const HOME_OPTIONS: { k: HomeStatus; label: string }[] = [
  { k: "rent", label: "Rent" },
  { k: "own", label: "Own outright" },
  { k: "mortgage", label: "Own with mortgage" },
  { k: "family", label: "Living with family" },
  { k: "homeless", label: "No fixed home" },
];

function MoneyInput({
  id,
  value,
  onChange,
  currency,
  suffix,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  currency: Currency;
  suffix?: string;
}) {
  const prefix = currency === "USD" ? "US$" : "$";
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{prefix}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const n = parseAmount(e.target.value);
          onChange(e.target.value.trim() === "" ? "" : fmtGroup(n));
        }}
        className={`${inputCls} ${currency === "USD" ? "pl-11" : "pl-7"} ${suffix ? "pr-16" : ""}`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span>
      ) : null}
    </div>
  );
}

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

/* ── Count-up ─────────────────────────────────────────────────────────────── */
function useCountUp(target: number, ms = 1100): { value: number; settled: boolean } {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const valRef = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      valRef.current = target;
      setValue(target);
      return;
    }
    fromRef.current = valRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(fromRef.current + (target - fromRef.current) * e);
      valRef.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return { value, settled: value === target };
}

/** Tier-segment position 0–1: each tier gets an equal slice of the meter. */
function meterPos(display: number): number {
  const n = TIERS.length;
  for (let i = n - 1; i >= 0; i--) {
    const t = TIERS[i]!;
    if (display >= t.min) {
      const next = TIERS[i + 1];
      if (!next) return 1;
      const f = (display - t.min) / (next.min - t.min);
      return (i + Math.min(1, Math.max(0, f))) / (n - 1);
    }
  }
  return 0;
}

/* ── FX (for USD inputs and the Top 10) ─────────────────────────────────── */
type Fx = { usdPerAud: number; asOf: string; label: string };
function useFx(): Fx | null {
  const [fx, setFx] = useState<Fx | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/fx-rates")
      .then((r) => r.json())
      .then((j: { rates?: { USD?: number }; asOf?: string; sourceLabel?: string }) => {
        const u = j.rates?.USD;
        if (alive && typeof u === "number" && u > 0) setFx({ usdPerAud: u, asOf: j.asOf ?? "", label: j.sourceLabel ?? "FX" });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return fx;
}

function fmtMoney(nAud: number, currency: Currency, fx: Fx | null): string {
  const v = currency === "USD" && fx ? nAud * fx.usdPerAud : nAud;
  const sign = v < 0 ? "−" : "";
  const a = Math.abs(v);
  const pre = currency === "USD" && fx ? "US$" : "$";
  if (a >= 1e12) return `${sign}${pre}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${pre}${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e7) return `${sign}${pre}${(a / 1e6).toFixed(1)}M`;
  return `${sign}${pre}${fmtGroup(a)}`;
}

/* ── Main panel ───────────────────────────────────────────────────────────── */
export function PowerLevelPanel() {
  const [form, setForm] = useState<Form>(() => toForm(DEFAULT_INPUTS));
  const [currency, setCurrency] = useState<Currency>("AUD");
  const [persona, setPersona] = useState<string | null>("median");
  const fx = useFx();

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setPersona(null);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const inputs: PowerInputs = useMemo(() => {
    const toAud = currency === "USD" && fx ? 1 / fx.usdPerAud : 1;
    const m = (k: MoneyKey) => parseAmount(form[k]) * toAud;
    const hh = Math.max(1, Math.min(20, Math.round(parseAmount(form.householdSize)) || 1));
    return {
      income: m("income"),
      incomeBasis: form.incomeBasis,
      monthlySpend: m("monthlySpend"),
      cash: m("cash"),
      investments: m("investments"),
      home: form.home,
      homeValue: m("homeValue"),
      mortgage: m("mortgage"),
      carValue: m("carValue"),
      carLoan: m("carLoan"),
      otherDebts: m("otherDebts"),
      householdSize: hh,
      bodyFatPct: (() => {
        const raw = form.bodyFatPct.trim();
        if (!raw) return null;
        const n = parseAmount(raw);
        return n > 0 ? n : null;
      })(),
      age: (() => {
        const raw = form.age.trim();
        if (!raw) return null;
        const n = parseAmount(raw);
        return n > 0 ? n : null;
      })(),
    };
  }, [form, currency, fx]);

  const res = useMemo(() => computePower(inputs), [inputs]);
  const tier = tierFor(res.display);
  const { value: shown, settled } = useCountUp(res.display);
  const shownTier = tierFor(shown);
  const nextTier = TIERS.find((t) => t.min > res.display) ?? null;

  const fill = (id: string) => {
    const p = PERSONAS.find((x) => x.id === id);
    if (!p) return;
    setCurrency("AUD");
    setForm(toForm(p.inputs));
    setPersona(id);
  };
  const reset = () => {
    setCurrency("AUD");
    setForm(toForm(DEFAULT_INPUTS));
    setPersona("median");
  };

  const owns = form.home === "own" || form.home === "mortgage";
  const usdPending = currency === "USD" && !fx;
  const maxAbs = Math.max(1, ...res.breakdown.map((b) => Math.abs(b.points)));
  const activePersona = PERSONAS.find((p) => p.id === persona) ?? null;

  return (
    <section className="rounded-xl border border-border bg-[#0f1419] p-4 sm:p-6" data-power-panel>
      {/* Quick-fill + reset */}
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={labelCls}>Quick-fill · illustrative examples</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className={toggleWrap} role="group" aria-label="Input currency">
              {(["AUD", "USD"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={currency === c}
                  onClick={() => {
                    setPersona(null);
                    setCurrency(c);
                  }}
                  className={`${toggleBtn} ${currency === c ? toggleOn : toggleOff}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={reset}
              className="min-h-10 rounded-md border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/80 transition hover:border-accent/60 hover:text-foreground sm:min-h-0 sm:py-1.5"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Illustrative personas">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              data-persona={p.id}
              aria-pressed={persona === p.id}
              onClick={() => fill(p.id)}
              title={p.note}
              className={`min-h-10 rounded-full border px-3.5 py-1.5 text-xs font-medium transition sm:min-h-0 ${
                persona === p.id
                  ? "border-[#3dcc9a] bg-[#3dcc9a]/15 text-[#bff5df]"
                  : "border-border bg-[#0b1017] text-foreground/80 hover:border-[#3dcc9a]/60 hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-muted">
          {activePersona ? (
            <>
              <span className="text-foreground/80">{activePersona.label}:</span> {activePersona.note}. Made-up round numbers
              to show how the scale works — not statistics about real people.
            </>
          ) : (
            "Personas are made-up round numbers to show how the scale works — not statistics about real people. Your own numbers never leave this page."
          )}
        </p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] [&>*]:min-w-0">
        {/* ---------- Inputs ---------- */}
        <div className="order-2 space-y-4 lg:order-1">
          <Field id="pl-income" label="Annual income">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="min-w-0 flex-1">
                <MoneyInput id="pl-income" value={form.income} onChange={(v) => set("income", v)} currency={currency} suffix="/ year" />
              </div>
              <div className={toggleWrap} role="group" aria-label="Income basis">
                {(
                  [
                    ["net", "After tax"],
                    ["gross", "Gross"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={form.incomeBasis === k}
                    onClick={() => set("incomeBasis", k)}
                    className={`${toggleBtn} ${form.incomeBasis === k ? toggleOn : toggleOff}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {form.incomeBasis === "gross" ? (
              <p className="text-[11px] text-muted">
                Gross → about {fmtMoney(res.afterTaxIncome, currency, fx)} after tax (2026–27 resident rates, one taxpayer, rough).
              </p>
            ) : null}
          </Field>
          <Field id="pl-spend" label="Monthly spending" hint="Everything going out each month, including rent or mortgage repayments.">
            <MoneyInput id="pl-spend" value={form.monthlySpend} onChange={(v) => set("monthlySpend", v)} currency={currency} suffix="/ month" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pl-cash" label="Cash & savings">
              <MoneyInput id="pl-cash" value={form.cash} onChange={(v) => set("cash", v)} currency={currency} />
            </Field>
            <Field id="pl-inv" label="Investments">
              <MoneyInput id="pl-inv" value={form.investments} onChange={(v) => set("investments", v)} currency={currency} />
            </Field>
          </div>
          <p className="-mt-2 text-[11px] text-muted">Investments = shares, ETFs, super, crypto and the like.</p>

          <div className="space-y-1.5">
            <p className={labelCls}>Home</p>
            <div className={`${toggleWrap} w-full`} role="group" aria-label="Home situation">
              {HOME_OPTIONS.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  aria-pressed={form.home === o.k}
                  onClick={() => set("home", o.k)}
                  className={`${toggleBtn} px-2.5 normal-case tracking-normal ${form.home === o.k ? toggleOn : toggleOff}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          {owns ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="pl-home" label="Home value">
                <MoneyInput id="pl-home" value={form.homeValue} onChange={(v) => set("homeValue", v)} currency={currency} />
              </Field>
              {form.home === "mortgage" ? (
                <Field id="pl-mortgage" label="Mortgage balance">
                  <MoneyInput id="pl-mortgage" value={form.mortgage} onChange={(v) => set("mortgage", v)} currency={currency} />
                </Field>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pl-car" label="Car value">
              <MoneyInput id="pl-car" value={form.carValue} onChange={(v) => set("carValue", v)} currency={currency} />
            </Field>
            <Field id="pl-carloan" label="Car loan">
              <MoneyInput id="pl-carloan" value={form.carLoan} onChange={(v) => set("carLoan", v)} currency={currency} />
            </Field>
          </div>
          <Field id="pl-debts" label="Other debts" hint="Credit cards, HELP/HECS, personal loans, buy now pay later.">
            <MoneyInput id="pl-debts" value={form.otherDebts} onChange={(v) => set("otherDebts", v)} currency={currency} />
          </Field>
          <Field id="pl-hh" label="Household size" hint="People sharing the income and assets above (you included).">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Fewer people"
                onClick={() => set("householdSize", String(Math.max(1, inputs.householdSize - 1)))}
                className="h-10 w-10 rounded-md border border-border text-lg text-foreground/80 hover:border-accent/60"
              >
                −
              </button>
              <input
                id="pl-hh"
                type="text"
                inputMode="numeric"
                value={form.householdSize}
                onChange={(e) => set("householdSize", e.target.value)}
                className={`${inputCls} w-20 text-center`}
              />
              <button
                type="button"
                aria-label="More people"
                onClick={() => set("householdSize", String(Math.min(20, inputs.householdSize + 1)))}
                className="h-10 w-10 rounded-md border border-border text-lg text-foreground/80 hover:border-accent/60"
              >
                +
              </button>
            </div>
          </Field>

          <div className="rounded-lg border border-border/70 bg-[#0b1017]/60 p-3 space-y-3" data-health>
            <p className={labelCls}>Health &amp; youth · optional</p>
            <Field
              id="pl-age"
              label="Age (optional)"
              hint="Youth means more years for money to compound, so younger scans get a boost. Blank = no effect."
            >
              <div className="relative max-w-[10rem]">
                <input
                  id="pl-age"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="—"
                  value={form.age}
                  onChange={(e) => set("age", e.target.value)}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      set("age", "");
                      return;
                    }
                    set("age", String(Math.round(Math.min(90, Math.max(16, parseAmount(raw))))));
                  }}
                  className={`${inputCls} pr-12`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">yrs</span>
              </div>
            </Field>
            <Field
              id="pl-bf"
              label="Body fat % (optional)"
              hint="Skip if you are not sure — it only nudges the reading. Rough lifestyle habit, not health advice."
            >
              <div className="relative max-w-[10rem]">
                <input
                  id="pl-bf"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="—"
                  value={form.bodyFatPct}
                  onChange={(e) => set("bodyFatPct", e.target.value)}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) {
                      set("bodyFatPct", "");
                      return;
                    }
                    const n = Math.min(60, Math.max(1, parseAmount(raw)));
                    set("bodyFatPct", String(Math.round(n * 10) / 10));
                  }}
                  className={`${inputCls} pr-8`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">%</span>
              </div>
            </Field>
          </div>
          {currency === "USD" ? (
            <p className="text-[11px] text-muted">
              {fx
                ? `US$ amounts are converted to A$ at ${fx.usdPerAud.toFixed(4)} USD per AUD (${fx.label}, ${fx.asOf}) before scoring.`
                : "Loading the exchange rate…"}
            </p>
          ) : null}
        </div>

        {/* ---------- Readout ---------- */}
        <div className="order-1 space-y-5 lg:order-2">
          <div
            className="relative overflow-hidden rounded-xl border p-5 sm:p-7"
            style={{
              borderColor: `${shownTier.colour}66`,
              background:
                "radial-gradient(120% 140% at 15% 0%, rgba(61,204,154,0.16) 0%, rgba(8,20,14,0.95) 55%, #050a07 100%)",
            }}
            data-scouter
            aria-live="polite"
          >
            {/* scanlines */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(120,255,190,0.05) 0 1px, transparent 1px 3px)" }}
            />
            {/* reticle */}
            <svg aria-hidden viewBox="0 0 120 120" className="pointer-events-none absolute -bottom-8 -right-8 h-40 w-40 opacity-25 sm:h-52 sm:w-52">
              <circle cx="60" cy="60" r="44" fill="none" stroke="#3dcc9a" strokeWidth="1.2" strokeDasharray="4 5" />
              <circle cx="60" cy="60" r="28" fill="none" stroke="#3dcc9a" strokeWidth="1" />
              <path d="M60 4v20M60 96v20M4 60h20M96 60h20" stroke="#3dcc9a" strokeWidth="1.2" />
              <circle cx="60" cy="60" r="3" fill="#ff5d5d" />
            </svg>
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-[#7fe6bd]">Power level</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#7fe6bd]/80">
                  {usdPending ? "Awaiting FX…" : settled ? "● Locked" : "Scanning…"}
                </p>
              </div>
              <p
                className="mt-2 font-mono text-6xl font-bold tabular-nums leading-none sm:text-7xl lg:text-8xl"
                style={{ color: shownTier.colour, textShadow: `0 0 18px ${shownTier.colour}66, 0 0 2px ${shownTier.colour}` }}
                data-power-reading={res.display}
              >
                {fmtGroup(shown)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#7fe6bd]/70">of {fmtGroup(P_DISPLAY_MAX)} on the scouter</p>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className="rounded-md border px-2.5 py-1 text-sm font-bold uppercase tracking-[0.14em]"
                  style={{ color: tier.colour, borderColor: `${tier.colour}88`, background: `${tier.colour}14` }}
                  data-tier
                >
                  {tier.name}
                </span>
                <span className="text-sm text-[#cfe9de]">{tier.blurb}</span>
              </div>

              {/* Tier meter */}
              <div className="mt-5">
                <div className="relative h-2.5 rounded-full bg-white/10">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                    style={{
                      width: `${(meterPos(shown) * 100).toFixed(2)}%`,
                      background: `linear-gradient(90deg, #3dcc9a, ${shownTier.colour})`,
                      boxShadow: `0 0 10px ${shownTier.colour}88`,
                    }}
                  />
                  {TIERS.map((t, i) => (
                    <span
                      key={t.name}
                      aria-hidden
                      className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-white/25"
                      style={{ left: `${(i / (TIERS.length - 1)) * 100}%` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#a9cbbd]">
                  {nextTier
                    ? `Next tier: ${nextTier.name} at ${fmtGroup(nextTier.min)} — ${fmtGroup(nextTier.min - res.display)} to go.`
                    : "Top of the scale."}
                </p>
              </div>
            </div>
          </div>

          {/* Key numbers */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[
              ["Net worth", fmtMoney(res.netWorth, currency, fx)],
              [form.incomeBasis === "gross" ? "After-tax income (est.)" : "After-tax income", fmtMoney(res.afterTaxIncome, currency, fx)],
              [
                "Runway",
                res.runwayMonths == null
                  ? "—"
                  : res.runwayMonths >= 1200
                    ? "100+ yrs"
                    : res.runwayMonths >= 24
                      ? `${(res.runwayMonths / 12).toFixed(1)} yrs`
                      : `${res.runwayMonths.toFixed(1)} mths`,
              ],
              ["Savings rate", res.savingsRate == null ? "—" : `${Math.round(res.savingsRate * 100)}%`],
              [
                "Debt / assets",
                res.debtRatio == null
                  ? "—"
                  : !Number.isFinite(res.debtRatio)
                    ? "No assets"
                    : res.debtRatio > 9.99
                      ? ">999%"
                      : `${Math.round(res.debtRatio * 100)}%`,
              ],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-[#0b1017] px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{k}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{v}</dd>
              </div>
            ))}
          </dl>

          {res.bodyFatPct != null || res.age != null ? (
            <p
              className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[#3dcc9a]/35 bg-[#3dcc9a]/10 px-2.5 py-1 text-[11px] font-medium text-[#bff5df]"
              data-health-chip
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#3dcc9a]" aria-hidden />
              Health &amp; youth
              {res.age != null ? ` · age ${res.age} ×${res.mAge.toFixed(2)}` : ""}
              {res.bodyFatPct != null ? ` · body fat ${res.bodyFatPct}% ×${res.mBodyFat.toFixed(2)}` : ""}
            </p>
          ) : null}

          {/* Lifts and drags */}
          <div className="rounded-xl border border-border bg-[#0b1017] p-4" data-breakdown>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">What lifts and holds back the reading</p>
              <p className="text-[11px] text-muted">
                <span className="text-[#3dcc9a]">■</span> lifts &nbsp; <span className="text-[#e8a33a]">■</span> holding back
              </p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {res.breakdown.map((b) => {
                const pos = b.points >= 0;
                const w = (Math.abs(b.points) / maxAbs) * 100;
                return (
                  <li key={b.key} className="grid grid-cols-[96px_minmax(0,1fr)_72px] items-center gap-3 sm:grid-cols-[120px_minmax(0,1fr)_84px]">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{b.label}</p>
                      <p className="hidden truncate text-[10px] text-muted sm:block" title={b.note}>
                        {b.note}
                      </p>
                    </div>
                    <div className="h-3 rounded-full bg-white/5">
                      <div
                        className="h-3 rounded-full transition-[width] duration-500"
                        style={{ width: `${Math.max(b.points === 0 ? 0 : 1.5, w).toFixed(2)}%`, background: pos ? "#3dcc9a" : "#e8a33a" }}
                      />
                    </div>
                    <p className={`text-right font-mono text-xs tabular-nums ${b.points === 0 ? "text-muted" : pos ? "text-[#7fe6bd]" : "text-[#f2c27a]"}`}>
                      {b.points === 0 ? "0" : `${pos ? "+" : "−"}${fmtGroup(Math.abs(Math.round(b.points)))}`}
                    </p>
                  </li>
                );
              })}
            </ul>
            {res.display === 0 ? (
              <p className="mt-3 rounded-md border border-[#3dcc9a]/30 bg-[#3dcc9a]/5 px-3 py-2 text-xs text-[#bff5df]">
                Starting line. Any income, savings or debt paid down gets the scouter moving — the first steps count the
                most.
              </p>
            ) : null}
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Built up in order: assets, then debts, income, runway, savings rate
              {res.age != null ? ", age" : ""}
              {res.bodyFatPct != null ? ", body fat" : ""} and debt load. Habits, age and body fat share one soft cap
              (about ×0.45–×1.6 together), so wealth stays the main driver. Points shift with the order and the log scale, so read them
              as a rough guide. Every debt repaid, month of runway or extra dollar saved nudges the reading up.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Top 10 ───────────────────────────────────────────────────────────────── */
type Top10 = {
  ok: boolean;
  live: boolean;
  source: string;
  sourceUrl: string;
  asOf: string;
  people: { rank: number; name: string; netWorthUsdM: number; wealthSource: string | null; country: string | null }[];
};

function fmtAsOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

function fmtUsdM(m: number): string {
  if (m >= 1_000_000) return `US$${(m / 1_000_000).toFixed(2)}T`;
  return `US$${(m / 1000).toFixed(1)}B`;
}

export function PowerTop10() {
  const [data, setData] = useState<Top10 | null>(null);
  const [err, setErr] = useState(false);
  const fx = useFx();
  useEffect(() => {
    let alive = true;
    fetch("/api/billionaires")
      .then((r) => r.json())
      .then((j: Top10) => alive && (j.ok ? setData(j) : setErr(true)))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="rounded-xl border border-border bg-[#0f1419] p-4 sm:p-6" aria-labelledby="pl-top10" data-top10>
      <h2 id="pl-top10" className="text-lg font-semibold text-foreground">
        Top 10 power levels on the planet
      </h2>
      <p className="mt-1 text-sm text-muted">The world&apos;s ten richest people, run through the same scale on net worth alone.</p>
      {err ? (
        <p className="mt-4 text-sm text-muted">The list couldn&apos;t be loaded right now. Try again shortly.</p>
      ) : !data ? (
        <p className="mt-4 text-sm text-muted">Scanning the planet…</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.12em] text-muted">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 pr-3 text-right font-semibold">Net worth</th>
                  <th className="py-2 text-right font-semibold">Power level</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p) => {
                  const pl = fx ? displayReading(readingFromNetWorthAud((p.netWorthUsdM * 1e6) / fx.usdPerAud)) : null;
                  const t = pl != null ? tierFor(pl) : null;
                  return (
                    <tr key={p.rank} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 font-mono text-muted">{p.rank}</td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-foreground">{p.name}</span>
                        {p.wealthSource ? <span className="ml-2 text-xs text-muted">{p.wealthSource}</span> : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-foreground/90">{fmtUsdM(p.netWorthUsdM)}</td>
                      <td className="py-2.5 text-right font-mono font-semibold tabular-nums" style={{ color: t?.colour }}>
                        {pl != null ? fmtGroup(pl) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Source:{" "}
            <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              {data.source}
            </a>{" "}
            · figures as of {fmtAsOf(data.asOf)}
            {data.live ? " · refreshed hourly" : " · saved snapshot (live list unavailable)"}. Net worth is Forbes&apos;
            published estimate, unchanged. Power levels use net worth only (income and habits unknown), converted to A$
            {fx ? ` at ${fx.usdPerAud.toFixed(4)} USD per AUD (${fx.label}, ${fx.asOf})` : ""}. The scouter caps at{" "}
            {fmtGroup(P_DISPLAY_MAX)}.
          </p>
          <p className="mt-2 text-xs text-muted" data-health-note>
            Health and youth inputs (like age and body fat) only count when you enter your own; rich-list power levels use net worth only.
          </p>
        </>
      )}
    </section>
  );
}
