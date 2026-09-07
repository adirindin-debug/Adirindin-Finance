"use client";

import type { HoldingLive } from "@/lib/portfolioTypes";
import { formatAud } from "@/lib/portfolioCompute";

type Props = {
  holdings: HoldingLive[];
};

function donutSlices(holdings: HoldingLive[]) {
  const withValue = holdings.filter((h) => h.marketValueAud != null && h.marketValueAud > 0);
  const total = withValue.reduce((s, h) => s + (h.marketValueAud ?? 0), 0);
  if (total <= 0) return [] as { color: string; pct: number; start: number }[];

  let start = 0;
  return withValue.map((h) => {
    const pct = ((h.marketValueAud ?? 0) / total) * 100;
    const slice = { color: h.color, pct, start };
    start += pct;
    return slice;
  });
}

/** SVG donut via stroke-dasharray on a circle (circumference 2πr). */
function DonutChart({ holdings }: { holdings: HoldingLive[] }) {
  const slices = donutSlices(holdings);
  const r = 42;
  const c = 2 * Math.PI * r;

  if (slices.length === 0) {
    return (
      <>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#3f3f46" strokeWidth="12" />
        <foreignObject x="20" y="48" width="80" height="30">
          <div className="flex h-full items-center justify-center text-center text-[10px] text-zinc-500">
            No holdings yet
          </div>
        </foreignObject>
      </>
    );
  }

  return (
    <>
      {slices.map((s, i) => {
        const dash = (s.pct / 100) * c;
        const gap = c - dash;
        const offset = c - (s.start / 100) * c + c * 0.25; // start at top
        return (
          <circle
            key={i}
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
          />
        );
      })}
    </>
  );
}

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
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-0" aria-hidden>
            <DonutChart holdings={holdings} />
          </svg>
          {!empty && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-zinc-500">Assets</p>
              <p className="text-sm font-medium text-white">{holdings.length}</p>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm flex-1">
          {empty ? (
            <p className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
              Legend ready for ticker · A$ value · weight %
            </p>
          ) : (
            <ul className="space-y-3">
              {holdings.map((h) => (
                <li key={h.id} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: h.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-white">
                    {h.ticker}
                  </span>
                  <span className="text-zinc-400">
                    {h.weightPct != null ? `${h.weightPct.toFixed(1)}%` : "—%"}
                  </span>
                  <span className="w-24 text-right text-white">
                    {formatAud(h.marketValueAud, 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
