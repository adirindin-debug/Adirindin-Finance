/**
 * Gold-led ~46-year commodity cycle desk chart.
 * Real long-run gold (USD/oz, log) + Anthony’s illustrative model silhouette.
 * No shaded areas · smooth model curve · vertical peak-zone markers.
 * Educational observational sketch · NFA.
 */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  GOLD_CAPTION,
  GOLD_PEAK_ANCHORS,
  GOLD_SOURCE_LINE,
  goldCycleProgress,
  goldLivePhaseLine,
  goldModelUnit,
  goldModelUnitAt,
  goldPeakYearsCovering,
  goldPhaseName,
  janMs,
} from "@/lib/goldCommodityCycle";
import { useLiveNow } from "@/lib/useLiveNow";

type Point = { t: number; c: number };
type Payload = {
  ok: boolean;
  points?: Point[];
  source?: string;
  sourceUrl?: string;
  asOf?: string;
  spot?: number | null;
  warnings?: string[];
  snapshot?: boolean;
  stale?: boolean;
  note?: string;
  error?: string;
};

type TfKey = "FULL" | "100Y" | "50Y" | "20Y" | "10Y" | "YTD";

const TIMEFRAMES: { key: TfKey; label: string; years: number | null }[] = [
  { key: "FULL", label: "Full", years: null },
  { key: "100Y", label: "100Y", years: 100 },
  { key: "50Y", label: "50Y", years: 50 },
  { key: "20Y", label: "20Y", years: 20 },
  { key: "10Y", label: "10Y", years: 10 },
  { key: "YTD", label: "YTD", years: -1 },
];

const W = 860;
const H = 420;
const PAD = { top: 36, right: 28, bottom: 48, left: 62 };

const GOLD_LINE = "#e8c547";
const MODEL_LINE = "#7ec8ff";
const GRID = "#1c2430";
const AXIS = "#8a97a8";
const MARKER = "#f5f0e6";
const LIVE_CREAM = "#f5f0e6";

type HoverState = { svgX: number; svgY: number; point: Point };

function fmtUsd(n: number): string {
  if (n >= 1000) {
    return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
  }
  if (n >= 100) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

function fmtMonth(tSec: number): string {
  return new Date(tSec * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
  });
}

function nearestPoint(points: Point[], tSec: number): Point | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.t < tSec) lo = mid + 1;
    else hi = mid;
  }
  let best = points[lo]!;
  if (lo > 0 && Math.abs(points[lo - 1]!.t - tSec) <= Math.abs(best.t - tSec)) {
    best = points[lo - 1]!;
  }
  return best;
}

/** Decimate for SVG path length while keeping shape. */
function decimate(points: Point[], maxPts: number): Point[] {
  if (points.length <= maxPts) return points;
  const out: Point[] = [];
  const step = (points.length - 1) / (maxPts - 1);
  for (let i = 0; i < maxPts; i++) {
    out.push(points[Math.round(i * step)]!);
  }
  return out;
}

