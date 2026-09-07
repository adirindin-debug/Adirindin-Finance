import type { PortfolioHolding } from "@/lib/portfolioTypes";

type Props = {
  holdings: PortfolioHolding[];
  availableCashAud: number | null;
};

export function HoldingsListEmpty({ holdings, availableCashAud }: Props) {
  const empty = holdings.length === 0;

  return (
    <section className="mt-10" aria-label="Holdings">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500"
          aria-label="Filter holdings"
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
          </svg>
        </button>
        <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
          Highest Holdings ▾
        </span>
      </div>

      {empty ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center">
          <p className="text-sm text-zinc-400">
            No holdings yet — paste tickers, qty, and cost basis when ready
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            Edit <code className="text-zinc-500">src/data/portfolioHoldings.json</code> later
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-900">
          {holdings.map((h) => (
            <li key={h.ticker} className="flex items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                {h.ticker.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{h.ticker}</p>
                <p className="text-xs text-zinc-500">
                  {h.quantity} | ${h.lastPriceAud?.toFixed(2) ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-white">A$—</p>
                <p className="text-xs text-emerald-400">+— +—%</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Available cash row placeholder */}
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-zinc-900 px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
        </div>
        <p className="flex-1 text-sm font-medium text-white">Available Cash</p>
        <p className="text-sm text-zinc-400">
          {availableCashAud == null ? "A$—" : `A$${availableCashAud.toLocaleString("en-AU")}`}
        </p>
      </div>
    </section>
  );
}
