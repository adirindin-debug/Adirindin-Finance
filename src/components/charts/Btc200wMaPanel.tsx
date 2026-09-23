"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

type Point = {
  t: number;
  price: number;
  ma200w: number;
  pctFromMa: number;
  absFromMa?: number;
};

type Payload = {
  ok: boolean;
  current?: {
    t: number;
    price: number;
    ma200w: number;
    pctFromMa: number;
    absFromMa: number;
    spotIsLive?: boolean;
  };
  points?: Point[];
  maWindowWeeks?: number;
  firstMaDate?: string | null;
  historyStart?: string | null;
  historyEnd?: string | null;
  historyYears?: number;
  maPointCount?: number;
  weeklyCount?: number;
  historySource?: string;
  source?: string;
  sourceUrl?: string;
  note?: string;
  error?: string;
};

type TfKey = "1Y" | "3Y" | "5Y" | "10Y" | "ALL";

type HoverState = {
  svgX: number;
  svgYPrice: number;
  svgYMa: number;
  point: Point;
};

const TIMEFRAMES: { key: TfKey; label: string; days: number | null }[] = [
  { key: "1Y", label: "1Y", days: 365 },
  { key: "3Y", label: "3Y", days: 365 * 3 },
  { key: "5Y", label: "5Y", days: 365 * 5 },
  { key: "10Y", label: "10Y", days: 365 * 10 },
  { key: "ALL", label: "ALL", days: null },
];

const W = 720;
const H = 260;
const PAD = { top: 20, right: 16, bottom: 32, left: 60 };

const PRICE_COLOR = "#f2a900"; // BTC-ish gold on navy
const MA_COLOR = "#3dcc9a";

function fmtUsd(n: number) {
  if (n >= 1000) {
    return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
  }
  return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
}

function fmtUsdCompact(n: number) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtDate(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateShort(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
  });
}

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

/** Nice log-scale tick candidates spanning [vmin, vmax]. */
function logTicks(vmin: number, vmax: number): number[] {
  if (!(vmin > 0) || !(vmax > vmin)) return [vmin, vmax].filter((v) => v > 0);
  const lo = Math.floor(Math.log10(vmin));
  const hi = Math.ceil(Math.log10(vmax));
  const out: number[] = [];
  for (let e = lo; e <= hi; e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= vmin * 0.98 && v <= vmax * 1.02) out.push(v);
    }
  }
  if (out.length < 2) return [vmin, vmax];
  // Cap tick count for readability
  if (out.length > 6) {
    const step = Math.ceil(out.length / 5);
    return out.filter((_, i) => i % step === 0 || i === out.length - 1);
  }
  return out;
}

