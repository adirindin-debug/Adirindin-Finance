"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DEFAULT_INFLATION_PCT,
  MAX_YEARS,
  parseAmount,
  projectGrowth,
  type CompoundingFrequency,
  type ContributionFrequency,
} from "@/lib/compoundInterest";

type TickerSuggestion = { symbol: string; name: string; exchange?: string; type?: string };

type CagrPayload =
  | {
      ok: true;
      ticker: string;
      name: string | null;
      currency: string | null;
      cagr: number;
      startDate: string;
      endDate: string;
      startPrice: number;
      endPrice: number;
      yearsUsed: number;
      requestedYears: number | null;
      clamped: boolean;
      firstAvailableDate: string;
      availableYears: number;
    }
  | { ok: false; ticker?: string; error: string; firstAvailableDate?: string; availableYears?: number };

type Mode = "manual" | "ticker";
type Lookback = number | "max";
const LOOKBACKS: Lookback[] = [1, 3, 5, 10, 20, 30, "max"];

/* Chart geometry (viewBox units). */
const W = 640;
const H = 300;
const PAD = { top: 14, right: 12, bottom: 28, left: 54 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

const C_BAL = "#4c9fff";
const C_CONTRIB = "#9aa8b5";
const C_REAL = "#3dcc9a";

const auDay = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const fmtDay = (d: string) => auDay.format(new Date(`${d}T00:00:00Z`));

/** Group with commas (deterministic — same output on server and browser). */
function groupInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const COMPACT: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "k"],
];

function fmtMoney(v: number | null | undefined, compact = false): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (!Number.isFinite(v)) return "Too large to show";
  const sign = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  if (abs >= 1e15) return `${sign}$${abs.toExponential(2).replace("e+", "e")}`;
  if (compact || abs >= 1e10) {
    for (const [div, unit] of COMPACT) {
      if (abs >= div) {
        const x = abs / div;
        const txt = x >= 100 || Number.isInteger(x) ? groupInt(x) : x.toFixed(1).replace(/\.0$/, "");
        return `${sign}$${txt}${unit}`;
      }
    }
  }
  return `${sign}$${groupInt(abs)}`;
}

function fmtPct(r: number, digits = 2): string {
  const v = r * 100;
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1e6) return `${v.toExponential(2)}%`;
  const [int, dec] = Math.abs(v).toFixed(digits).split(".");
  const decTrim = (dec ?? "").replace(/0+$/, "");
  return `${v < 0 ? "−" : ""}${groupInt(Number(int))}${decTrim ? `.${decTrim}` : ""}%`;
}

/** Nice axis step for 0..max with ~4–5 ticks. */
function niceTicks(max: number): number[] {
  if (!(max > 0) || !Number.isFinite(max)) return [0];
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let v = 0; v <= max * 1.0001 + step * 0.0001 && out.length < 12; v += step) out.push(v);
  if (out[out.length - 1]! < max) out.push(out[out.length - 1]! + step);
  return out;
}

const inputCls =
  "w-full rounded-md border border-border bg-[#0b1017] px-3 py-2 text-sm text-foreground tabular-nums placeholder:text-muted/50 focus:border-accent focus:outline-none";
