"use client";

import type { HoldingLive } from "@/lib/portfolioTypes";
import { CASH_COLOR, formatAud } from "@/lib/portfolioCompute";

type Slice = { id: string; label: string; color: string; value: number; pct: number; start: number };

type Props = {
  holdings: HoldingLive[];
  cashAud: number;
};

function buildSlices(holdings: HoldingLive[], cashAud: number): Slice[] {
  const withValue = holdings.filter((h) => h.marketValueAud != null && h.marketValueAud > 0);
  const invested = withValue.reduce((s, h) => s + (h.marketValueAud ?? 0), 0);
  const cash = cashAud > 0 ? cashAud : 0;
  const total = invested + cash;
  if (total <= 0) return [];

  let start = 0;
  const slices: Slice[] = withValue.map((h) => {
    const value = h.marketValueAud ?? 0;
    const pct = (value / total) * 100;
    const slice: Slice = {
      id: h.id,
      label: h.kind === "collectable" ? h.name ?? h.ticker : h.ticker,
      color: h.color,
      value,
      pct,
      start,
    };
    start += pct;
    return slice;
  });

  if (cash > 0) {
    const pct = (cash / total) * 100;
    slices.push({
      id: "__cash__",
      label: "Cash",
      color: CASH_COLOR,
      value: cash,
      pct,
      start,
    });
  }
  return slices;
}

/** SVG donut via stroke-dasharray on a circle (circumference 2πr). */
function DonutChart({ slices }: { slices: Slice[] }) {
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
      {slices.map((s) => {
        const dash = (s.pct / 100) * c;
        const gap = c - dash;
        const offset = c - (s.start / 100) * c + c * 0.25; // start at top
        return (
          <circle
            key={s.id}
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

export function AllocationDonutEmpty({ holdings, cashAud }: Props) {
  const slices = buildSlices(holdings, cashAud);
  const empty = holdings.length === 0 && !(cashAud > 0);
  const assetCount = holdings.length + (cashAud > 0 ? 1 : 0);

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
            <DonutChart slices={slices} />
          </svg>
          {!empty && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-zinc-500">Assets</p>
              <p className="text-sm font-medium text-white">{assetCount}</p>
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
              {slices.map((s) => (
                <li key={s.id} className="flex items-center gap-3 text-sm">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-white">
                    {s.label}
                  </span>
                  <span className="text-zinc-400">{s.pct.toFixed(1)}%</span>
                  <span className="w-24 text-right text-white">{formatAud(s.value, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