export function Btc200wMaPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>("ALL");
  const [hover, setHover] = useState<HoverState | null>(null);
  const mainSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/btc-200w-ma");
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

  const windowedPoints = useMemo(() => {
    if (allPoints.length < 2) return [];
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    if (meta.days == null) return allPoints;
    const tEnd = allPoints[allPoints.length - 1]!.t;
    const tStart = Math.max(allPoints[0]!.t, tEnd - meta.days * 86400);
    return allPoints.filter((p) => p.t >= tStart && p.t <= tEnd);
  }, [allPoints, tf]);

  const headline = useMemo(() => {
    if (windowedPoints.length) {
      const last = windowedPoints[windowedPoints.length - 1]!;
      // Prefer live spot from API current when window includes the latest overall point.
      const overallLast = allPoints[allPoints.length - 1];
      if (
        data?.current &&
        overallLast &&
        last.t === overallLast.t
      ) {
        return data.current;
      }
      return {
        t: last.t,
        price: last.price,
        ma200w: last.ma200w,
        pctFromMa: last.pctFromMa,
        absFromMa: last.absFromMa ?? last.price - last.ma200w,
        spotIsLive: false,
      };
    }
    return data?.current ?? null;
  }, [windowedPoints, allPoints, data?.current]);

  const chart = useMemo(() => {
    const points = windowedPoints;
    if (points.length < 2) return null;
    const t0 = points[0]!.t;
    const t1 = points[points.length - 1]!.t;

    let vmin = Infinity;
    let vmax = -Infinity;
    for (const p of points) {
      for (const v of [p.price, p.ma200w]) {
        if (Number.isFinite(v) && v > 0) {
          vmin = Math.min(vmin, v);
          vmax = Math.max(vmax, v);
        }
      }
    }
    if (!Number.isFinite(vmin) || !Number.isFinite(vmax) || vmin <= 0) {
      return null;
    }

    // Log y when price spans orders of magnitude (typical for ALL-time BTC).
    const useLog = vmax / vmin >= 8;
    const padRatio = 0.08;
    if (useLog) {
      const logMin = Math.log10(vmin);
      const logMax = Math.log10(vmax);
      const pad = (logMax - logMin) * padRatio || 0.05;
      vmin = 10 ** (logMin - pad);
      vmax = 10 ** (logMax + pad);
    } else {
      const pad = (vmax - vmin) * padRatio || vmax * 0.05;
      vmin = Math.max(1, vmin - pad);
      vmax = vmax + pad;
    }

    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
    const yOf = (v: number) => {
      const safe = Math.max(v, vmin * 0.5);
      if (useLog) {
        const logMin = Math.log10(vmin);
        const logMax = Math.log10(vmax);
        return (
          PAD.top +
          ((logMax - Math.log10(safe)) / Math.max(logMax - logMin, 1e-9)) *
            (H - PAD.top - PAD.bottom)
        );
      }
      return (
        PAD.top +
        ((vmax - safe) / Math.max(vmax - vmin, 1)) * (H - PAD.top - PAD.bottom)
      );
    };

    const pricePath = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.price).toFixed(1)}`,
      )
      .join(" ");
    const maPath = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.ma200w).toFixed(1)}`,
      )
      .join(" ");

    const ticks = useLog
      ? logTicks(vmin, vmax)
      : [vmin, (vmin + vmax) / 2, vmax];

    return { pricePath, maPath, xOf, yOf, t0, t1, ticks, points, useLog };
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
      const maxGapSec = Math.max((chart.t1 - chart.t0) * 0.04, 10 * 86400);
      const pt = nearestPoint(chart.points, t);
      if (!pt || Math.abs(pt.t - t) > maxGapSec) {
        setHover(null);
        return;
      }
      setHover({
        svgX: chart.xOf(pt.t),
        svgYPrice: chart.yOf(pt.price),
        svgYMa: chart.yOf(pt.ma200w),
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

  const toggleBtn =
    "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-accent text-white shadow-sm";
  const toggleOff =
    "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  const above = headline != null && headline.pctFromMa >= 0;

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Bitcoin · 200-week MA
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            BTC-USD weekly close versus its 200-week simple moving average —
            a long-cycle reference often watched in crypto. Educational only
            (NFA).
          </p>
        </div>
        {headline && (
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {fmtUsd(headline.price)}
            </p>
            <p
              className={`mt-0.5 text-sm font-semibold tabular-nums ${
                above ? "text-[#3dcc9a]" : "text-[#f07178]"
              }`}
            >
              {fmtPct(headline.pctFromMa)}{" "}
              {above ? "above" : "below"} 200W MA
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              MA {fmtUsd(headline.ma200w)}
              {headline.spotIsLive ? " · live spot" : ""} ·{" "}
              {fmtDate(headline.t)}
            </p>
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
            aria-label="Bitcoin 200-week MA timeframe"
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
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: PRICE_COLOR }}
              aria-hidden
            />
            BTC price
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: MA_COLOR }}
              aria-hidden
            />
            200W MA
          </span>
          {chart?.useLog && (
            <span className="rounded border border-border/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
              log y
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading && (
          <p className="py-16 text-center text-sm text-muted">
            Loading Bitcoin 200-week MA…
          </p>
        )}
        {!loading && data && !data.ok && (
          <p className="py-12 text-center text-sm text-red-400">
            {data.error ?? "Could not load Bitcoin 200-week MA"}
          </p>
        )}
        {!loading && data?.ok && !hasAnyHistory && (
          <p className="py-12 text-center text-sm text-muted">
            Not enough weekly history to plot the 200-week MA.
          </p>
        )}
        {!loading && data?.ok && hasAnyHistory && !hasWindowPoints && (
          <p className="py-12 text-center text-sm text-muted">
            Not enough history for this window.
          </p>
        )}
        {!loading && chart && (
          <div className="relative w-full min-w-[320px]">
            <svg
              ref={mainSvgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair"
              role="img"
              aria-label={`Bitcoin price versus 200-week moving average, ${tf} window. Hover for values.`}
              onMouseMove={onMainMouseMove}
              onMouseLeave={onMainMouseLeave}
            >
              <title>Bitcoin price versus 200-week moving average</title>
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
                d={chart.maPath}
                fill="none"
                stroke={MA_COLOR}
                strokeWidth={2}
                strokeDasharray="5 3"
              />
              <path
                d={chart.pricePath}
                fill="none"
                stroke={PRICE_COLOR}
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
                    cy={hover.svgYMa}
                    r={3.5}
                    fill={MA_COLOR}
                    stroke="#0c1a2e"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={hover.svgX}
                    cy={hover.svgYPrice}
                    r={4}
                    fill={PRICE_COLOR}
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
                className="pointer-events-none absolute z-10 min-w-[188px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: `clamp(8px, calc(${(hover.svgX / W) * 100}% + 12px), calc(100% - 216px))`,
                  top: 12,
                }}
              >
                <p className="mb-1 text-[11px] font-semibold text-[#e8eef7]">
                  {fmtDate(hover.point.t)}
                </p>
                <p className="flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: PRICE_COLOR }}
                      aria-hidden
                    />
                    Price
                  </span>
                  <span className="font-mono font-semibold text-[#e8eef7]">
                    {fmtUsd(hover.point.price)}
                  </span>
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: MA_COLOR }}
                      aria-hidden
                    />
                    200W MA
                  </span>
                  <span className="font-mono text-[#c5d0de]">
                    {fmtUsd(hover.point.ma200w)}
                  </span>
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <span className="text-muted">Distance</span>
                  <span
                    className={`font-mono font-semibold ${
                      hover.point.pctFromMa >= 0
                        ? "text-[#3dcc9a]"
                        : "text-[#f07178]"
                    }`}
                  >
                    {fmtPct(hover.point.pctFromMa)} (
                    {fmtUsd(Math.abs(hover.point.absFromMa ?? hover.point.price - hover.point.ma200w))}
                    )
                  </span>
                </p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted">
              Hover for weekly close, 200W MA, and distance · snap to nearest
              week
              {data?.firstMaDate
                ? ` · MA series from ${data.firstMaDate}`
                : ""}
              {data?.historyStart && data?.historyYears
                ? ` · weekly history ~${data.historyYears}y (${data.historyStart}${data.historyEnd ? ` → ${data.historyEnd}` : ""})`
                : ""}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-muted">
        <p>
          Source:{" "}
          <a
            href={data?.sourceUrl ?? "https://www.coinbase.com/price/bitcoin"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {data?.source ?? "Coinbase Exchange BTC-USD"}
          </a>
          .
        </p>
        <p>
          {data?.note ??
            "200-week simple moving average of weekly closes. Educational only — NFA."}
        </p>
      </div>
    </section>
  );
}
