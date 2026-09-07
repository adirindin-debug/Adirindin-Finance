"use client";

import type { PortfolioLiveSummary } from "@/lib/portfolioTypes";
import { formatAud, formatGain } from "@/lib/portfolioCompute";

type Props = {
  portfolioName: string;
  hasHoldings: boolean;
  summary: PortfolioLiveSummary | null;
  quotesLoading: boolean;
  quotesError: string | null;
  onEditName: () => void;
  onAdd: () => void;
};

export function PortfolioSummary({
  portfolioName,
  hasHoldings,
  summary,
  quotesLoading,
  quotesError,
  onEditName,
  onAdd,
}: Props) {
  const gain = summary?.totalGainAud ?? null;
  const gainPct = summary?.totalGainPct ?? null;
  const positive = gain != null && gain >= 0;
  const valueLabel =
    !hasHoldings || !summary
      ? "A$—"
      : formatAud(summary.totalMarketValueAud, 2);

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
        <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {valueLabel}
          <span className="ml-2 text-sm font-normal text-zinc-500">AUD</span>
        </p>
        <p className="mt-2 text-sm">
          {hasHoldings && summary ? (
            <span className={positive ? "text-emerald-400" : "text-rose-400"}>
              {formatGain(gain, gainPct)}
            </span>
          ) : (
            <span className="text-zinc-500">+— · —%</span>
          )}
          <span className="ml-2 text-xs text-zinc-600">
            {quotesLoading
              ? "updating quotes…"
              : quotesError
                ? "quotes unavailable"
                : hasHoldings
                  ? "live · vs cost"
                  : "empty"}
          </span>
        </p>
      </div>
    </section>
  );
}
