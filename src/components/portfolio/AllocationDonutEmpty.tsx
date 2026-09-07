import type { PortfolioHolding } from "@/lib/portfolioTypes";

type Props = {
  holdings: PortfolioHolding[];
};

export function AllocationDonutEmpty({ holdings }: Props) {
  const empty = holdings.length === 0;

  return (
    <section className="mt-10" aria-label="Asset allocation">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Portfolio diversity
        </h2>
        <div className="flex gap-1 rounded-full bg-zinc-900 p-0.5 text-xs">
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-white">Assets</span>
          <span className="px-3 py-1 text-zinc-600">Sector</span>
          <span className="px-3 py-1 text-zinc-600">Geo</span>
          <span className="px-3 py-1 text-zinc-600">Mkt Cap</span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-center sm:gap-10">
        <div className="relative h-52 w-52 shrink-0 sm:h-56 sm:w-56">
          <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
            {/* Empty grey ring */}
            <circle
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke="#3f3f46"
              strokeWidth="12"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-zinc-500">No holdings yet</p>
          </div>
        </div>

        <div className="w-full max-w-sm flex-1">
          {empty ? (
            <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
              Legend ready for ticker · A$ value · weight %
            </p>
          ) : (
            <ul className="space-y-3">
              {holdings.map((h) => (
                <li key={h.ticker} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: h.color ?? "#71717a" }}
                  />
                  <span className="flex-1 font-medium text-white">{h.ticker}</span>
                  <span className="text-zinc-400">—%</span>
                  <span className="w-24 text-right text-white">A$—</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