export default function GoldCommodityCycleChart() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>("FULL");
  const [hover, setHover] = useState<HoverState | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const nowMs = useLiveNow();

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const hardStop = setTimeout(() => ac.abort(), 18_000);
    (async () => {
      try {
        const res = await fetch("/api/gold-history", { signal: ac.signal });
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData({
            ok: false,
            error:
              e instanceof Error
                ? e.name === "AbortError"
                  ? "Timed out loading gold history"
                  : e.message
                : "Fetch failed",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(hardStop);
      ac.abort();
    };
  }, []);

  useEffect(() => {
    setHover(null);
  }, [tf]);

  const allPoints = data?.points ?? [];

  const windowed = useMemo(() => {
    if (allPoints.length < 2) return [];
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    const tEnd = allPoints[allPoints.length - 1]!.t;
    if (meta.years == null) {
      // Full sketch window: from first locked anchor year
      const tStart = Math.floor(janMs(GOLD_PEAK_ANCHORS[0]) / 1000);
      return allPoints.filter((p) => p.t >= tStart);
    }
    if (meta.years === -1) {
      const y = new Date(tEnd * 1000).getUTCFullYear();
      const tStart = Math.floor(Date.UTC(y, 0, 1) / 1000);
      return allPoints.filter((p) => p.t >= tStart);
    }
    const tStart = Math.max(
      allPoints[0]!.t,
      tEnd - Math.round(meta.years * 365.2425 * 86400),
    );
    return allPoints.filter((p) => p.t >= tStart && p.t <= tEnd);
  }, [allPoints, tf]);

  const chart = useMemo(() => {
    const points = windowed;
    if (points.length < 2) return null;

    const t0 = points[0]!.t;
    const t1 = points[points.length - 1]!.t;
    // Extend x slightly past last print so 2026/2072 markers can sit on-canvas when in view
    const lastAnchorSec = Math.floor(janMs(GOLD_PEAK_ANCHORS[GOLD_PEAK_ANCHORS.length - 1]) / 1000);
    const tMax = Math.max(t1, Math.min(lastAnchorSec, t1 + 50 * 365.2425 * 86400));
    // For FULL, show through ~2072 sketch horizon
    const tRight = tf === "FULL" ? Math.max(tMax, lastAnchorSec) : t1;

    let cMin = Infinity;
    let cMax = -Infinity;
    for (const p of points) {
      if (p.c > 0) {
        cMin = Math.min(cMin, p.c);
        cMax = Math.max(cMax, p.c);
      }
    }
    if (!Number.isFinite(cMin) || !Number.isFinite(cMax) || cMin <= 0) return null;

    const logMin = Math.log(cMin);
    const logMax = Math.log(cMax);
    const pad = (logMax - logMin) * 0.08 || 0.2;
    const yLog0 = logMin - pad;
    const yLog1 = logMax + pad;

    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(tRight - t0, 1)) * (W - PAD.left - PAD.right);
    const yOfLog = (logV: number) =>
      PAD.top +
      ((yLog1 - logV) / Math.max(yLog1 - yLog0, 1e-9)) * (H - PAD.top - PAD.bottom);
    const yOf = (c: number) => yOfLog(Math.log(Math.max(c, 1e-9)));

    const drawn = decimate(points, tf === "FULL" || tf === "100Y" ? 720 : 480);
    const pricePath = drawn
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.t).toFixed(2)} ${yOf(p.c).toFixed(2)}`)
      .join(" ");

    // Model silhouette: unit curve scaled into the same log band (illustrative, not a fit)
    const modelLo = yLog0 + (yLog1 - yLog0) * 0.06;
    const modelHi = yLog1 - (yLog1 - yLog0) * 0.04;
    const modelSteps = 160;
    const modelParts: string[] = [];
    for (let i = 0; i <= modelSteps; i++) {
      const t = t0 + ((tRight - t0) * i) / modelSteps;
      const unit = goldModelUnitAt(t * 1000);
      const logV = modelLo + unit * (modelHi - modelLo);
      const x = xOf(t);
      const y = yOfLog(logV);
      modelParts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
    const modelPath = modelParts.join(" ");

    const yFrom = new Date(t0 * 1000).getUTCFullYear();
    const yTo = new Date(tRight * 1000).getUTCFullYear();
    const peakYears = goldPeakYearsCovering(yFrom, yTo).filter((y) => {
      const t = Math.floor(janMs(y) / 1000);
      return t >= t0 - 86400 * 30 && t <= tRight + 86400 * 30;
    });

    // Log tick candidates
    const tickCandidates = [20, 35, 100, 200, 400, 800, 1000, 2000, 4000, 8000, 10000];
    const yTicks = tickCandidates.filter(
      (v) => Math.log(v) >= yLog0 && Math.log(v) <= yLog1,
    );

    // Year ticks
    const spanY = yTo - yFrom;
    const yearStep = spanY > 80 ? 20 : spanY > 40 ? 10 : spanY > 15 ? 5 : spanY > 5 ? 2 : 1;
    const xTicks: number[] = [];
    const startYear = Math.ceil(yFrom / yearStep) * yearStep;
    for (let y = startYear; y <= yTo; y += yearStep) xTicks.push(y);

    return {
      t0,
      t1,
      tRight,
      xOf,
      yOf,
      yOfLog,
      pricePath,
      modelPath,
      peakYears,
      yTicks,
      xTicks,
      cMin,
      cMax,
      spot: points[points.length - 1]!,
    };
  }, [windowed, tf]);

  const live = useMemo(() => {
    if (!chart || nowMs == null) return null;
    const tSec = nowMs / 1000;
    if (tSec < chart.t0 || tSec > chart.tRight) return null;
    const { frac, nextPeak } = goldCycleProgress(nowMs);
    const unit = goldModelUnit(frac);
    // Place Live on the model silhouette (calendar position on the sketch)
    const modelLo =
      Math.log(chart.cMin) -
      (Math.log(chart.cMax) - Math.log(chart.cMin)) * 0.08;
    // Recompute via chart helpers
    const x = chart.xOf(Math.min(chart.tRight, Math.max(chart.t0, tSec)));
    // Project model unit into same band as chart.modelPath
    const logMin = Math.log(chart.cMin);
    const logMax = Math.log(chart.cMax);
    const pad = (logMax - logMin) * 0.08 || 0.2;
    const yLog0 = logMin - pad;
    const yLog1 = logMax + pad;
    const modelLo2 = yLog0 + (yLog1 - yLog0) * 0.06;
    const modelHi2 = yLog1 - (yLog1 - yLog0) * 0.04;
    const logV = modelLo2 + unit * (modelHi2 - modelLo2);
    const y = chart.yOfLog(logV);
    void modelLo;
    void nextPeak;
    return {
      x,
      y,
      phaseLine: goldLivePhaseLine(nowMs),
      phase: goldPhaseName(frac),
    };
  }, [chart, nowMs]);

  const onMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (!chart || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const t =
        chart.t0 +
        ((svgX - PAD.left) / (W - PAD.left - PAD.right)) * (chart.tRight - chart.t0);
      const pt = nearestPoint(windowed, t);
      if (!pt) return;
      setHover({ svgX: chart.xOf(pt.t), svgY: chart.yOf(pt.c), point: pt });
    },
    [chart, windowed],
  );

  const toggleBtn =
    "rounded-md px-2.5 py-1 text-xs font-medium transition sm:text-[13px]";
  const toggleOn = "bg-accent/20 text-accent";
  const toggleOff = "text-muted hover:text-foreground";

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-[#e8eef7]">
            Gold · USD/oz{" "}
            <span className="font-mono text-xs text-muted">(log)</span>
          </p>
          {chart ? (
            <p className="font-mono text-sm text-[#f0c14a]">
              {fmtUsd(data?.spot ?? chart.spot.c)}
              {data?.stale || data?.snapshot ? (
                <span className="ml-2 text-[10px] uppercase tracking-wide text-muted">
                  {data.snapshot ? "snapshot" : "stale"}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <div
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1"
          role="group"
          aria-label="Gold cycle timeframe"
        >
          {TIMEFRAMES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`${toggleBtn} ${tf === t.key ? toggleOn : toggleOff}`}
              aria-pressed={tf === t.key}
              onClick={() => setTf(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted sm:text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-[#e8c547]" aria-hidden />
          Actual gold price
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded bg-[#7ec8ff]"
            style={{ opacity: 0.95 }}
            aria-hidden
          />
          Theory silhouette (illustrative)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#1a1a1a]"
            style={{ background: LIVE_CREAM }}
            aria-hidden
          />
          Live (calendar on silhouette)
        </span>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-lg border border-[#222] bg-black">
        {loading ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted sm:h-[420px]">
            Loading gold history…
          </div>
        ) : !chart ? (
          <div className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-muted sm:h-[420px]">
            {data?.error ?? "Gold history unavailable"}
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label="Long-run gold price on a log scale with Anthony’s ~46-year gold-led commodity cycle silhouette and peak-zone markers at 1934, 1980, 2026 and 2072. Educational sketch only — not financial advice"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          >
            {/* Grid */}
            {chart.yTicks.map((v) => {
              const y = chart.yOf(v);
              return (
                <g key={`y-${v}`}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    stroke={GRID}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill={AXIS}
                    fontSize={10}
                    fontFamily="ui-monospace, monospace"
                  >
                    {fmtUsd(v)}
                  </text>
                </g>
              );
            })}
            {chart.xTicks.map((y) => {
              const x = chart.xOf(Math.floor(janMs(y) / 1000));
              if (x < PAD.left - 2 || x > W - PAD.right + 2) return null;
              return (
                <g key={`x-${y}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke={GRID}
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={H - PAD.bottom + 16}
                    textAnchor="middle"
                    fill={AXIS}
                    fontSize={10}
                    fontFamily="ui-monospace, monospace"
                  >
                    {y}
                  </text>
                </g>
              );
            })}

            {/* Peak-zone vertical markers — no fills */}
            {chart.peakYears.map((year) => {
              const x = chart.xOf(Math.floor(janMs(year) / 1000));
              if (x < PAD.left - 4 || x > W - PAD.right + 4) return null;
              const locked = (GOLD_PEAK_ANCHORS as readonly number[]).includes(year);
              const theoretical = year > 2026;
              return (
                <g key={`peak-${year}`}>
                  <line
                    x1={x}
                    x2={x}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke={MARKER}
                    strokeOpacity={locked ? 0.55 : 0.28}
                    strokeWidth={1.25}
                    strokeDasharray={theoretical ? "4 4" : undefined}
                  />
                  <text
                    x={x + 4}
                    y={PAD.top + 12}
                    fill={MARKER}
                    fillOpacity={locked ? 0.95 : 0.55}
                    fontSize={11}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={600}
                  >
                    {theoretical ? `~${year}*` : year}
                  </text>
                </g>
              );
            })}

            {/* Model silhouette — clean stroke only */}
            <path
              d={chart.modelPath}
              fill="none"
              stroke={MODEL_LINE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.9}
              vectorEffect="non-scaling-stroke"
            />

            {/* Actual gold */}
            <path
              d={chart.pricePath}
              fill="none"
              stroke={GOLD_LINE}
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* Live marker on silhouette */}
            {live ? (
              <g>
                <circle cx={live.x} cy={live.y} r={10} fill="#0a0a0a" fillOpacity={0.45} />
                <circle
                  cx={live.x}
                  cy={live.y}
                  r={5.75}
                  fill={LIVE_CREAM}
                  stroke="#1a1a1a"
                  strokeWidth={2}
                />
                <circle cx={live.x} cy={live.y} r={2} fill="#1a1a1a" />
              </g>
            ) : null}

            {/* Hover crosshair on actual gold */}
            {hover ? (
              <g pointerEvents="none">
                <line
                  x1={hover.svgX}
                  x2={hover.svgX}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke="#f5f0e6"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
                <circle
                  cx={hover.svgX}
                  cy={hover.svgY}
                  r={4}
                  fill={GOLD_LINE}
                  stroke="#0a0a0a"
                  strokeWidth={1.5}
                />
              </g>
            ) : null}
          </svg>
        )}

        {hover && chart ? (
          <div
            className="pointer-events-none absolute left-3 top-3 rounded-md border border-[#3a4558] bg-[#0c1016]/95 px-3 py-2 text-xs text-[#d0d8e4] shadow-lg backdrop-blur sm:left-4 sm:top-4"
            role="status"
          >
            <p className="font-mono font-semibold text-[#f0c14a]">
              {fmtUsd(hover.point.c)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{fmtMonth(hover.point.t)}</p>
          </div>
        ) : null}
      </div>

      {live ? (
        <p className="mt-3 text-sm font-medium text-foreground/90">
          <span className="mr-2 inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden />
            Live
          </span>
          {live.phaseLine}
        </p>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-muted sm:text-xs">
        {GOLD_CAPTION} Model amplitude is scaled to the visible log band for shape only — it is{" "}
        <strong className="font-medium text-foreground/80">not a price forecast</strong>.{" "}
        {data?.source ? `Source: ${data.source}.` : GOLD_SOURCE_LINE}
      </p>
    </div>
  );
}
