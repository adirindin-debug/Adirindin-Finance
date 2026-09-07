"use client";

import type { HoldingLive } from "@/lib/portfolioTypes";
import { formatAud, formatPrice } from "@/lib/portfolioCompute";

type Props = {
  holdings: HoldingLive[];
  availableCashAud: number | null;
  onEdit: (id: string) => void;
  onAdd: () => void;
};

function formatRowGain(gainAud: number | null, gainPct: number | null): string {
  if (gainAud == null || gainPct == null) return "—";
  const sign = gainAud >= 0 ? "+" : "−";
  const dollars = Math.abs(gainAud).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pctSign = gainPct >= 0 ? "+" : "−";
  return `${sign}A$${dollars} ${pctSign}${Math.abs(gainPct).toFixed(2)}%`;
}

export function HoldingsListEmpty({ holdings, availableCashAud, onEdit, onAdd }: Props) {
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Add
        </button>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          Highest Holdings ▾
        </span>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center">
          <p className="text-sm text-zinc-400">
            No holdings yet — add ticker, qty, and avg cost basis (AUD)
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
            return (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => onEdit(h.id)}
                  className="flex w-full items-center gap-3 py-3 text-left hover:bg-zinc-950/80"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black"
                    style={{ backgroundColor: h.color }}
                  >
                    {h.ticker.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">{h.ticker}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {h.quantity} | ${formatPrice(h.priceAud)}
                      {h.name ? ` · ${h.name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-white">{formatAud(h.marketValueAud, 2)}</p>
                    <p
                      className={`text-xs ${
                        h.gainAud == null
                          ? "text-zinc-500"
                          : gainPositive
                            ? "text-emerald-400"
                            : "text-rose-400"
                      }`}
                    >
                      {formatRowGain(h.gainAud, h.gainPct)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-zinc-900 px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </div>
        <p className="flex-1 text-sm font-medium text-white">Available Cash</p>
        <p className="text-sm text-zinc-400">
          {availableCashAud == null ? "A$—" : formatAud(availableCashAud, 2)}
        </p>
      </div>
    </section>
  );
}
