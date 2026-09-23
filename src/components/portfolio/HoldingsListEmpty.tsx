"use client";

import {
  POSITION_RETURN_CAPTION,
  type HoldingLive,
  type PositionReturnWindow,
} from "@/lib/portfolioTypes";
import type { DisplayCurrency } from "@/lib/portfolioCompute";
import {
  audToDisplay,
  formatMoney,
  formatPrice,
  returnWindowHint,
  returnWindowHintVsCost,
} from "@/lib/portfolioCompute";
import { HoldingLogo } from "./HoldingLogo";

type Props = {
  holdings: HoldingLive[];
  availableCashAud: number | null;
  returnWindow: PositionReturnWindow;
  /** When true, show personal cost-basis gains (Vs cost toggle). */
  useCostBasis: boolean;
  returnsLoading: boolean;
  /** Briefly highlight a newly added holding */
  highlightId?: string | null;
  displayCurrency?: DisplayCurrency;
  audPerUsd?: number | null;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onEditCash: () => void;
};

function formatRowGain(
  gain: number | null,
  gainPct: number | null,
  currency: DisplayCurrency,
): string {
  if (gain == null || gainPct == null) return "—";
  const prefix = currency === "USD" ? "US$" : "A$";
  const sign = gain >= 0 ? "+" : "−";
  const dollars = Math.abs(gain).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pctSign = gainPct >= 0 ? "+" : "−";
  return `${sign}${prefix}${dollars} ${pctSign}${Math.abs(gainPct).toFixed(2)}%`;
}

export function HoldingsListEmpty({
  holdings,
  availableCashAud,
  returnWindow,
  useCostBasis,
  returnsLoading,
  highlightId = null,
  displayCurrency = "AUD",
  audPerUsd = null,
  onEdit,
  onAdd,
  onEditCash,
}: Props) {
  const empty = holdings.length === 0;

  return (
    <section className="mt-10" aria-label="Holdings">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-white"
          aria-label="Add holding"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Add
        </button>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          {!useCostBasis && returnsLoading
            ? "Updating returns…"
            : `Returns · ${useCostBasis ? returnWindowHintVsCost() : returnWindowHint(returnWindow)}`}
        </span>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center">
          <p className="text-sm text-zinc-400">
            No holdings yet — add a security (ticker + qty + cost) or a
            collectable
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-4 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Add first holding
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {holdings.map((h) => {
            const gainPositive = h.gainAud != null && h.gainAud >= 0;
            const isCollectable = h.kind === "collectable";
            const title = isCollectable ? h.name ?? h.ticker : h.ticker;
            const unitPrice = audToDisplay(h.priceAud, displayCurrency, audPerUsd);
            const pricePrefix = displayCurrency === "USD" ? "US$" : "$";
            const subtitle = isCollectable
              ? [
                  "Collectable",
                  h.notes ? h.notes.slice(0, 40) : null,
                  h.costBasis > 0 ? `cost ${h.costCurrency}` : "value only",
                ]
                  .filter(Boolean)
                  .join(" · ")
              : `${h.quantity} | ${pricePrefix}${formatPrice(unitPrice)}${
                  h.costCurrency === "USD" ? " · cost USD" : ""
                }${h.name ? ` · ${h.name}` : ""}`;

            const gainLabel = (() => {
              if (isCollectable) {
                // Cost gains only when Vs cost is on; market windows (incl. ALL) have no history.
                if (!useCostBasis) return "—";
                if (h.costBasis <= 0) return "est. value";
              }
              const gainDisp = audToDisplay(h.gainAud, displayCurrency, audPerUsd);
              return formatRowGain(gainDisp, h.gainPct, displayCurrency);
            })();

            const isNew = highlightId === h.id;

            return (
              <li
                key={h.id}
                className={
                  isNew
                    ? "rounded-lg bg-emerald-950/35 ring-1 ring-emerald-700/50 transition-colors duration-700"
                    : undefined
                }
              >
                <button
                  type="button"
                  onClick={() => onEdit(h.id)}
                  className="flex w-full items-center gap-3 py-3 text-left hover:bg-zinc-950/80"
                >
                  <HoldingLogo
                    kind={h.kind}
                    ticker={h.ticker}
                    name={h.name}
                    color={h.color}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-semibold text-white">
                      {title}
                      {isNew && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-900/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400"
                          aria-label="Just added"
                        >
                          <span aria-hidden>✓</span>
                          Added
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{subtitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">
                      {formatMoney(
                        audToDisplay(h.marketValueAud, displayCurrency, audPerUsd),
                        displayCurrency,
                        2,
                      )}
                    </p>
                    <p
                      className={`text-xs ${
                        gainLabel === "—" || gainLabel === "est. value"
                          ? "text-zinc-500"
                          : gainPositive
                            ? "text-emerald-400"
                            : "text-rose-400"
                      }`}
                    >
                      {gainLabel}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={onEditCash}
        className="mt-4 flex w-full items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-3 text-left hover:border-zinc-700 hover:bg-zinc-900/60"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Available Cash</p>
          <p className="text-[11px] text-zinc-500">
            Included in total &amp; allocation · tap to edit
          </p>
        </div>
        <p className="text-sm font-semibold text-white">
          {formatMoney(
            audToDisplay(availableCashAud, displayCurrency, audPerUsd),
            displayCurrency,
            2,
          )}
        </p>
      </button>

      {!empty && (
        <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
          {POSITION_RETURN_CAPTION}
        </p>
      )}
    </section>
  );
}
