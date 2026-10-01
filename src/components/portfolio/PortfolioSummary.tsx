"use client";

import { useEffect, useRef, useState } from "react";
import type {
  PortfolioLiveSummary,
  PositionReturnWindow,
} from "@/lib/portfolioTypes";
import type { PortfolioDisplayCurrency } from "@/lib/chartTimeframes";
import {
  DISPLAY_CURRENCIES,
  audToDisplay,
  currencySymbol,
  formatGain,
  formatMoney,
  returnWindowHint,
  returnWindowHintVsCost,
} from "@/lib/portfolioCompute";

/** Small "FX: <source> · as of <date>" line under the value. */
export type FxNote = { source: string; url?: string; asOf: string };

const CURRENCY_NAMES: Record<PortfolioDisplayCurrency, string> = {
  USD: "US dollar",
  AUD: "Australian dollar",
  EUR: "Euro",
  GBP: "British pound",
  JPY: "Japanese yen",
  CAD: "Canadian dollar",
  CHF: "Swiss franc",
  NZD: "New Zealand dollar",
  CNY: "Chinese yuan",
  BTC: "Bitcoin",
};

type Props = {
  portfolioName: string;
  hasHoldings: boolean;
  summary: PortfolioLiveSummary | null;
  /** Period overlay gains (null fields when unavailable) */
  periodGainAud: number | null;
  periodGainPct: number | null;
  periodAvailable: boolean;
  /** Shared with Performance chart chips (drives gain line hint). */
  returnWindow: PositionReturnWindow;
  /** When true, show personal cost-basis gains (Vs cost toggle). */
  useCostBasis: boolean;
  returnsLoading: boolean;
  quotesLoading: boolean;
  quotesError: string | null;
  returnsError: string | null;
  /** User preference (value denomination). */
  displayCurrency: PortfolioDisplayCurrency;
  /** Resolved currency actually used for amounts (falls back to AUD if FX missing). */
  effectiveDisplay: PortfolioDisplayCurrency;
  /** Units of the display currency per 1 AUD. */
  displayPerAud: number | null;
  fxUnavailableHint: string | null;
  fxNote: FxNote | null;
  onDisplayCurrencyChange: (c: PortfolioDisplayCurrency) => void;
  onEditName: () => void;
  onAdd: () => void;
};

export function PortfolioSummary({
  portfolioName,
  hasHoldings,
  summary,
  periodGainAud,
  periodGainPct,
  periodAvailable,
  returnWindow,
  useCostBasis,
  returnsLoading,
  quotesLoading,
  quotesError,
  returnsError,
  displayCurrency,
  effectiveDisplay,
  displayPerAud,
  fxUnavailableHint,
  fxNote,
  onDisplayCurrencyChange,
  onEditName,
  onAdd,
}: Props) {
  const gainAud = useCostBasis ? (summary?.totalGainAud ?? null) : periodGainAud;
  const gainPct = useCostBasis ? (summary?.totalGainPct ?? null) : periodGainPct;
  const showGain =
    hasHoldings &&
    summary &&
    (useCostBasis ? true : periodAvailable) &&
    gainAud != null &&
    gainPct != null;
  const positive = gainAud != null && gainAud >= 0;
  const valueDisplay = audToDisplay(
    summary?.totalMarketValueAud ?? null,
    effectiveDisplay,
    displayPerAud,
  );
  const gainDisplay = audToDisplay(gainAud, effectiveDisplay, displayPerAud);
  const valueLabel =
    !hasHoldings || !summary
      ? formatMoney(null, effectiveDisplay, 2)
      : formatMoney(valueDisplay, effectiveDisplay, 2);

  const statusHint = (() => {
    if (quotesLoading) return "updating quotes…";
    if (!useCostBasis && returnsLoading) return "updating returns…";
    if (quotesError) return "quotes unavailable";
    if (!useCostBasis && returnsError) return "returns unavailable";
    if (!hasHoldings) return "empty";
    if (useCostBasis) return returnWindowHintVsCost();
    return returnWindowHint(returnWindow);
  })();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <section className="px-1" aria-label="Portfolio summary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Portfolio</h1>
          <button
            type="button"
            onClick={onEditName}
            className="mt-1 text-left text-sm text-zinc-500 hover:text-zinc-300"
          >
            {portfolioName || "Add portfolio name"}
            <span className="ml-1 text-zinc-600">▾</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
        >
          + Add
        </button>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {valueLabel}
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {effectiveDisplay}
            </span>
          </p>
          <div ref={menuRef} className="relative">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white hover:border-zinc-700"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              aria-label={`Display currency: ${displayCurrency}`}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className="text-emerald-400">{currencySymbol(displayCurrency).trim()}</span>
              {displayCurrency}
              <span className="text-zinc-500" aria-hidden>
                ▾
              </span>
            </button>
            {menuOpen ? (
              <ul
                role="listbox"
                aria-label="Display currency"
                className="absolute right-0 z-20 mt-1 max-h-80 w-56 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl"
              >
                {DISPLAY_CURRENCIES.map((c) => (
                  <li key={c} role="option" aria-selected={displayCurrency === c}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                        displayCurrency === c
                          ? "bg-emerald-600 text-white"
                          : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                      }`}
                      onClick={() => {
                        onDisplayCurrencyChange(c);
                        setMenuOpen(false);
                      }}
                    >
                      <span className="w-9 font-semibold">{c}</span>
                      <span className={displayCurrency === c ? "text-emerald-50" : "text-zinc-500"}>
                        {CURRENCY_NAMES[c]}
                      </span>
                      <span className="ml-auto font-mono text-[11px] opacity-80">
                        {currencySymbol(c).trim()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-sm">
          {showGain ? (
            <span className={positive ? "text-emerald-400" : "text-rose-400"}>
              {formatGain(gainDisplay, gainPct, effectiveDisplay)}
            </span>
          ) : (
            <span className="text-zinc-500">+— · —%</span>
          )}
          <span className="ml-2 text-xs text-zinc-600">{statusHint}</span>
        </p>
        {fxUnavailableHint ? (
          <p className="mt-1 text-xs text-amber-500/90">{fxUnavailableHint}</p>
        ) : null}
        {fxNote ? (
          <p className="mt-1 text-[11px] text-zinc-600">
            FX:{" "}
            {fxNote.url ? (
              <a
                href={fxNote.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-400"
              >
                {fxNote.source}
              </a>
            ) : (
              fxNote.source
            )}{" "}
            · as of {fxNote.asOf}
          </p>
        ) : null}
      </div>
    </section>
  );
}
