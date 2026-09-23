"use client";

import type {
  PortfolioLiveSummary,
  PositionReturnWindow,
} from "@/lib/portfolioTypes";
import type { PortfolioDisplayCurrency } from "@/lib/chartTimeframes";
import {
  audToDisplay,
  formatGain,
  formatMoney,
  returnWindowHint,
  returnWindowHintVsCost,
} from "@/lib/portfolioCompute";

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
  /** User preference (AUD|USD). */
  displayCurrency: PortfolioDisplayCurrency;
  /** Resolved currency actually used for $ amounts (falls back to AUD if FX missing). */
  effectiveDisplay: PortfolioDisplayCurrency;
  audPerUsd: number | null;
  fxUnavailableHint: string | null;
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
  audPerUsd,
  fxUnavailableHint,
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
    audPerUsd,
  );
  const gainDisplay = audToDisplay(gainAud, effectiveDisplay, audPerUsd);
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

  const toggleBtn =
    "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-emerald-600 text-white shadow-sm";
  const toggleOff = "bg-transparent text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300";

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
          <div
            className="inline-flex gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950 p-0.5"
            role="group"
            aria-label="Display currency"
          >
            {(["AUD", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`${toggleBtn} ${displayCurrency === c ? toggleOn : toggleOff}`}
                aria-pressed={displayCurrency === c}
                onClick={() => onDisplayCurrencyChange(c)}
              >
                {c}
              </button>
            ))}
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
      </div>
    </section>
  );
}
