"use client";

import { useState } from "react";
import {
  PERFORMANCE_BENCHMARKS,
  PORTFOLIO_TIMEFRAMES,
  type PortfolioTimeframe,
} from "@/lib/portfolioTypes";

type Props = {
  hasHoldings: boolean;
};

export function PerformanceChartEmpty({ hasHoldings }: Props) {
  const [tf, setTf] = useState<PortfolioTimeframe>("ALL");

  return (
    <section className="mt-8" aria-label="Performance vs indices">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Performance
        </h2>
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Timeframe">
          {PORTFOLIO_TIMEFRAMES.map((t) => {
            const active = t === tf;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!hasHoldings}
                onClick={() => setTf(t)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black">
        <svg
          viewBox="0 0 640 220"
          className="h-48 w-full sm:h-56"
          role="img"
          aria-label="Empty performance chart"
        >
          <line x1="48" y1="24" x2="612" y2="24" stroke="#27272a" strokeDasharray="4 6" />
          <line x1="48" y1="110" x2="612" y2="110" stroke="#1f1f23" strokeDasharray="4 6" />
          <line x1="48" y1="196" x2="612" y2="196" stroke="#27272a" strokeDasharray="4 6" />
          <text x="8" y="28" fill="#52525b" fontSize="11" fontFamily="system-ui,sans-serif">
            A$—
          </text>
          <text x="8" y="200" fill="#52525b" fontSize="11" fontFamily="system-ui,sans-serif">
            A$0
          </text>
          {/* Flat baseline placeholder */}
          <path
            d="M48 196 H612"
            fill="none"
            stroke="#3f3f46"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        {!hasHoldings && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <p className="rounded-lg bg-black/70 px-4 py-2 text-center text-sm text-zinc-400">
              Add holdings to see performance vs indices
            </p>
          </div>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {PERFORMANCE_BENCHMARKS.map((b) => (
          <li key={b.id} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: b.color }}
              aria-hidden
            />
            {b.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
