"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  PERFORMANCE_BENCHMARKS,
  PORTFOLIO_TIMEFRAMES,
  type PortfolioConfig,
  type PortfolioTimeframe,
} from "@/lib/portfolioTypes";

type PctPoint = { t: number; pct: number };

type SeriesPayload = {
  id: string;
  label: string;
  points: PctPoint[];
  latestPct: number | null;
};

type ApiPayload = {
  ok: boolean;
  tf?: string;
  series?: SeriesPayload[];
  error?: string;
  note?: string;
};

type Props = {
  portfolio: PortfolioConfig;
  hasHoldings: boolean;
};

const W = 640;
const H = 220;
const PAD = { top: 24, right: 28, bottom: 24, left: 48 };

const STYLE: Record<string, string> = {
  portfolio: "#4ade80",
  ndx: "#9ca3af",
  spx: "#d1d5db",
  aord: "#6b7280",
};

function fmtPct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function nearest(points: PctPoint[], t: number): PctPoint | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  let best = points[lo];
  if (lo > 0 && Math.abs(points[lo - 1].t - t) <= Math.abs(best.t - t)) {
    best = points[lo - 1];
  }
  return best;
}

function pathFor(
  points: PctPoint[],
  xOf: (t: number) => number,
  yOf: (pct: number) => number,
): string {
  if (!points.length) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(2)} ${yOf(p.pct).toFixed(2)}`)
    .join(" ");
}

export function PerformanceChart({ portfolio, hasHoldings }: Props) {
  const [tf, setTf] = useState<PortfolioTimeframe>("1Y");
  const [series, setSeries] = useState<SeriesPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    svgX: number;
    t: number;
    values: Array<{ id: string; label: string; color: string; pct: number | null }>;
  } | null>(null);

  const holdingsKey = useMemo(() => {
    return JSON.stringify(
      portfolio.holdings.map((h) => ({
        id: h.id,
        kind: h.kind,
        ticker: h.ticker,
        quantity: h.quantity,
        acquiredAt: h.acquiredAt ?? null,
        estimatedValue: h.estimatedValue ?? null,
        estimatedValueCurrency: h.estimatedValueCurrency ?? null,
      })),
    );
  }, [portfolio.holdings]);

  const cash = portfolio.availableCashAud ?? 0;

  const fetchHistory = useCallback(async () => {
    if (!hasHoldings) {
      setSeries([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const holdingsPayload = portfolio.holdings.map((h) => ({
        id: h.id,
        kind: h.kind,
        ticker: h.ticker,
        quantity: h.quantity,
        acquiredAt: h.acquiredAt,
        estimatedValue: h.estimatedValue,
        estimatedValueCurrency: h.estimatedValueCurrency,
      }));
      const params = new URLSearchParams({
        tf,
        cash: String(cash > 0 ? cash : 0),
        holdings: JSON.stringify(holdingsPayload),
      });
      const res = await fetch(`/api/portfolio-history?${params.toString()}`);
      const data = (await res.json()) as ApiPayload;
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setSeries(data.series ?? []);
      } else {
        setSeries(data.series ?? []);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "History fetch failed");
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [hasHoldings, tf, holdingsKey, cash, portfolio.holdings]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  const { xOf, yOf, yTicks, tMin, tMax } = useMemo(() => {
    const allPts = series.flatMap((s) => s.points);
    if (!allPts.length) {
      return {
        xOf: (_t: number) => PAD.left,
        yOf: (_p: number) => H / 2,
        yTicks: [0],
        tMin: 0,
        tMax: 1,
      };
    }
    let tMin = allPts[0].t;
    let tMax = allPts[0].t;
    let pMin = allPts[0].pct;
    let pMax = allPts[0].pct;
    for (const p of allPts) {
      if (p.t < tMin) tMin = p.t;
      if (p.t > tMax) tMax = p.t;
      if (p.pct < pMin) pMin = p.pct;
      if (p.pct > pMax) pMax = p.pct;
    }
    if (tMax <= tMin) tMax = tMin + 1;
    // pad y
    const pad = Math.max(2, (pMax - pMin) * 0.08);
    pMin -= pad;
    pMax += pad;
    if (pMin > 0) pMin = Math.min(0, pMin);
    if (pMax < 0) pMax = Math.max(0, pMax);
    if (pMax === pMin) {
      pMax += 1;
      pMin -= 1;
    }
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const xOf = (t: number) => PAD.left + ((t - tMin) / (tMax - tMin)) * innerW;
    const yOf = (pct: number) => PAD.top + ((pMax - pct) / (pMax - pMin)) * innerH;
    const yTicks = [pMax, (pMax + pMin) / 2, pMin];
    return { xOf, yOf, yTicks, tMin, tMax };
  }, [series]);

  function onMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!series.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const innerW = W - PAD.left - PAD.right;
    const ratio = Math.min(1, Math.max(0, (svgX - PAD.left) / innerW));
    const t = tMin + ratio * (tMax - tMin);
    const values = series.map((s) => {
      const np = nearest(s.points, t);
      return {
        id: s.id,
        label: s.label,
        color: STYLE[s.id] ?? "#a1a1aa",
        pct: np?.pct ?? null,
      };
    });
    const snapped = nearest(series[0]?.points ?? [], t);
    setHover({
      svgX: Math.min(W - 4, Math.max(PAD.left, svgX)),
      t: snapped?.t ?? t,
      values,
    });
  }

  const showEmptyOverlay = !hasHoldings;
  const showLoadingOverlay = hasHoldings && loading && series.length === 0;
  const showErrorOverlay = hasHoldings && !loading && error && series.length === 0;

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
                onClick={() => setTf(t)}
                className={`rounded-full px-2.5 py-1 text-xs transition ${
                  active
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-48 w-full sm:h-56"
          role="img"
          aria-label="Portfolio performance vs indices"
          onMouseMove={hasHoldings ? onMove : undefined}
          onMouseLeave={() => setHover(null)}
        >
          {yTicks.map((yt, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={yOf(yt)}
                x2={W - PAD.right}
                y2={yOf(yt)}
                stroke={i === 1 ? "#1f1f23" : "#27272a"}
                strokeDasharray="4 6"
              />
              <text
                x={8}
                y={yOf(yt) + 4}
                fill="#52525b"
                fontSize="11"
                fontFamily="system-ui,sans-serif"
              >
                {fmtPct(yt, 0)}
              </text>
            </g>
          ))}

          {/* zero line */}
          {series.length > 0 && (
            <line
              x1={PAD.left}
              y1={yOf(0)}
              x2={W - PAD.right}
              y2={yOf(0)}
              stroke="#3f3f46"
              strokeWidth="1"
            />
          )}

          {series.map((s) => (
            <path
              key={s.id}
              d={pathFor(s.points, xOf, yOf)}
              fill="none"
              stroke={STYLE[s.id] ?? "#a1a1aa"}
              strokeWidth={s.id === "portfolio" ? 2.25 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={s.id === "portfolio" ? 1 : 0.85}
            />
          ))}

          {hover && series.length > 0 && (
            <g>
              <line
                x1={hover.svgX}
                y1={PAD.top}
                x2={hover.svgX}
                y2={H - PAD.bottom}
                stroke="#52525b"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>

        {hover && series.length > 0 && (
          <div
            className="pointer-events-none absolute top-3 z-10 max-w-[220px] rounded-lg border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-[11px] shadow-lg"
            style={{
              left: `min(max(8px, calc(${(hover.svgX / W) * 100}% - 60px)), calc(100% - 228px))`,
            }}
          >
            <p className="mb-1 font-medium text-zinc-300">{fmtDate(hover.t)}</p>
            <ul className="space-y-0.5">
              {hover.values.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-zinc-400">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: v.color }}
                    />
                    {v.label}
                  </span>
                  <span className="tabular-nums text-white">
                    {v.pct == null ? "—" : fmtPct(v.pct)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(showEmptyOverlay || showLoadingOverlay || showErrorOverlay) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
            <p className="rounded-lg bg-black/70 px-4 py-2 text-center text-sm text-zinc-400">
              {showEmptyOverlay
                ? "Add holdings to see performance vs Nasdaq 100, S&P 500, and All Ords"
                : showLoadingOverlay
                  ? "Loading history…"
                  : error}
            </p>
          </div>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {PERFORMANCE_BENCHMARKS.map((b) => {
          const live = series.find((s) => s.id === b.id);
          return (
            <li key={b.id} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: b.color }}
                aria-hidden
              />
              {b.label}
              {live?.latestPct != null && (
                <span className="tabular-nums text-zinc-400">
                  {fmtPct(live.latestPct)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {hasHoldings && (
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
          Cumulative % from window start. Missing acquiredAt ⇒ held for full window from earliest
          price. Collectables = flat estimate · cash = flat A$. Quotes via Yahoo · NFA.
        </p>
      )}
    </section>
  );
}
