/**
 * Gold-led ~46-year commodity cycle desk chart.
 * Real long-run gold (USD/oz, log) + illustrative repeating cycle silhouette.
 * ONE silhouette shape repeats on every ~46y lap (sampled per lap, same as the
 * sibling cycle charts’ single ridge), stepping up each lap so troughs and peaks
 * rise across cycles (gold's secular uptrend). Cream #f5f0e6 dots sit on
 * every peak / trough zone along the model, with the dates labelled on-chart
 * and listed under it (no hover needed). No shaded areas · clean lines.
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
  GOLD_ANCHOR_NOTES,
  GOLD_CAPTION,
  GOLD_CYCLE_YEARS,
  GOLD_HISTORICAL_POINTS,
  GOLD_PEAK_ANCHORS,
  GOLD_SOURCE_LINE,
  GOLD_TROUGH_NOTES,
  GOLD_TROUGH_OFFSET_YEARS,
  goldLivePhaseLine,
  goldLevelOnLap,
  goldLevelRange,
  goldMarkersBetween,
  goldModelLevelAt,
  goldPeakLevel,
  goldPeakYearsCovering,
  goldTroughLevel,
  janMs,
  type GoldHistoricalPoint,
  type GoldMarker,
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
const PAD = { top: 40, right: 28, bottom: 48, left: 62 };

const GOLD_LINE = "#e8c547";
const MODEL_LINE = "#7ec8ff";
const GRID = "#1c2430";
const AXIS = "#8a97a8";
const MARKER = "#f5f0e6";
/** Historical data-point markers (e.g. Nixon Shock) — distinct from peak/trough cream. */
const HISTORICAL = "#f0a05a";
const LIVE_CREAM = "#f5f0e6";
const YEAR_SEC = 365.2425 * 86400;
/** Model band inside the log axis (fractions of the padded log range). */
const MODEL_LO_FRAC = 0.1;
const MODEL_HI_FRAC = 0.04;

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
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** Narrow (phone) layout: bigger on-chart labels so the dates stay readable. */
  const [narrow, setNarrow] = useState(false);
  const nowMs = useLiveNow();

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setNarrow(w > 0 && w < 560);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fs = narrow ? 1.9 : 1;
  const axisFs = narrow ? 1.5 : 1;

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

  const allPoints = useMemo(() => data?.points ?? [], [data]);

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
    // FULL shows the sketch horizon through the theoretical 2072 peak (+ a little air)
    const lastAnchorSec = Math.floor(janMs(GOLD_PEAK_ANCHORS[GOLD_PEAK_ANCHORS.length - 1]) / 1000);
    const tRight =
      tf === "FULL"
        ? Math.max(t1, lastAnchorSec + 3 * YEAR_SEC)
        : t1 + Math.max((t1 - t0) * 0.02, 86400 * 7);

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

    const yFrom = new Date(t0 * 1000).getUTCFullYear();
    const yTo = new Date(tRight * 1000).getUTCFullYear();

    // Sample the SAME lap shape on every lap (peak → peak); each lap sits one
    // step higher, so troughs and peaks rise across cycles. `u` is the absolute
    // model level here, scaled into the band below.
    const spanYears = Math.max((tRight - t0) / YEAR_SEC, 0.25);
    const perLap = Math.min(20000, Math.max(240, Math.ceil((500 * GOLD_CYCLE_YEARS) / spanYears)));
    const samples: { t: number; u: number }[] = [
      { t: t0, u: goldModelLevelAt(t0 * 1000) },
      { t: tRight, u: goldModelLevelAt(tRight * 1000) },
    ];
    for (const peak of goldPeakYearsCovering(yFrom, yTo)) {
      const a = janMs(peak) / 1000;
      const b = janMs(peak + GOLD_CYCLE_YEARS) / 1000;
      if (b < t0 || a > tRight) continue;
      const iFrom = Math.max(0, Math.floor(((t0 - a) / (b - a)) * perLap));
      const iTo = Math.min(perLap, Math.ceil(((tRight - a) / (b - a)) * perLap));
      for (let i = iFrom; i <= iTo; i++) {
        const frac = i / perLap;
        const t = a + frac * (b - a);
        if (t < t0 || t > tRight) continue;
        samples.push({ t, u: goldLevelOnLap(peak, frac) });
      }
    }
    samples.sort((p, q) => p.t - q.t);

    // Model silhouette scaled into the same log band (illustrative, not a fit)
    const modelLo = yLog0 + (yLog1 - yLog0) * MODEL_LO_FRAC;
    const modelHi = yLog1 - (yLog1 - yLog0) * MODEL_HI_FRAC;
    const range = goldLevelRange(
      t0 * 1000,
      tRight * 1000,
      samples.map((p) => p.u),
    );
    const modelYOfLevel = (level: number) =>
      yOfLog(modelLo + ((level - range.lo) / (range.hi - range.lo)) * (modelHi - modelLo));
    const modelPath = samples
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${xOf(p.t).toFixed(2)} ${modelYOfLevel(p.u).toFixed(2)}`,
      )
      .join(" ");

    const markers = goldMarkersBetween(yFrom - 1, yTo + 1)
      .map((m) => {
        const t = Math.floor(janMs(m.year) / 1000);
        return {
          ...m,
          x: xOf(t),
          y: modelYOfLevel(m.kind === "peak" ? goldPeakLevel(m.year) : goldTroughLevel(m.year)),
          t,
        };
      })
      .filter((m) => m.t >= t0 - 86400 * 30 && m.t <= tRight + 86400 * 30);

    // Log tick candidates
    const tickCandidates = narrow
      ? [35, 100, 200, 400, 1000, 2000, 4000]
      : [20, 35, 100, 200, 400, 800, 1000, 2000, 4000, 8000, 10000];
    const yTicks = tickCandidates.filter(
      (v) => Math.log(v) >= yLog0 && Math.log(v) <= yLog1,
    );

    // Year ticks
    const spanY = yTo - yFrom;
    const baseStep = spanY > 80 ? 20 : spanY > 40 ? 10 : spanY > 15 ? 5 : spanY > 5 ? 2 : 1;
    const yearStep = narrow ? baseStep * 2 : baseStep;
    const xTicks: number[] = [];
    const startYear = Math.ceil(yFrom / yearStep) * yearStep;
    for (let y = startYear; y <= yTo; y += yearStep) xTicks.push(y);

    const historicalMarkers = GOLD_HISTORICAL_POINTS.map((h) => {
      const t = Math.floor(h.t / 1000);
      return { ...h, x: xOf(t), t };
    }).filter((h) => h.t >= t0 - 86400 * 30 && h.t <= tRight + 86400 * 30);

    return {
      t0,
      t1,
      tRight,
      xOf,
      yOf,
      modelYOfLevel,
      pricePath,
      modelPath,
      markers,
      historicalMarkers,
      yTicks,
      xTicks,
      spot: points[points.length - 1]!,
    };
  }, [windowed, tf, narrow]);

  const live = useMemo(() => {
    if (!chart || nowMs == null) return null;
    const tSec = nowMs / 1000;
    if (tSec < chart.t0 || tSec > chart.tRight) return null;
    return {
      x: chart.xOf(tSec),
      y: chart.modelYOfLevel(goldModelLevelAt(nowMs)),
      phaseLine: goldLivePhaseLine(nowMs),
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
          Theory silhouette · one shape, repeats every ~{GOLD_CYCLE_YEARS}y
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full border border-[#0a0a0a]"
            style={{ background: MARKER, boxShadow: "0 0 0 1px #0a0a0a" }}
            aria-hidden
          />
          Peak / trough zone markers (dated)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-0.5 rounded-sm"
            style={{ background: HISTORICAL, boxShadow: "0 0 0 1px rgba(240,160,90,0.35)" }}
            aria-hidden
          />
          Historical data point (e.g. US off gold standard)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#1a1a1a]"
            style={{ background: LIVE_CREAM, boxShadow: "0 0 0 2px rgba(245,240,230,0.35)" }}
            aria-hidden
          />
          Live (today on silhouette)
        </span>
      </div>

      <div
        ref={boxRef}
        className="relative mt-3 overflow-hidden rounded-lg border border-[#222] bg-black"
      >
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
            aria-label="Long-run gold price on a log scale with an illustrative ~46-year gold-led commodity cycle silhouette repeating every lap. Peak zones Jan 1934, 1980, 2026 and 2072 (theoretical); trough zones about 1954, 2000 and 2046 (theoretical); historical marker 15 Aug 1971 for the end of US dollar convertibility into gold (Nixon Shock). Observational study only — not a predictive model or financial advice"
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
                    y={y + 3 * axisFs}
                    textAnchor="end"
                    fill={AXIS}
                    fontSize={10 * axisFs}
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
                    y={H - PAD.bottom + 16 + 6 * (axisFs - 1)}
                    textAnchor="middle"
                    fill={AXIS}
                    fontSize={10 * axisFs}
                    fontFamily="ui-monospace, monospace"
                  >
                    {y}
                  </text>
                </g>
              );
            })}

            <defs>
              <style>{`
                @keyframes gold-live-pulse {
                  0% { opacity: 0.6; r: 6; }
                  70% { opacity: 0; r: 18; }
                  100% { opacity: 0; r: 18; }
                }
                .gold-live-ring {
                  animation: gold-live-pulse 2.4s ease-out infinite;
                }
              `}</style>
            </defs>

            {/* Zone verticals — peaks solid (dashed if theoretical), troughs dotted · no fills */}
            {chart.markers.map((m) => (
              <line
                key={`v-${m.kind}-${m.year}`}
                x1={m.x}
                x2={m.x}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke={MARKER}
                strokeOpacity={m.kind === "peak" ? (m.theoretical ? 0.4 : 0.5) : 0.22}
                strokeWidth={m.kind === "peak" ? 1.25 : 1}
                strokeDasharray={
                  m.kind === "trough" ? "2 4" : m.theoretical ? "4 4" : undefined
                }
              />
            ))}

            {/* Historical data points (e.g. 15 Aug 1971 Nixon Shock) */}
            {chart.historicalMarkers.map((h) => (
              <HistoricalMarker key={`hist-${h.t}`} h={h} fs={fs} short={narrow} />
            ))}

            {/* Model silhouette — same lap shape repeated, clean stroke only */}
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

            {/* Repeating cream dots on every peak / trough zone along the model + dates */}
            {chart.markers.map((m) => (
              <MarkerDot key={`dot-${m.kind}-${m.year}`} m={m} fs={fs} short={narrow} />
            ))}

            {/* Live marker on silhouette */}
            {live ? (
              <g data-live-dot="">
                <circle
                  className="gold-live-ring"
                  cx={live.x}
                  cy={live.y}
                  r={6}
                  fill="none"
                  stroke={LIVE_CREAM}
                  strokeWidth={2}
                />
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
                <LivePill x={live.x} y={live.y} fs={fs} />
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

      <CycleDatesList />

      <p className="mt-3 text-[11px] leading-relaxed text-muted sm:text-xs">
        {GOLD_CAPTION} Model amplitude is scaled to the visible log band for shape only — it is{" "}
        <strong className="font-medium text-foreground/80">not a price forecast</strong>{" "}
        and{" "}
        <strong className="font-medium text-foreground/80">not a predictive model</strong>.{" "}
        {data?.source ? `Source: ${data.source}.` : GOLD_SOURCE_LINE}
      </p>
    </div>
  );
}

/** On-chart dated marker: cream dot on the model + always-visible year label. */
function MarkerDot({
  m,
  fs = 1,
  short = false,
}: {
  m: GoldMarker & { x: number; y: number };
  fs?: number;
  short?: boolean;
}) {
  const isPeak = m.kind === "peak";
  const label = `${isPeak ? "" : "~"}${m.year}${m.theoretical ? "*" : ""}`;
  const text = short ? label : `${isPeak ? "Peak" : "Trough"} ${label}`;
  const nearRight = m.x > W - PAD.right - 40 * fs;
  const nearLeft = m.x < PAD.left + 30 * fs;
  const anchor = nearRight ? "end" : nearLeft ? "start" : "middle";
  const lx = nearRight ? m.x + 4 : nearLeft ? m.x - 4 : m.x;
  return (
    <g>
      <circle cx={m.x} cy={m.y} r={8} fill="#0a0a0a" fillOpacity={0.5} />
      <circle
        cx={m.x}
        cy={m.y}
        r={isPeak ? 4.75 : 4.25}
        fill={MARKER}
        stroke="#0a0a0a"
        strokeWidth={2}
      />
      {isPeak ? (
        <text
          x={lx}
          y={PAD.top - 12 + 2 * (fs - 1)}
          textAnchor={anchor}
          fill={MARKER}
          fillOpacity={m.theoretical ? 0.75 : 0.95}
          fontSize={12 * fs}
          fontFamily="ui-monospace, monospace"
          fontWeight={700}
        >
          {text}
        </text>
      ) : (
        <text
          x={lx}
          y={m.y + 12 + 8 * fs}
          textAnchor={anchor}
          fill={MARKER}
          fillOpacity={m.theoretical ? 0.7 : 0.85}
          fontSize={11 * fs}
          fontFamily="ui-monospace, monospace"
          fontWeight={600}
        >
          {text}
        </text>
      )}
    </g>
  );
}

function LivePill({ x, y, fs = 1 }: { x: number; y: number; fs?: number }) {
  const w = 34 * fs;
  const h = 15 * fs;
  const nearRight = x > W - PAD.right - w - 16;
  const px = nearRight ? x - w - 12 : x + 12;
  const py = y + 12;
  return (
    <g>
      <rect
        x={px}
        y={py}
        width={w}
        height={h}
        rx={3}
        fill="#1a1712"
        stroke={LIVE_CREAM}
        strokeOpacity={0.8}
        strokeWidth={1}
      />
      <text
        x={px + w / 2}
        y={py + h * 0.72}
        textAnchor="middle"
        fill={LIVE_CREAM}
        fontSize={9.5 * fs}
        fontFamily="system-ui, sans-serif"
        fontWeight={800}
      >
        Live
      </text>
    </g>
  );
}


/** Amber vertical + label for a historical data point (not a peak/trough zone). */
function HistoricalMarker({
  h,
  fs = 1,
  short = false,
}: {
  h: GoldHistoricalPoint & { x: number };
  fs?: number;
  short?: boolean;
}) {
  const nearRight = h.x > W - PAD.right - 70 * fs;
  const nearLeft = h.x < PAD.left + 40 * fs;
  const anchor = nearRight ? "end" : nearLeft ? "start" : "middle";
  const lx = nearRight ? h.x + 4 : nearLeft ? h.x - 4 : h.x;
  const line1 = h.label;
  const line2 = short ? "Off gold std" : "US off gold standard";
  // Sit the label in the upper band so it does not collide with peak labels at PAD.top - 12
  const labelY = PAD.top + 14 + 4 * (fs - 1);
  return (
    <g>
      <line
        x1={h.x}
        x2={h.x}
        y1={PAD.top}
        y2={H - PAD.bottom}
        stroke={HISTORICAL}
        strokeOpacity={0.7}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <circle
        cx={h.x}
        cy={H - PAD.bottom}
        r={3.5}
        fill={HISTORICAL}
        stroke="#0a0a0a"
        strokeWidth={1.5}
      />
      <text
        x={lx}
        y={labelY}
        textAnchor={anchor}
        fill={HISTORICAL}
        fillOpacity={0.95}
        fontSize={11 * fs}
        fontFamily="ui-monospace, monospace"
        fontWeight={700}
      >
        {line1}
      </text>
      <text
        x={lx}
        y={labelY + 12 * fs}
        textAnchor={anchor}
        fill={HISTORICAL}
        fillOpacity={0.85}
        fontSize={9.5 * fs}
        fontFamily="system-ui, sans-serif"
        fontWeight={600}
      >
        {line2}
      </text>
    </g>
  );
}

/** Explicit dates list — few peaks / troughs, so show every one (no hover-only). */
function CycleDatesList() {
  const firstPeak = GOLD_PEAK_ANCHORS[0];
  const lastPeak = GOLD_PEAK_ANCHORS[GOLD_PEAK_ANCHORS.length - 1];
  const markers = goldMarkersBetween(firstPeak, lastPeak);
  const peaks = markers.filter((m) => m.kind === "peak");
  const troughs = markers.filter((m) => m.kind === "trough");
  const row = (title: string, items: GoldMarker[], notes: Record<number, string>) => (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c8]">
        {title}
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((m) => (
          <li
            key={`${m.kind}-${m.year}`}
            className="flex items-start gap-2 rounded-md border border-[#222] bg-[#0b0e12] px-3 py-2"
          >
            <span
              className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: MARKER, boxShadow: "0 0 0 2px #0a0a0a, 0 0 0 3px #3a4558" }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block font-mono text-sm font-semibold text-[#f5f0e6]">
                {m.kind === "peak" ? "Jan " : "~"}
                {m.year}
                {m.theoretical ? "*" : ""}
                {m.locked ? (
                  <span className="ml-1.5 align-middle text-[9px] font-medium uppercase tracking-wide text-[#8a97a8]">
                    locked
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                {notes[m.year] ?? (m.theoretical ? "Theoretical — illustrative only." : "")}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <section
      className="mt-4 space-y-3 rounded-lg border border-[#222] bg-black px-4 py-3"
      aria-label="Gold cycle peak and trough zone dates, plus historical data points"
    >
      <p className="text-sm font-semibold text-[#e8eef7]">Cycle dates</p>
      {row("Peak zones · ~46y apart (study anchors)", peaks, GOLD_ANCHOR_NOTES)}
      {row(
        `Trough zones · ~${GOLD_TROUGH_OFFSET_YEARS}y after each peak (from the repeating shape)`,
        troughs,
        GOLD_TROUGH_NOTES,
      )}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9eb0c8]">
          Historical data points
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {GOLD_HISTORICAL_POINTS.map((h) => (
            <li
              key={`hist-list-${h.t}`}
              className="flex items-start gap-2 rounded-md border border-[#3a2a18] bg-[#120e0a] px-3 py-2 sm:col-span-2"
            >
              <span
                className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  background: HISTORICAL,
                  boxShadow: "0 0 0 2px #0a0a0a, 0 0 0 3px rgba(240,160,90,0.45)",
                }}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block font-mono text-sm font-semibold text-[#f0a05a]">
                  {h.label}
                  <span className="ml-1.5 align-middle text-[9px] font-medium uppercase tracking-wide text-[#8a97a8]">
                    historical
                  </span>
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                  {h.note}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] italic text-[#7a8aa0]">
        * theoretical (future) · zones, not exact tops or bottoms · historical markers are context only · NFA
      </p>
    </section>
  );
}