const labelCls = "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";
const toggleWrap = "inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1";
const toggleBtn = "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
const toggleOn = "bg-accent text-white shadow-sm";
const toggleOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "0",
  prefix = "$",
  suffix,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="relative">
      {prefix ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{prefix}</span>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} ${prefix ? "pl-7" : ""} ${suffix ? "pr-12" : ""}`}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span>
      ) : null}
    </div>
  );
}

export function CompoundInterestPanel() {
  // Example values — every field can be cleared (blank = 0 / not used).
  const [initial, setInitial] = useState("10000");
  const [contribution, setContribution] = useState("500");
  const [freq, setFreq] = useState<ContributionFrequency>("monthly");
  const [mode, setMode] = useState<Mode>("manual");
  const [rate, setRate] = useState("7");
  const [yearsRaw, setYearsRaw] = useState("20");
  const [compounding, setCompounding] = useState<CompoundingFrequency>("monthly");
  const [inflationOn, setInflationOn] = useState(false);
  const [inflationRaw, setInflationRaw] = useState("");

  // Ticker mode
  const [tickerText, setTickerText] = useState("");
  const [selected, setSelected] = useState<{ symbol: string; name?: string } | null>(null);
  const [lookback, setLookback] = useState<Lookback>(10);
  const [cagrData, setCagrData] = useState<CagrPayload | null>(null);
  const [cagrLoading, setCagrLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(-1);
  const skipSearchFor = useRef<string | null>(null);

  // Typeahead (same /api/ticker-search as the portfolio editor).
  useEffect(() => {
    if (mode !== "ticker") return;
    const q = tickerText.trim();
    if (!q || skipSearchFor.current === q.toUpperCase()) {
      setSuggestions([]);
      return;
    }
    const ac = new AbortController();
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`, { signal: ac.signal });
        const data = (await res.json()) as { suggestions?: TickerSuggestion[] };
        if (ac.signal.aborted) return;
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setSuggestOpen(true);
        setActiveSuggest(list.length ? 0 : -1);
      } catch {
        /* soft-fail: typed ticker can still be used directly */
      }
    }, 280);
    return () => {
      window.clearTimeout(handle);
      ac.abort();
    };
  }, [tickerText, mode]);

  const choose = useCallback((symbol: string, name?: string) => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    skipSearchFor.current = s;
    setTickerText(s);
    if (selected?.symbol !== s) setCagrData(null);
    setSelected({ symbol: s, name });
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveSuggest(-1);
  }, [selected]);

  // Fetch CAGR when ticker or lookback changes.
  useEffect(() => {
    if (mode !== "ticker" || !selected) return;
    const ac = new AbortController();
    setCagrLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/asset-cagr?ticker=${encodeURIComponent(selected.symbol)}&years=${lookback === "max" ? "max" : lookback}`,
          { signal: ac.signal },
        );
        const json = (await res.json()) as CagrPayload;
        if (!ac.signal.aborted) setCagrData(json);
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return;
        setCagrData({ ok: false, error: "Could not reach the price history feed — try again shortly." });
      } finally {
        if (!ac.signal.aborted) setCagrLoading(false);
      }
    })();
    return () => ac.abort();
  }, [mode, selected, lookback]);

  const availableYears = cagrData && "availableYears" in cagrData ? (cagrData.availableYears ?? null) : null;

  // If the chosen lookback is longer than the history, snap to Max (UI clamp).
  useEffect(() => {
    if (availableYears != null && typeof lookback === "number" && lookback > availableYears + 0.02 && cagrData?.ok) {
      setLookback("max");
    }
  }, [availableYears, lookback, cagrData]);

  const years = Math.max(0, Math.min(MAX_YEARS, Math.floor(parseAmount(yearsRaw))));
  const inflationPct = inflationOn ? (inflationRaw.trim() === "" ? DEFAULT_INFLATION_PCT : parseAmount(inflationRaw)) : null;

  const tickerRatePct = mode === "ticker" && cagrData?.ok ? cagrData.cagr * 100 : null;
  const annualRatePct = mode === "manual" ? parseAmount(rate) : (tickerRatePct ?? 0);
  const tickerPending = mode === "ticker" && tickerRatePct == null;

  const result = useMemo(
    () =>
      projectGrowth({
        initial: parseAmount(initial),
        contribution: parseAmount(contribution),
        contributionFrequency: freq,
        annualRatePct,
        rateBasis: mode === "ticker" ? "effective" : "nominal",
        compounding,
        years,
        inflationPct,
      }),
    [initial, contribution, freq, annualRatePct, mode, compounding, years, inflationPct],
  );

  /* ---------- Chart ---------- */
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => setHoverIdx(null), [years]);

  const chart = useMemo(() => {
    const pts = result.points;
    if (pts.length < 2) return null;
    const finite = (v: number | null) => (v != null && Number.isFinite(v) ? v : 0);
    const maxV = Math.max(1, ...pts.map((p) => Math.max(finite(p.balance), finite(p.contributions), finite(p.real))));
    if (!Number.isFinite(maxV)) return null;
    const ticks = niceTicks(maxV);
    const top = ticks[ticks.length - 1]!;
    const xOf = (i: number) => PAD.left + (i / (pts.length - 1)) * IW;
    const yOf = (v: number) => PAD.top + (1 - Math.min(finite(v), top) / top) * IH;
    const line = (get: (p: (typeof pts)[number]) => number | null) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)} ${yOf(get(p) ?? 0).toFixed(1)}`).join(" ");
    const base = `L${xOf(pts.length - 1).toFixed(1)} ${yOf(0).toFixed(1)} L${xOf(0).toFixed(1)} ${yOf(0).toFixed(1)} Z`;
    const balLine = line((p) => p.balance);
    const conLine = line((p) => p.contributions);
    const realLine = pts[0]!.real != null ? line((p) => p.real) : null;
    const step = Math.max(1, Math.ceil((pts.length - 1) / 8));
    const xTicks = pts.map((p, i) => ({ i, year: p.year })).filter((t) => t.i % step === 0 || t.i === pts.length - 1);
    if (xTicks.length > 1) {
      const lastT = xTicks[xTicks.length - 1]!;
      const prevT = xTicks[xTicks.length - 2]!;
      if (lastT.i - prevT.i < step * 0.5) xTicks.splice(xTicks.length - 2, 1);
    }
    return { pts, xOf, yOf, ticks, balLine, balArea: `${balLine} ${base}`, conLine, conArea: `${conLine} ${base}`, realLine, xTicks };
  }, [result]);

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !chart) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const local = pt.matrixTransform(ctm.inverse());
      if (local.x < PAD.left - 6 || local.x > W - PAD.right + 6) {
        setHoverIdx(null);
        return;
      }
      const n = chart.pts.length - 1;
      setHoverIdx(Math.max(0, Math.min(n, Math.round(((local.x - PAD.left) / IW) * n))));
    },
    [chart],
  );
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => pickAt(e.clientX, e.clientY);
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse") e.currentTarget.setPointerCapture(e.pointerId);
    pickAt(e.clientX, e.clientY);
  };
  const onPointerLeave = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse") setHoverIdx(null);
  };
  const onChartKey = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!chart) return;
    const last = chart.pts.length - 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, (i ?? last) - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setHoverIdx((i) => Math.min(last, (i ?? last) + 1));
    } else if (e.key === "Escape") setHoverIdx(null);
  };
  const tipLeft = useMemo(() => {
    if (!chart || hoverIdx == null) return null;
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !wrap || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = chart.xOf(hoverIdx);
    pt.y = 0;
    return pt.matrixTransform(ctm).x - wrap.getBoundingClientRect().left;
  }, [chart, hoverIdx]);
  const hovered = chart && hoverIdx != null ? chart.pts[hoverIdx] : null;

  const onTickerKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setSuggestOpen(true);
      setActiveSuggest((i) => Math.min(suggestions.length - 1, i + 1));
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActiveSuggest((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = suggestOpen && activeSuggest >= 0 ? suggestions[activeSuggest] : null;
      if (s) choose(s.symbol, s.name);
      else choose(tickerText);
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
    }
  };

  const rateLabel =
    mode === "manual"
      ? `${fmtPct(annualRatePct / 100)} p.a. (manual, compounded ${compounding})`
      : cagrData?.ok
        ? `${fmtPct(cagrData.cagr)} p.a. historical CAGR of ${cagrData.ticker}`
        : "Waiting for a ticker";

  return (
    <section className="rounded-xl border border-border bg-black p-4 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* ---------- Inputs ---------- */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="ci-initial" className={labelCls}>
              Initial deposit
            </label>
            <MoneyInput id="ci-initial" value={initial} onChange={setInitial} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="ci-contrib" className={labelCls}>
              Regular contribution
            </label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <MoneyInput id="ci-contrib" value={contribution} onChange={setContribution} />
              </div>
              <select
                aria-label="Contribution frequency"
                value={freq}
                onChange={(e) => setFreq(e.target.value as ContributionFrequency)}
                className="rounded-md border border-border bg-[#0b1017] px-2 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="annually">Annually</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className={labelCls}>Growth rate</p>
            <div className={toggleWrap} role="group" aria-label="Growth mode">
              <button type="button" aria-pressed={mode === "manual"} onClick={() => setMode("manual")} className={`${toggleBtn} ${mode === "manual" ? toggleOn : toggleOff}`}>
                Manual rate
              </button>
              <button type="button" aria-pressed={mode === "ticker"} onClick={() => setMode("ticker")} className={`${toggleBtn} ${mode === "ticker" ? toggleOn : toggleOff}`}>
                Asset ticker
              </button>
            </div>

            {mode === "manual" ? (
              <div className="space-y-1">
                <MoneyInput id="ci-rate" ariaLabel="Annual rate percent" value={rate} onChange={setRate} prefix="" suffix="% p.a." />
                <p className="text-[11px] text-muted">Any value, no cap. Negative works too. Blank counts as 0%.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={tickerText}
                    placeholder="Search a ticker, e.g. SPY, VAS.AX, BTC-USD"
                    aria-label="Asset ticker"
                    aria-autocomplete="list"
                    aria-expanded={suggestOpen && suggestions.length > 0}
                    onChange={(e) => {
                      skipSearchFor.current = null;
                      setTickerText(e.target.value);
                    }}
                    onKeyDown={onTickerKey}
                    onFocus={() => suggestions.length && setSuggestOpen(true)}
                    onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
                    className={`${inputCls} uppercase placeholder:normal-case`}
                  />
                  {suggestOpen && suggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-[#0f1520] py-1 shadow-xl" role="listbox">
                      {suggestions.map((s, i) => (
                        <li key={s.symbol} role="option" aria-selected={i === activeSuggest}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => choose(s.symbol, s.name)}
                            className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm ${i === activeSuggest ? "bg-accent/20" : "hover:bg-white/5"}`}
                          >
                            <span className="font-mono font-semibold text-foreground">{s.symbol}</span>
                            <span className="truncate text-xs text-muted">{s.name}</span>
                            {s.exchange ? <span className="ml-auto shrink-0 text-[10px] text-muted/70">{s.exchange}</span> : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="mb-1 text-[11px] text-muted">History used for the growth rate</p>
                  <div className={toggleWrap} role="group" aria-label="Historical lookback">
                    {LOOKBACKS.map((lb) => {
                      const disabled = typeof lb === "number" && availableYears != null && lb > availableYears + 0.02;
                      const active = lookback === lb;
                      return (
                        <button
                          key={String(lb)}
                          type="button"
                          disabled={disabled}
                          aria-pressed={active}
                          onClick={() => setLookback(lb)}
                          title={disabled ? "Longer than this ticker's price history" : undefined}
                          className={`${toggleBtn} px-2.5 ${active ? toggleOn : toggleOff} disabled:cursor-not-allowed disabled:opacity-30`}
                        >
                          {lb === "max" ? "Max" : `${lb}Y`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-[#1d2633] bg-[#05080c] p-3 text-xs">
                  {!selected && <p className="text-muted">Pick a ticker to project with its real historical growth rate.</p>}
                  {selected && cagrLoading && <p className="text-muted">Loading {selected.symbol} price history…</p>}
                  {selected && !cagrLoading && cagrData && !cagrData.ok && <p className="text-[#ef6b6b]">{cagrData.error}</p>}
                  {selected && !cagrLoading && cagrData?.ok && (
                    <>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-mono text-lg font-semibold text-foreground">{fmtPct(cagrData.cagr)}</span>
                        <span className="text-muted">p.a. historical CAGR · {cagrData.ticker}</span>
                      </p>
                      {cagrData.name ? <p className="mt-0.5 truncate text-muted">{cagrData.name}</p> : null}
                      <p className="mt-1 text-muted">
                        {fmtDay(cagrData.startDate)} → {fmtDay(cagrData.endDate)} ({cagrData.yearsUsed.toFixed(1)} yrs)
                      </p>
                      <p className="mt-1 text-muted/80">
                        History available from {fmtDay(cagrData.firstAvailableDate)}.
                        {cagrData.clamped ? " Lookback limited to the data that exists." : ""}
                        {cagrData.currency ? ` Rate in ${cagrData.currency}; currency moves vs AUD not included.` : ""}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="ci-years" className={labelCls}>
                Years
              </label>
              <MoneyInput id="ci-years" value={yearsRaw} onChange={setYearsRaw} prefix="" suffix="yrs" placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <p className={labelCls}>Compounding</p>
              <div className={toggleWrap} role="group" aria-label="Compounding frequency">
                {(["monthly", "annually"] as CompoundingFrequency[]).map((c) => (
                  <button key={c} type="button" aria-pressed={compounding === c} onClick={() => setCompounding(c)} className={`${toggleBtn} px-2.5 ${compounding === c ? toggleOn : toggleOff}`}>
                    {c === "monthly" ? "Monthly" : "Yearly"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <details className="group rounded-lg border border-[#1d2633] bg-[#05080c]">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted hover:text-foreground">
              <span className="inline-block transition group-open:rotate-90">›</span> Advanced (optional)
            </summary>
            <div className="space-y-3 border-t border-[#1d2633] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span id="ci-inflation-label" className="text-sm text-foreground">Adjust for inflation</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={inflationOn}
                  aria-labelledby="ci-inflation-label"
                  onClick={() => setInflationOn((v) => !v)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${inflationOn ? "bg-accent" : "bg-[#243041]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${inflationOn ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </div>
              {inflationOn && (
                <div className="space-y-1">
                  <MoneyInput
                    id="ci-inflation"
                    ariaLabel="Inflation rate percent"
                    value={inflationRaw}
                    onChange={setInflationRaw}
                    prefix=""
                    suffix="% p.a."
                    placeholder={String(DEFAULT_INFLATION_PCT)}
                  />
                  <p className="text-[11px] leading-snug text-muted">
                    Blank uses {DEFAULT_INFLATION_PCT}% — the middle of the RBA&apos;s 2–3% target, close to Australia&apos;s
                    average CPI since 1993 (ABS). Type your own to override.
                  </p>
                </div>
              )}
              {!inflationOn && <p className="text-[11px] text-muted">Off by default. Turn on to see values in today&apos;s dollars.</p>}
            </div>
          </details>
        </div>

        {/* ---------- Results + chart ---------- */}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Illustrative projection · {years} {years === 1 ? "year" : "years"}
          </p>
          <div className="mt-2">
            <p className="font-mono text-4xl font-semibold leading-none tabular-nums text-foreground sm:text-5xl">
              {tickerPending ? "—" : fmtMoney(result.finalBalance)}
            </p>
            <p className="mt-2 text-xs text-muted">Projected balance · {rateLabel}</p>
          </div>

          <div className={`mt-5 grid gap-3 ${inflationPct != null ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <div className="rounded-lg border border-[#1d2633] bg-[#05080c] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: C_CONTRIB }} aria-hidden /> Total contributions
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{fmtMoney(result.totalContributions)}</p>
            </div>
            <div className="rounded-lg border border-[#1d2633] bg-[#05080c] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: C_BAL }} aria-hidden /> Total growth
              </p>
              <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${result.totalGrowth < 0 ? "text-[#ef6b6b]" : "text-foreground"}`}>
                {tickerPending ? "—" : fmtMoney(result.totalGrowth)}
              </p>
            </div>
            {inflationPct != null && (
              <div className="rounded-lg border border-[#1d2633] bg-[#05080c] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: C_REAL }} aria-hidden /> In today&apos;s dollars
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{tickerPending ? "—" : fmtMoney(result.finalReal)}</p>
                <p className="text-[10px] text-muted">at {fmtPct(inflationPct / 100, 2)} inflation p.a.</p>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Contributions vs projected value</h2>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4" style={{ background: C_BAL }} /> Projected value
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4" style={{ background: C_CONTRIB }} /> Contributions
              </span>
              {inflationPct != null && (
                <span className="flex items-center gap-1.5">
                  <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: C_REAL }} /> Today&apos;s dollars
                </span>
              )}
            </div>
          </div>

          {tickerPending ? (
            <p className="mt-3 rounded-lg border border-[#1d2633] bg-[#05080c] py-16 text-center text-sm text-muted">
              Choose a ticker to draw the projection.
            </p>
          ) : chart ? (
            <div ref={wrapRef} className="relative mt-3">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="block w-full cursor-crosshair touch-none select-none outline-none focus-visible:ring-1 focus-visible:ring-accent"
                role="img"
                tabIndex={0}
                aria-label="Projected value and cumulative contributions by year. Hover, drag or use arrow keys to inspect a year."
                onPointerMove={onPointerMove}
                onPointerDown={onPointerDown}
                onPointerLeave={onPointerLeave}
                onKeyDown={onChartKey}
              >
                <title>Contributions vs projected value</title>
                <defs>
                  <linearGradient id="ci-bal" x1="0" y1={PAD.top} x2="0" y2={PAD.top + IH} gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={C_BAL} stopOpacity="0.32" />
                    <stop offset="1" stopColor={C_BAL} stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="ci-con" x1="0" y1={PAD.top} x2="0" y2={PAD.top + IH} gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={C_CONTRIB} stopOpacity="0.22" />
                    <stop offset="1" stopColor={C_CONTRIB} stopOpacity="0.04" />
                  </linearGradient>
                </defs>
                {chart.ticks.map((v) => (
                  <g key={v}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={chart.yOf(v)} y2={chart.yOf(v)} stroke="#1a2230" />
                    <text x={PAD.left - 8} y={chart.yOf(v) + 3} textAnchor="end" fontSize={11} fill="#8b9bb4">
                      {fmtMoney(v, true)}
                    </text>
                  </g>
                ))}
                <path d={chart.balArea} fill="url(#ci-bal)" />
                <path d={chart.conArea} fill="url(#ci-con)" />
                <path d={chart.conLine} fill="none" stroke={C_CONTRIB} strokeWidth={1.5} strokeLinejoin="round" />
                {chart.realLine && (
                  <path d={chart.realLine} fill="none" stroke={C_REAL} strokeWidth={1.75} strokeDasharray="5 4" strokeLinejoin="round" />
                )}
                <path d={chart.balLine} fill="none" stroke={C_BAL} strokeWidth={2.25} strokeLinejoin="round" />
                {chart.xTicks.map((t, k) => (
                  <text
                    key={t.i}
                    x={chart.xOf(t.i)}
                    y={H - 9}
                    fontSize={11}
                    fill="#8b9bb4"
                    textAnchor={k === 0 ? "start" : k === chart.xTicks.length - 1 ? "end" : "middle"}
                  >
                    {t.year === 0 ? "Now" : `Yr ${t.year}`}
                  </text>
                ))}
                {hovered && hoverIdx != null && (
                  <g pointerEvents="none">
                    <line x1={chart.xOf(hoverIdx)} x2={chart.xOf(hoverIdx)} y1={PAD.top} y2={H - PAD.bottom} stroke="#c8d0dc" strokeDasharray="3 3" />
                    <circle cx={chart.xOf(hoverIdx)} cy={chart.yOf(hovered.contributions)} r={3.5} fill={C_CONTRIB} stroke="#000" strokeWidth={1.5} />
                    {hovered.real != null && (
                      <circle cx={chart.xOf(hoverIdx)} cy={chart.yOf(hovered.real)} r={3.5} fill={C_REAL} stroke="#000" strokeWidth={1.5} />
                    )}
                    <circle cx={chart.xOf(hoverIdx)} cy={chart.yOf(hovered.balance)} r={4.5} fill={C_BAL} stroke="#000" strokeWidth={1.5} />
                  </g>
                )}
              </svg>
              {hovered && tipLeft != null && (
                <div
                  className="pointer-events-none absolute top-3 z-10 min-w-[180px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
                  style={{ left: `clamp(8px, ${tipLeft + 12}px, calc(100% - 200px))` }}
                >
                  <p className="text-[11px] font-semibold text-[#e8eef7]">{hovered.year === 0 ? "Start" : `End of year ${hovered.year}`}</p>
                  <p className="mt-1 flex justify-between gap-3 text-[11px] tabular-nums">
                    <span className="text-muted">Projected</span>
                    <span className="font-mono font-semibold" style={{ color: C_BAL }}>{fmtMoney(hovered.balance)}</span>
                  </p>
                  <p className="flex justify-between gap-3 text-[11px] tabular-nums">
                    <span className="text-muted">Contributions</span>
                    <span className="font-mono text-[#c8d0dc]">{fmtMoney(hovered.contributions)}</span>
                  </p>
                  <p className="flex justify-between gap-3 text-[11px] tabular-nums">
                    <span className="text-muted">Growth</span>
                    <span className="font-mono text-[#c8d0dc]">{fmtMoney(hovered.balance - hovered.contributions)}</span>
                  </p>
                  {hovered.real != null && (
                    <p className="flex justify-between gap-3 text-[11px] tabular-nums">
                      <span className="text-muted">Today&apos;s $</span>
                      <span className="font-mono" style={{ color: C_REAL }}>{fmtMoney(hovered.real)}</span>
                    </p>
                  )}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">Hover, drag (touch) or focus and use ← → to inspect a year.</p>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-[#1d2633] bg-[#05080c] py-16 text-center text-sm text-muted">
              {years === 0 ? "Set the number of years to draw a projection." : "Values are too large to chart."}
            </p>
          )}

          <p className="mt-5 rounded-lg border border-[#3a4558] bg-[#121820] px-4 py-3 text-xs leading-relaxed text-[#9eb0c8]">
            <strong className="font-semibold text-[#d0d8e4]">Illustrative only, not advice.</strong>{" "}
            {mode === "ticker"
              ? "Asset projections assume the ticker's historical growth rate simply repeats every year — that CAGR is history, not a forecast. Real markets are lumpy, past performance is not a reliable indicator of future returns, and the result ignores fees, taxes and currency moves. "
              : "Assumes a steady rate every year with no fees or taxes. "}
            A rough gauge for study — not a forecast, a recommendation or financial advice (NFA).
          </p>
        </div>
      </div>
    </section>
  );
}
