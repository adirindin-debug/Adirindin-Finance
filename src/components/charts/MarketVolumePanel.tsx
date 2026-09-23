"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

type Point = { t: number; volumeUsd: number; rawVolumeUsd?: number };
type Payload = {
  ok: boolean;
  currency?: string;
  maWindow?: number;
  seriesKind?: string | null;
  currentVolumeUsd?: number | null;
  currentMarketCapUsd?: number | null;
  rawCurrentVolumeUsd?: number | null;
  currentSource?: string | null;
  points?: Point[];
  historySource?: string | null;
  historyIsProxy?: boolean;
  droppedCorrupt?: number;
  theBlockUrl?: string;
  disclaimer?: string;
  error?: string;
  errors?: string[];
};

type TfKey = "7D" | "30D" | "90D" | "1Y" | "ALL";

type HoverState = {
  svgX: number;
  svgY: number;
  point: Point;
};

const TIMEFRAMES: { key: TfKey; label: string; days: number | null }[] = [
  { key: "7D", label: "7D", days: 7 },
  { key: "30D", label: "30D", days: 30 },
  { key: "90D", label: "90D", days: 90 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "ALL", label: "ALL", days: null },
];

const W = 720;
const H = 240;
const PAD = { top: 20, right: 16, bottom: 32, left: 56 };

function fmtUsdCompact(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtUsdTooltip(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function fmtDateShort(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
  });
}

function fmtDate(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Nearest point by timestamp; points assumed sorted ascending by t. */
function nearestPoint(points: Point[], t: number): Point | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  let best = points[lo]!;
  if (lo > 0 && Math.abs(points[lo - 1]!.t - t) <= Math.abs(best.t - t)) {
    best = points[lo - 1]!;
  }
  return best;
}

