"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

type Point = { t: number; ratio: number; wilshire: number; m2: number };
type Payload = {
  ok: boolean;
  current?: { ratio: number; wilshire: number; m2: number; t: number };
  points?: Point[];
  wilshireSource?: string;
  m2Source?: string;
  ratioDefinition?: string;
  fredCredits?: string;
  macroMicroUrl?: string;
  note?: string;
  error?: string;
  errors?: string[];
};

type TfKey = "1Y" | "4Y" | "10Y" | "ALL";

type HoverState = {
  svgX: number;
  svgY: number;
  point: Point;
};

const TIMEFRAMES: { key: TfKey; label: string; days: number | null }[] = [
  { key: "1Y", label: "1Y", days: 365 },
  { key: "4Y", label: "4Y", days: 365 * 4 },
  { key: "10Y", label: "10Y", days: 365 * 10 },
  { key: "ALL", label: "ALL", days: null },
];

const W = 720;
const H = 240;
const PAD = { top: 20, right: 16, bottom: 32, left: 48 };

const LINE_COLOR = "#e8873a";

function fmtDateMonth(t: number) {
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

function fmtWilshire(n: number) {
  return n.toLocaleString("en-AU", { maximumFractionDigits: 0 });
}

function fmtM2(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}T`;
  return `${n.toFixed(1)}B`;
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

export function WilshireM2Panel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>("10Y");
  const [hover, setHover] = useState<HoverState | null>(null);
  const mainSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Full monthly history once; window toggles filter client-side.
        const res = await fetch("/api/wilshire-m2");
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

  /** Headline = latest point in the visible window (matches chart end). */
  const headline = useMemo(() => {
    if (windowedPoints.length) {
      const last = windowedPoints[windowedPoints.length - 1]!;
      return {
        ratio: last.ratio,
        wilshire: last.wilshire,
        m2: last.m2,
        t: last.t,
      };
    }
    return data?.current ?? null;
  }, [windowedPoints, data?.current]);

  const chart = useMemo(() => {
    const points = windowedPoints;
    if (points.length < 2) return null;
    const t0 = points[0]!.t;
    const t1 = points[points.length - 1]!.t;
    let vmin = Infinity;
    let vmax = -Infinity;
    for (const p of points) {
      if (!Number.isFinite(p.ratio)) continue;
      vmin = Math.min(vmin, p.ratio);
      vmax = Math.max(vmax, p.ratio);
    }
    if (!Number.isFinite(vmin) || !Number.isFinite(vmax)) return null;
    const pad = (vmax - vmin) * 0.08 || 0.1;
    vmin -= pad;
    vmax += pad;
    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
    const yOf = (v: number) =>
      PAD.top +
      ((vmax - v) / Math.max(vmax - vmin, 1)) * (H - PAD.top - PAD.bottom);
    const path = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.ratio).toFixed(1)}`,
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
      // Monthly series — allow ~45-day snap gap.
      const maxGapSec = Math.max((chart.t1 - chart.t0) * 0.04, 45 * 86400);
      const pt = nearestPoint(chart.points, t);
      if (!pt || Math.abs(pt.t - t) > maxGapSec) {
        setHover(null);
        return;
      }
      setHover({
        svgX: chart.xOf(pt.t),
        svgY: chart.yOf(pt.ratio),
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

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
              Wilshire 5000 / US M2
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
                role="group"
                aria-label="Wilshire to M2 timeframe"
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
              <a
                href={
                  data?.macroMicroUrl ??
                  "https://en.macromicro.me/collections/34/us-stock-relative/24033/wilshire5000-to-us-m2"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-md border border-border bg-navy/60 px-2.5 py-1.5 text-xs text-accent hover:border-accent hover:bg-accent-soft sm:text-sm"
              >
                Compare on MacroMicro →
              </a>
            </div>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Equity market vs money supply ratio from public FRED data (monthly).
            Educational framing only (NFA).
          </p>
        </div>
        {headline && (
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {headline.ratio.toFixed(2)}
            </p>
            <p className="mt-0.5 text-xs text-muted">Wilshire ÷ M2SL</p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {fmtDateMonth(headline.t)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 overflow-x-auto">
        {loading && (
          <p className="py-16 text-center text-sm text-muted">
            Loading Wilshire / M2…
          </p>
        )}
        {!loading && data && !data.ok && (
          <div className="py-12 text-center text-sm text-red-400">
            <p>{data.error ?? "Could not load Wilshire/M2"}</p>
            {data.errors && data.errors.length > 0 && (
              <ul className="mx-auto mt-3 max-w-lg list-disc space-y-1 px-6 text-left text-xs text-muted">
                {data.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {!loading && data?.ok && !hasAnyHistory && (
          <p className="py-12 text-center text-sm text-muted">
            No Wilshire/M2 history available right now.
          </p>
        )}
        {!loading && data?.ok && hasAnyHistory && !hasWindowPoints && (
          <p className="py-12 text-center text-sm text-muted">
            Not enough monthly history for this window.
          </p>
        )}
        {!loading && chart && (
          <div className="relative w-full min-w-[320px]">
            <svg
              ref={mainSvgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair"
              role="img"
              aria-label={`Wilshire 5000 to US M2 ratio, ${tf} window. Hover for values.`}
              onMouseMove={onMainMouseMove}
              onMouseLeave={onMainMouseLeave}
            >
              <title>Wilshire 5000 to US M2 ratio</title>
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
                    {v.toFixed(2)}
                  </text>
                </g>
              ))}
              <path
                d={chart.path}
                fill="none"
                stroke={LINE_COLOR}
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
                    fill={LINE_COLOR}
                    stroke="#0c1a2e"
                    strokeWidth={1.5}
                  />
                </g>
              )}
              <text x={PAD.left} y={H - 8} className="fill-muted" fontSize={10}>
                {fmtDateMonth(chart.t0)}
              </text>
              <text
                x={W - PAD.right}
                y={H - 8}
                textAnchor="end"
                className="fill-muted"
                fontSize={10}
              >
                {fmtDateMonth(chart.t1)}
              </text>
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-10 min-w-[176px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: `clamp(8px, calc(${(hover.svgX / W) * 100}% + 12px), calc(100% - 204px))`,
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
                      style={{ background: LINE_COLOR }}
                      aria-hidden
                    />
                    Ratio
                  </span>
                  <span className="font-mono font-semibold text-[#e8eef7]">
                    {hover.point.ratio.toFixed(3)}
                  </span>
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <span className="text-muted">Wilshire</span>
                  <span className="font-mono text-[#c5d0de]">
                    {fmtWilshire(hover.point.wilshire)}
                  </span>
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <span className="text-muted">M2SL</span>
                  <span className="font-mono text-[#c5d0de]">
                    {fmtM2(hover.point.m2)}
                  </span>
                </p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted">
              Hover for ratio, Wilshire level and M2 · snap to nearest month
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-muted">
        {data?.ratioDefinition && <p>{data.ratioDefinition}</p>}
        {data?.wilshireSource && <p>Wilshire: {data.wilshireSource}</p>}
        {data?.m2Source && <p>M2: {data.m2Source}</p>}
        <p>
          {data?.fredCredits ??
            "Data via FRED®, Federal Reserve Bank of St. Louis."}{" "}
          Concept similar to{" "}
          <a
            href={
              data?.macroMicroUrl ??
              "https://en.macromicro.me/collections/34/us-stock-relative/24033/wilshire5000-to-us-m2"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            MacroMicro Wilshire/M2
          </a>{" "}
          (attribution only — we do not scrape their page).
        </p>
        <p>
          Wilshire 5000® and related marks are trademarks of their owners; FRED® is a
          registered trademark of the Federal Reserve Bank of St. Louis. No endorsement
          implied. {data?.note ?? "Educational only — NFA."}
        </p>
      </div>
    </section>
  );
}
