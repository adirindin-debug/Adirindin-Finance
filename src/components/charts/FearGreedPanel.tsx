"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Point = { t: number; value: number; classification: string };
type Payload = {
  ok: boolean;
  current?: { value: number; classification: string; color: string; t: number };
  points?: Point[];
  source?: string;
  sourceUrl?: string;
  /** Optional link to a well-known peer index for comparison (no data republish). */
  compareUrl?: string;
  error?: string;
  note?: string;
};

type TfKey = "7D" | "30D" | "90D" | "1Y" | "ALL";

type DragState = {
  kind: "main" | "brush-move" | "brush-left" | "brush-right";
  startX: number;
  originT0: number;
  originT1: number;
};

const TIMEFRAMES: { key: TfKey; label: string; days: number | null }[] = [
  { key: "7D", label: "7D", days: 7 },
  { key: "30D", label: "30D", days: 30 },
  { key: "90D", label: "90D", days: 90 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "ALL", label: "ALL", days: null },
];

const W = 720;
const H = 220;
const BRUSH_H = 44;
const PAD = { top: 20, right: 16, bottom: 32, left: 40 };
const BRUSH_PAD = { top: 6, right: 16, bottom: 6, left: 40 };

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

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Nearest point by timestamp; points assumed sorted ascending by t. */
function nearestPoint(points: Point[], t: number): Point | null {
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

type HoverState = {
  svgX: number;
  svgY: number;
  point: Point;
};

function pathFor(
  points: Point[],
  xOf: (t: number) => number,
  yOf: (v: number) => number,
) {
  if (points.length < 2) return "";
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.value).toFixed(1)}`,
    )
    .join(" ");
}

function clientXToT(
  clientX: number,
  svg: SVGSVGElement,
  t0: number,
  t1: number,
  padLeft: number,
  padRight: number,
) {
  const rect = svg.getBoundingClientRect();
  const svgX = ((clientX - rect.left) / Math.max(rect.width, 1)) * W;
  const inner = W - padLeft - padRight;
  const ratio = clamp((svgX - padLeft) / Math.max(inner, 1), 0, 1);
  return t0 + ratio * (t1 - t0);
}

type FearGreedPanelProps = {
  endpoint?: string;
  title?: string;
  subtitle?: string;
  chartAriaLabel?: string;
  chartTitle?: string;
  timeframeAriaLabel?: string;
  defaultSource?: string;
  defaultSourceUrl?: string;
  defaultCompareUrl?: string;
  defaultCompareLabel?: string;
};

export function FearGreedPanel({
  endpoint = "/api/fear-greed",
  title = "Fear & Greed Index",
  subtitle = "Independent US stock market sentiment (FearGreedChart.com) — educational only (NFA).",
  chartAriaLabel = "Fear and Greed Index history. Hover for daily values. Drag to zoom.",
  chartTitle = "Fear and Greed Index history",
  timeframeAriaLabel = "Fear and Greed timeframe",
  defaultSource = "FearGreedChart.com Fear & Greed Index (US stocks, independent)",
  defaultSourceUrl = "https://feargreedchart.com/",
  defaultCompareUrl = "https://www.cnn.com/markets/fear-and-greed",
  defaultCompareLabel = "View CNN Fear & Greed",
}: FearGreedPanelProps = {}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>("1Y");
  /** Zoom window within the selected timeframe, in unix seconds. */
  const [zoom, setZoom] = useState<{ t0: number; t1: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draftMain, setDraftMain] = useState<{ x0: number; x1: number } | null>(
    null,
  );
  const [hover, setHover] = useState<HoverState | null>(null);
  const mainSvgRef = useRef<SVGSVGElement | null>(null);
  const brushSvgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const tfWindowRef = useRef<{ t0: number; t1: number } | null>(null);
  const brushRangeRef = useRef<{ t0: number; t1: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(endpoint);
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
  }, [endpoint]);

  const allPoints = data?.points ?? [];

  const tfWindow = useMemo(() => {
    if (allPoints.length < 2) return null;
    const tEnd = allPoints[allPoints.length - 1].t;
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    const tStart =
      meta.days == null
        ? allPoints[0].t
        : Math.max(allPoints[0].t, tEnd - meta.days * 86400);
    return { t0: tStart, t1: tEnd };
  }, [allPoints, tf]);

  useEffect(() => {
    setZoom(null);
    setDraftMain(null);
    setDrag(null);
    dragRef.current = null;
    setHover(null);
  }, [tf]);

  useEffect(() => {
    tfWindowRef.current = tfWindow;
  }, [tfWindow]);

  useEffect(() => {
    if (!tfWindow) {
      brushRangeRef.current = null;
      return;
    }
    brushRangeRef.current = {
      t0: tfWindow.t0,
      t1: tfWindow.t1,
    };
  }, [tfWindow]);

  const view = useMemo(() => {
    if (!tfWindow) return null;
    const t0 = zoom?.t0 ?? tfWindow.t0;
    const t1 = zoom?.t1 ?? tfWindow.t1;
    if (t1 <= t0) return null;
    const points = allPoints.filter((p) => p.t >= t0 && p.t <= t1);
    if (points.length < 2) return null;
    return { t0, t1, points };
  }, [allPoints, tfWindow, zoom]);

  const chart = useMemo(() => {
    if (!view || view.points.length < 2) return null;
    const { t0, t1, points } = view;
    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
    const yOf = (v: number) =>
      PAD.top + ((100 - v) / 100) * (H - PAD.top - PAD.bottom);
    const path = pathFor(points, xOf, yOf);
    const zones = [
      { y0: 75, y1: 100, fill: "rgba(34,197,94,0.12)" },
      { y0: 50, y1: 75, fill: "rgba(132,204,22,0.10)" },
      { y0: 25, y1: 50, fill: "rgba(249,115,22,0.10)" },
      { y0: 0, y1: 25, fill: "rgba(239,68,68,0.12)" },
    ];
    return { path, xOf, yOf, t0, t1, zones, points };
  }, [view]);

  const brush = useMemo(() => {
    if (!tfWindow || allPoints.length < 2) return null;
    const { t0, t1 } = tfWindow;
    const tfPoints = allPoints.filter((p) => p.t >= t0 && p.t <= t1);
    if (tfPoints.length < 2) return null;
    const xOf = (t: number) =>
      BRUSH_PAD.left +
      ((t - t0) / Math.max(t1 - t0, 1)) *
        (W - BRUSH_PAD.left - BRUSH_PAD.right);
    const yOf = (v: number) =>
      BRUSH_PAD.top +
      ((100 - v) / 100) * (BRUSH_H - BRUSH_PAD.top - BRUSH_PAD.bottom);
    const path = pathFor(tfPoints, xOf, yOf);
    const selT0 = zoom?.t0 ?? t0;
    const selT1 = zoom?.t1 ?? t1;
    return {
      path,
      xOf,
      yOf,
      t0,
      t1,
      selT0,
      selT1,
      x0: xOf(selT0),
      x1: xOf(selT1),
    };
  }, [allPoints, tfWindow, zoom]);

  useEffect(() => {
    if (brush) {
      brushRangeRef.current = { t0: brush.t0, t1: brush.t1 };
    }
  }, [brush]);

  const isZoomed =
    !!zoom &&
    !!tfWindow &&
    (zoom.t0 > tfWindow.t0 + 86400 || zoom.t1 < tfWindow.t1 - 86400);

  // Document listeners for brush drag (stable; reads latest via refs)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const win = tfWindowRef.current;
      const range = brushRangeRef.current;
      const svg = brushSvgRef.current;
      if (!d || d.kind === "main" || !win || !range || !svg) return;
      const dt =
        clientXToT(
          e.clientX,
          svg,
          range.t0,
          range.t1,
          BRUSH_PAD.left,
          BRUSH_PAD.right,
        ) -
        clientXToT(
          d.startX,
          svg,
          range.t0,
          range.t1,
          BRUSH_PAD.left,
          BRUSH_PAD.right,
        );
      const minSpan = 2 * 86400;
      let nt0 = d.originT0;
      let nt1 = d.originT1;
      if (d.kind === "brush-move") {
        nt0 = d.originT0 + dt;
        nt1 = d.originT1 + dt;
        const span = nt1 - nt0;
        if (nt0 < win.t0) {
          nt0 = win.t0;
          nt1 = nt0 + span;
        }
        if (nt1 > win.t1) {
          nt1 = win.t1;
          nt0 = nt1 - span;
        }
      } else if (d.kind === "brush-left") {
        nt0 = clamp(d.originT0 + dt, win.t0, d.originT1 - minSpan);
      } else if (d.kind === "brush-right") {
        nt1 = clamp(d.originT1 + dt, d.originT0 + minSpan, win.t1);
      }
      setZoom({ t0: nt0, t1: nt1 });
    };
    const onUp = () => {
      if (!dragRef.current || dragRef.current.kind === "main") return;
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const onMainPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!chart || !tfWindow) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * W;
    const next: DragState = {
      kind: "main",
      startX: svgX,
      originT0: chart.t0,
      originT1: chart.t1,
    };
    dragRef.current = next;
    setDrag(next);
    setDraftMain({ x0: svgX, x1: svgX });
    setHover(null);
  };

  const onMainMouseMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (dragRef.current) {
        setHover(null);
        return;
      }
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
        svgY: chart.yOf(pt.value),
        point: pt,
      });
    },
    [chart],
  );

  const onMainMouseLeave = useCallback(() => {
    setHover(null);
  }, []);

  const onMainPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || dragRef.current.kind !== "main") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * W;
    setDraftMain({
      x0: Math.min(dragRef.current.startX, svgX),
      x1: Math.max(dragRef.current.startX, svgX),
    });
  };

  const onMainPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.kind !== "main" || !chart || !tfWindow) {
      dragRef.current = null;
      setDrag(null);
      setDraftMain(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * W;
    const x0 = Math.min(d.startX, svgX);
    const x1 = Math.max(d.startX, svgX);
    dragRef.current = null;
    setDrag(null);
    setDraftMain(null);
    if (x1 - x0 < 12) return;
    const inner = W - PAD.left - PAD.right;
    const r0 = clamp((x0 - PAD.left) / Math.max(inner, 1), 0, 1);
    const r1 = clamp((x1 - PAD.left) / Math.max(inner, 1), 0, 1);
    const span = chart.t1 - chart.t0;
    let nt0 = chart.t0 + r0 * span;
    let nt1 = chart.t0 + r1 * span;
    if (nt1 - nt0 < 2 * 86400) {
      const mid = (nt0 + nt1) / 2;
      nt0 = mid - 86400;
      nt1 = mid + 86400;
    }
    nt0 = clamp(nt0, tfWindow.t0, tfWindow.t1);
    nt1 = clamp(nt1, tfWindow.t0, tfWindow.t1);
    if (nt1 - nt0 < 86400) return;
    setZoom({ t0: nt0, t1: nt1 });
  };

  const onBrushPointerDown = useCallback(
    (
      e: ReactPointerEvent<SVGElement>,
      kind: "brush-move" | "brush-left" | "brush-right",
    ) => {
      if (!brush || !tfWindow) return;
      e.stopPropagation();
      e.preventDefault();
      const next: DragState = {
        kind,
        startX: e.clientX,
        originT0: brush.selT0,
        originT1: brush.selT1,
      };
      dragRef.current = next;
      setDrag(next);
    },
    [brush, tfWindow],
  );

  const resetZoom = () => {
    setZoom(null);
    dragRef.current = null;
    setDrag(null);
  };

  const current = data?.current;

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
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {subtitle}
          </p>
        </div>
        {current && (
          <div className="text-right">
            <p
              className="font-mono text-4xl font-semibold tabular-nums"
              style={{ color: current.color }}
            >
              {current.value}
            </p>
            <p
              className="mt-0.5 text-sm font-medium"
              style={{ color: current.color }}
            >
              {current.classification}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {fmtDate(current.t)}
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
            aria-label={timeframeAriaLabel}
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
        {isZoomed && (
          <button
            type="button"
            onClick={resetZoom}
            className="rounded-md border border-border bg-navy/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent hover:border-accent hover:bg-accent-soft"
          >
            Reset zoom
          </button>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading && (
          <p className="py-16 text-center text-sm text-muted">
            Loading Fear &amp; Greed…
          </p>
        )}
        {!loading && data && !data.ok && (
          <p className="py-12 text-center text-sm text-red-400">
            {data.error ?? "Could not load Fear & Greed"}
          </p>
        )}
        {!loading && data?.ok && !chart && (
          <p className="py-12 text-center text-sm text-muted">
            Not enough Fear &amp; Greed history for this window.
          </p>
        )}
        {!loading && chart && (
          <>
            <div className="relative w-full min-w-[320px]">
            <svg
              ref={mainSvgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair touch-none"
              role="img"
              aria-label={chartAriaLabel}
              onPointerDown={onMainPointerDown}
              onPointerMove={onMainPointerMove}
              onPointerUp={onMainPointerUp}
              onMouseMove={onMainMouseMove}
              onMouseLeave={onMainMouseLeave}
              onPointerCancel={() => {
                dragRef.current = null;
                setDrag(null);
                setDraftMain(null);
                setHover(null);
              }}
            >
              <title>{chartTitle}</title>
              {chart.zones.map((z) => (
                <rect
                  key={z.y0}
                  x={PAD.left}
                  y={chart.yOf(z.y1)}
                  width={W - PAD.left - PAD.right}
                  height={chart.yOf(z.y0) - chart.yOf(z.y1)}
                  fill={z.fill}
                />
              ))}
              {[0, 25, 50, 75, 100].map((v) => (
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
                    {v}
                  </text>
                </g>
              ))}
              <path
                d={chart.path}
                fill="none"
                stroke="#3b82c4"
                strokeWidth={2}
              />
              {draftMain && draftMain.x1 - draftMain.x0 > 2 && (
                <rect
                  x={draftMain.x0}
                  y={PAD.top}
                  width={draftMain.x1 - draftMain.x0}
                  height={H - PAD.top - PAD.bottom}
                  fill="rgba(59,130,196,0.18)"
                  stroke="#3b82c4"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  pointerEvents="none"
                />
              )}
              {hover && !draftMain && (
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
                    fill="#3b82c4"
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
            {hover && !draftMain && (
              <div
                className="pointer-events-none absolute z-10 min-w-[140px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: `clamp(8px, calc(${(hover.svgX / W) * 100}% + 12px), calc(100% - 168px))`,
                  top: 12,
                }}
              >
                <p className="mb-1 text-[11px] font-semibold text-[#e8eef7]">
                  {fmtDate(hover.point.t)}
                </p>
                <p className="flex items-center justify-between gap-3 text-[11px] tabular-nums">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-[#3b82c4]"
                      aria-hidden
                    />
                    Index
                  </span>
                  <span className="font-mono font-semibold text-[#e8eef7]">
                    {hover.point.value}
                  </span>
                </p>
                {hover.point.classification ? (
                  <p className="mt-1 text-[11px] text-muted">
                    {hover.point.classification}
                  </p>
                ) : null}
              </div>
            )}
            </div>

            {brush && (
              <svg
                ref={brushSvgRef}
                viewBox={`0 0 ${W} ${BRUSH_H}`}
                className="mt-2 w-full min-w-[320px] touch-none"
                role="img"
                aria-label="Zoom brush. Drag the window or its edges."
              >
                <title>Fear and Greed zoom brush</title>
                <rect
                  x={BRUSH_PAD.left}
                  y={BRUSH_PAD.top}
                  width={W - BRUSH_PAD.left - BRUSH_PAD.right}
                  height={BRUSH_H - BRUSH_PAD.top - BRUSH_PAD.bottom}
                  fill="#0c1a2e"
                  rx={4}
                />
                <path
                  d={brush.path}
                  fill="none"
                  stroke="#3b82c4"
                  strokeWidth={1.25}
                  opacity={0.7}
                />
                <rect
                  x={BRUSH_PAD.left}
                  y={BRUSH_PAD.top}
                  width={Math.max(0, brush.x0 - BRUSH_PAD.left)}
                  height={BRUSH_H - BRUSH_PAD.top - BRUSH_PAD.bottom}
                  fill="rgba(15,20,25,0.55)"
                  pointerEvents="none"
                />
                <rect
                  x={brush.x1}
                  y={BRUSH_PAD.top}
                  width={Math.max(0, W - BRUSH_PAD.right - brush.x1)}
                  height={BRUSH_H - BRUSH_PAD.top - BRUSH_PAD.bottom}
                  fill="rgba(15,20,25,0.55)"
                  pointerEvents="none"
                />
                <rect
                  x={brush.x0}
                  y={BRUSH_PAD.top}
                  width={Math.max(4, brush.x1 - brush.x0)}
                  height={BRUSH_H - BRUSH_PAD.top - BRUSH_PAD.bottom}
                  fill="rgba(59,130,196,0.15)"
                  stroke="#3b82c4"
                  strokeWidth={1}
                  className="cursor-grab"
                  onPointerDown={(e) => onBrushPointerDown(e, "brush-move")}
                />
                <rect
                  x={brush.x0 - 4}
                  y={BRUSH_PAD.top}
                  width={8}
                  height={BRUSH_H - BRUSH_PAD.top - BRUSH_PAD.bottom}
                  fill="#3b82c4"
                  rx={2}
                  className="cursor-ew-resize"
                  onPointerDown={(e) => onBrushPointerDown(e, "brush-left")}
                />
                <rect
                  x={brush.x1 - 4}
                  y={BRUSH_PAD.top}
                  width={8}
                  height={BRUSH_H - BRUSH_PAD.top - BRUSH_PAD.bottom}
                  fill="#3b82c4"
                  rx={2}
                  className="cursor-ew-resize"
                  onPointerDown={(e) => onBrushPointerDown(e, "brush-right")}
                />
              </svg>
            )}
            <p className="mt-2 text-[11px] text-muted">
              Hover for daily readings · drag on the chart to zoom · drag the
              brush window or its edges · works with touch drag.
            </p>
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Source:{" "}
        <a
          href={data?.sourceUrl ?? defaultSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {data?.source ?? defaultSource}
        </a>
        . Documented public feed with attribution — not affiliated with or
        endorsed by the source.{" "}
        {(data?.compareUrl ?? defaultCompareUrl) && defaultCompareLabel ? (
          <>
            Compare:{" "}
            <a
              href={data?.compareUrl ?? defaultCompareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {defaultCompareLabel}
            </a>{" "}
            (link-out only — we do not republish that page&apos;s series).{" "}
          </>
        ) : null}
        {data?.note ?? "Educational only — NFA."}
      </p>
    </section>
  );
}