export function MarketVolumePanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>("1Y");
  const [hover, setHover] = useState<HoverState | null>(null);
  const mainSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch full history once; window toggles filter client-side (same pattern as FNG).
        const res = await fetch("/api/market-volume?days=1825");
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData({
            ok: false,
            error: e instanceof Error ? e.message : "Fetch failed",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHover(null);
  }, [tf]);

  const allPoints = data?.points ?? [];
  const maWindow = data?.maWindow ?? 7;
  const isMaSeries = data?.seriesKind === "7dma" || allPoints.length >= 2;

  const windowedPoints = useMemo(() => {
    if (allPoints.length < 2) return [];
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    if (meta.days == null) return allPoints;
    const tEnd = allPoints[allPoints.length - 1]!.t;
    const tStart = Math.max(allPoints[0]!.t, tEnd - meta.days * 86400);
    return allPoints.filter((p) => p.t >= tStart && p.t <= tEnd);
  }, [allPoints, tf]);

  const chart = useMemo(() => {
    const points = windowedPoints;
    if (points.length < 2) return null;
    const t0 = points[0]!.t;
    const t1 = points[points.length - 1]!.t;
    let vmin = Infinity;
    let vmax = -Infinity;
    for (const p of points) {
      if (!Number.isFinite(p.volumeUsd)) continue;
      vmin = Math.min(vmin, p.volumeUsd);
      vmax = Math.max(vmax, p.volumeUsd);
    }
    if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) return null;
    const pad = (vmax - vmin) * 0.08 || vmax * 0.05;
    vmin = Math.max(0, vmin - pad);
    vmax = vmax + pad;
    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
    const yOf = (v: number) =>
      PAD.top +
      ((vmax - v) / Math.max(vmax - vmin, 1)) * (H - PAD.top - PAD.bottom);
    const path = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.volumeUsd).toFixed(1)}`,
      )
      .join(" ");
    const ticks = [vmin, (vmin + vmax) / 2, vmax];
    return { path, xOf, yOf, t0, t1, ticks, points };
  }, [windowedPoints]);

  const onMainMouseMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (!chart || chart.points.length < 1) {
        setHover(null);
        return;
      }
      const svg = mainSvgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const svgY = ((e.clientY - rect.top) / rect.height) * H;
      const iw = W - PAD.left - PAD.right;
      if (
        svgX < PAD.left ||
        svgX > W - PAD.right ||
        svgY < PAD.top ||
        svgY > H - PAD.bottom
      ) {
        setHover(null);
        return;
      }
      const t =
        chart.t0 + ((svgX - PAD.left) / Math.max(iw, 1)) * (chart.t1 - chart.t0);
      const maxGapSec = Math.max((chart.t1 - chart.t0) * 0.04, 1.5 * 86400);
      const pt = nearestPoint(chart.points, t);
      if (!pt || Math.abs(pt.t - t) > maxGapSec) {
        setHover(null);
        return;
      }
      setHover({
        svgX: chart.xOf(pt.t),
        svgY: chart.yOf(pt.volumeUsd),
        point: pt,
      });
    },
    [chart],
  );

  const onMainMouseLeave = useCallback(() => {
    setHover(null);
  }, []);

  const hasAnyHistory = allPoints.length >= 2;
  const hasWindowPoints = windowedPoints.length >= 2;

  const headlineLabel = isMaSeries
    ? `${maWindow}-day MA · USD`
    : "24h total volume · USD";

  const subtitle = data?.historyIsProxy
    ? `Public-feed volume as a ${maWindow}-day moving average (fallback source labelled below — not CoinGecko). Compare on The Block for their spot desk series.`
    : `CoinGecko total-market volume as a ${maWindow}-day moving average. Not The Block’s spot exchange desk — compare there for their series.`;

  const toggleBtn =
    "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-accent text-white shadow-sm";
  const toggleOff =
    "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Crypto total-market volume (7-day MA)
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{subtitle}</p>
        </div>
        {data?.currentVolumeUsd != null && (
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {fmtUsdCompact(data.currentVolumeUsd)}
            </p>
            <p className="mt-0.5 text-xs text-muted">{headlineLabel}</p>
            {data.currentSource && (
              <p className="mt-1 max-w-[260px] text-right font-mono text-[10px] text-muted">
                {data.currentSource}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Window
          </span>
          <div
            className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
            role="group"
            aria-label="Market volume timeframe"
          >
            {TIMEFRAMES.map((w) => (
              <button
                key={w.key}
                type="button"
                className={`${toggleBtn} ${tf === w.key ? toggleOn : toggleOff}`}
                aria-pressed={tf === w.key}
                onClick={() => setTf(w.key)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <a
          href={
            data?.theBlockUrl ??
            "https://www.theblock.co/data/crypto-markets/spot/total-exchange-volume-daily"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-border bg-navy/60 px-3 py-2 text-sm text-accent hover:border-accent hover:bg-accent-soft"
        >
          Compare on The Block →
        </a>
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading && (
          <p className="py-16 text-center text-sm text-muted">
            Loading market volume…
          </p>
        )}
        {!loading && data && !data.ok && (
          <p className="py-12 text-center text-sm text-red-400">
            {data.error ?? "Could not load volume"}
          </p>
        )}
        {!loading && data?.ok && !hasAnyHistory && (
          <p className="py-12 text-center text-sm text-muted">
            No volume history available from public feeds right now. Try the
            compare link above, or refresh later.
          </p>
        )}
        {!loading && data?.ok && hasAnyHistory && !hasWindowPoints && (
          <p className="py-12 text-center text-sm text-muted">
            Not enough volume history for this window.
          </p>
        )}
        {!loading && chart && (
          <div className="relative w-full min-w-[320px]">
            <svg
              ref={mainSvgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair"
              role="img"
              aria-label={`Crypto total-market volume ${maWindow}-day moving average USD, ${tf} window. Hover for values.`}
              onMouseMove={onMainMouseMove}
              onMouseLeave={onMainMouseLeave}
            >
              <title>
                Crypto total-market volume {maWindow}-day moving average USD
              </title>
              {chart.ticks.map((v) => (
                <g key={v}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={chart.yOf(v)}
                    y2={chart.yOf(v)}
                    stroke="#243041"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={chart.yOf(v) + 3}
                    textAnchor="end"
                    className="fill-muted"
                    fontSize={10}
                  >
                    {fmtUsdCompact(v)}
                  </text>
                </g>
              ))}
              <path
                d={chart.path}
                fill="none"
                stroke="#3dcc9a"
                strokeWidth={2}
              />
              {hover && (
                <g pointerEvents="none">
                  <line
                    x1={hover.svgX}
                    x2={hover.svgX}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke="#9eb0c8"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.85}
                  />
                  <circle
                    cx={hover.svgX}
                    cy={hover.svgY}
                    r={4}
                    fill="#3dcc9a"
                    stroke="#0c1a2e"
                    strokeWidth={1.5}
                  />
                </g>
              )}
              <text x={PAD.left} y={H - 8} className="fill-muted" fontSize={10}>
                {fmtDateShort(chart.t0)}
              </text>
              <text
                x={W - PAD.right}
                y={H - 8}
                textAnchor="end"
                className="fill-muted"
                fontSize={10}
              >
                {fmtDateShort(chart.t1)}
              </text>
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-10 min-w-[168px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: `clamp(8px, calc(${(hover.svgX / W) * 100}% + 12px), calc(100% - 196px))`,
                  top: 12,
                }}
              >
                <p className="mb-1 text-[11px] font-semibold text-[#e8eef7]">
                  {fmtDate(hover.point.t)}
                </p>
                <p className="flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-[#3dcc9a]"
                      aria-hidden
                    />
                    {maWindow}-day MA
                  </span>
                  <span className="font-mono font-semibold text-[#e8eef7]">
                    {fmtUsdTooltip(hover.point.volumeUsd)}
                  </span>
                </p>
                {hover.point.rawVolumeUsd != null &&
                  Number.isFinite(hover.point.rawVolumeUsd) && (
                    <p className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums">
                      <span className="text-muted">Daily (raw)</span>
                      <span className="font-mono text-[#c5d0de]">
                        {fmtUsdTooltip(hover.point.rawVolumeUsd)}
                      </span>
                    </p>
                  )}
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted">
              Hover for {maWindow}-day MA (and daily raw when available) · snap
              to nearest day
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-muted">
        {data?.historySource && (
          <p>
            Chart series: {data.historySource}.
            {data.droppedCorrupt
              ? ` Dropped ${data.droppedCorrupt} corrupt/outlier single-asset prints before summing.`
              : ""}
          </p>
        )}
        <p>
          {data?.disclaimer ??
            `CoinGecko total-market volume as a ${maWindow}-day moving average. Compare on The Block for their spot desk series.`}
        </p>
      </div>
    </section>
  );
}
