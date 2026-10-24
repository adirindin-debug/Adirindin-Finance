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
  DEFAULT_HOMEPAGE_CHART_TIMEFRAME,
  HOMEPAGE_CHART_TIMEFRAMES,
  chartTimeframeLongLabel,
  readStoredHomepageChartTimeframe,
  writeStoredHomepageChartTimeframe,
  type ChartTimeframeKey,
} from "@/lib/chartTimeframes";

type SeriesId = "btc" | "ndx" | "spx" | "aord" | "msci" | "gold" | "case" | "auhouses" | "m2";
type WindowKey = ChartTimeframeKey;
type ChartMode = "line" | "bar";

type PctPoint = { t: number; pct: number };

type SeriesPayload = {
  id: SeriesId;
  label: string;
  ticker: string;
  points: PctPoint[];
  latestPct: number | null;
  startDate?: string;
  coverage?: "full" | "partial";
  source?: string;
  stored?: boolean;
  /** Last real monthly print (ISO date) for low-frequency series like gold. */
  lastObs?: string;
  shortHistory?: boolean;
  frequency?: "daily" | "monthly" | "quarterly";
};

type ApiPayload = {
  ok: boolean;
  title?: string;
  definition?: string;
  window?: WindowKey;
  windowLabel?: string;
  windowShort?: string;
  mode?: "rolling" | "cumulative" | "relative";
  windowDays?: number | null;
  windowSec?: number | null;
  displayFrom?: number | null;
  displayTo?: number | null;
  commonStart?: string | null;
  seriesStarts?: Partial<Record<SeriesId, string>>;
  source?: string;
  series?: SeriesPayload[];
  errors?: Record<string, string>;
  error?: string;
  asOf?: string;
};

const SERIES_STYLE: Record<
  SeriesId,
  { color: string; short: string; chip: string; hint?: string }
> = {
  btc: { color: "#f7931a", short: "BTC", chip: "BTC" },
  spx: { color: "#3dcc9a", short: "SPX", chip: "S&P 500" },
  ndx: { color: "#4c9fff", short: "NDX", chip: "Nasdaq 100" },
  aord: { color: "#e8873a", short: "AORD", chip: "All Ords" },
  msci: { color: "#a78bfa", short: "WORLD", chip: "MSCI World" },
  gold: { color: "#facc15", short: "GOLD", chip: "Gold", hint: "monthly" },
  case: { color: "#f472b6", short: "FHFA", chip: "US real estate" },
  auhouses: { color: "#38bdf8", short: "AU", chip: "AU real estate" },
  m2: {
    color: "#94a3b8",
    short: "M2",
    chip: "US M2",
    hint: "% change, not level",
  },
};

/** Default-on series on first load (all chips on when unset). */
const ALL_SERIES_IDS: SeriesId[] = [
  "btc",
  "spx",
  "ndx",
  "aord",
  "msci",
  "gold",
  "case",
  "auhouses",
  "m2",
];

const DEFAULT_SELECTED: SeriesId[] = [...ALL_SERIES_IDS];

type Dims = { W: number; H: number; PAD: { top: number; right: number; bottom: number; left: number }; gap: number };
/* right pad leaves room for the current-value labels at the line ends */
const DESKTOP: Dims = { W: 920, H: 420, PAD: { top: 40, right: 76, bottom: 36, left: 58 }, gap: 28 };
/* Phones (<640px): a near-square viewBox so the plot is ~340px tall at 390px
   wide and text renders close to its nominal size (no heavy downscale). */
const MOBILE: Dims = { W: 420, H: 440, PAD: { top: 36, right: 50, bottom: 30, left: 12 }, gap: 10 };

function fmtPct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtAxisPct(n: number) {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    const sign = n > 0 ? "+" : "";
    return `${sign}${k >= 10 ? k.toFixed(0) : k.toFixed(1)}k%`;
  }
  return fmtPct(n, 0);
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

function fmtTooltipDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Nearest point by timestamp; points assumed sorted ascending by t. */
function nearestPoint(points: PctPoint[], t: number): PctPoint | null {
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

/**
 * Client (mouse) coords → SVG user-space coords via the screen CTM.
 * The line chart has a fixed CSS height with a fluid width, so the viewBox is
 * letterboxed (preserveAspectRatio xMidYMid meet). Dividing by rect.width
 * ignored that offset/scale and put the hover line off the cursor; the CTM
 * accounts for viewBox scale, letterboxing and any CSS transforms.
 */
function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

/** SVG user-space x → px offset from the left edge of `container` (for HTML tooltips). */
function svgXToContainerPx(
  svg: SVGSVGElement,
  container: HTMLElement,
  svgX: number,
): number | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = svgX;
  pt.y = 0;
  const screen = pt.matrixTransform(ctm);
  return screen.x - container.getBoundingClientRect().left;
}

type LineHover = {
  svgX: number;
  /** Hover line x in CSS px from the chart wrapper's left edge (tooltip anchor). */
  px: number | null;
  t: number;
  dateLabel: string;
  values: Array<{
    id: SeriesId;
    short: string;
    color: string;
    pct: number | null;
    y: number | null;
  }>;
};

function wealth(pct: number) {
  return Math.max(0.08, 1 + pct / 100);
}

function logTicks(minPct: number, maxPct: number): number[] {
  const minW = wealth(minPct);
  const maxW = wealth(maxPct);
  const candidates = [
    -80, -50, -20, 0, 50, 100, 200, 400, 900, 1900, 3900, 7900, 15900, 31900,
  ];
  return candidates.filter((p) => {
    const w = wealth(p);
    return w >= minW * 0.95 && w <= maxW * 1.08;
  });
}

function rangeFor(points: PctPoint[]) {
  if (!points.length) return null;
  let minPct = points[0].pct;
  let maxPct = points[0].pct;
  for (const p of points) {
    if (p.pct < minPct) minPct = p.pct;
    if (p.pct > maxPct) maxPct = p.pct;
  }
  if (minPct > 0) minPct = 0;
  if (maxPct < 0) maxPct = 0;
  const padY = Math.max((maxPct - minPct) * 0.08, 8);
  return { min: minPct - padY, max: maxPct + padY };
}

/**
 * Shared x-domain: API displayFrom → now so every series starts together.
 */
function resolveXDomain(
  series: SeriesPayload[],
  payload: ApiPayload,
  windowKey: WindowKey,
): { minT: number; maxT: number } | null {
  const nowSec = payload.displayTo ?? Math.floor(Date.now() / 1000);

  if (
    payload.displayFrom != null &&
    Number.isFinite(payload.displayFrom) &&
    payload.displayFrom < nowSec
  ) {
    return { minT: payload.displayFrom, maxT: nowSec };
  }
  if (windowKey !== "all" && payload.windowSec != null && payload.windowSec > 0) {
    return { minT: nowSec - payload.windowSec, maxT: nowSec };
  }

  const allPts = series.flatMap((s) => s.points);
  if (!allPts.length) return null;
  let minT = allPts[0].t;
  let maxT = allPts[0].t;
  for (const p of allPts) {
    if (p.t < minT) minT = p.t;
    if (p.t > maxT) maxT = p.t;
  }
  if (maxT < nowSec) maxT = nowSec;
  return { minT, maxT };
}

function buildSharedAxis(
  series: SeriesPayload[],
  payload: ApiPayload,
  windowKey: WindowKey,
  dims: Dims = DESKTOP,
) {
  const { W, H, PAD } = dims;
  const domain = resolveXDomain(series, payload, windowKey);
  if (!domain) return null;
  const { minT, maxT } = domain;

  // Only plot points inside the shared domain (per-series; no cross contamination)
  const clipped = series.map((s) => ({
    ...s,
    points: s.points.filter((p) => p.t >= minT && p.t <= maxT),
  }));

  const allPts = clipped.flatMap((s) => s.points);
  if (!allPts.length) return null;

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const useLog = false;

  let yRange: { min: number; max: number };
  let yScale: (pct: number) => number;
  let yTicks: number[];

  if (useLog) {
    const minW = Math.min(...allPts.map((p) => wealth(p.pct)));
    const maxW = Math.max(...allPts.map((p) => wealth(p.pct)));
    const minL = Math.log(minW);
    const maxL = Math.log(maxW);
    const pad = (maxL - minL) * 0.06 || 0.08;
    const yMinL = minL - pad;
    const yMaxL = maxL + pad;
    yRange = {
      min: (Math.exp(yMinL) - 1) * 100,
      max: (Math.exp(yMaxL) - 1) * 100,
    };
    yScale = (pct: number) =>
      PAD.top +
      (1 - (Math.log(wealth(pct)) - yMinL) / (yMaxL - yMinL || 1)) * ih;
    yTicks = logTicks((minW - 1) * 100, (maxW - 1) * 100);
    if (!yTicks.includes(0) && yRange.min < 0 && yRange.max > 0) {
      yTicks = [...yTicks, 0].sort((a, b) => a - b);
    }
  } else {
    yRange = rangeFor(allPts) ?? { min: 0, max: 100 };
    yScale = (pct: number) =>
      PAD.top +
      (1 - (pct - yRange.min) / (yRange.max - yRange.min || 1)) * ih;
    yTicks = ticks(yRange.min, yRange.max);
  }

  const xScale = (t: number) =>
    PAD.left + ((t - minT) / (maxT - minT || 1)) * iw;

  const paths = clipped
    .filter((s) => s.points.length > 1)
    .map((s) => {
      let d = "";
      s.points.forEach((p, i) => {
        const x = xScale(p.t);
        const y = yScale(p.pct);
        d +=
          i === 0
            ? `M ${x.toFixed(2)} ${y.toFixed(2)}`
            : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      });
      return { id: s.id, d, color: SERIES_STYLE[s.id].color };
    });

  return {
    paths,
    clipped,
    yRange,
    minT,
    maxT,
    yScale,
    xScale,
    yTicks,
    yLog: useLog,
    omitted: [] as SeriesId[],
  };
}

function buildBarLayout(series: SeriesPayload[], dims: Dims = DESKTOP) {
  const { W, H, PAD } = dims;
  const values = series
    .map((s) => ({
      id: s.id,
      label: SERIES_STYLE[s.id].short,
      ticker: s.ticker,
      pct: s.latestPct,
      color: SERIES_STYLE[s.id].color,
    }))
    .filter((v) => v.pct != null) as Array<{
    id: SeriesId;
    label: string;
    ticker: string;
    pct: number;
    color: string;
  }>;

  // Highest → lowest return for the selected window (bar mode only).
  values.sort((a, b) => b.pct - a.pct);

  if (!values.length) return null;

  const minPct = Math.min(0, ...values.map((v) => v.pct));
  const maxPct = Math.max(0, ...values.map((v) => v.pct));
  const padY = Math.max((maxPct - minPct) * 0.12, 8);
  const yRange = { min: minPct - padY, max: maxPct + padY };

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const yScale = (pct: number) =>
    PAD.top +
    (1 - (pct - yRange.min) / (yRange.max - yRange.min || 1)) * ih;

  const groupGap = dims.gap;
  const barW = Math.min(72, (iw - groupGap * (values.length - 1)) / values.length);
  const totalW = values.length * barW + (values.length - 1) * groupGap;
  const startX = PAD.left + (iw - totalW) / 2;
  const zeroY = yScale(0);

  const bars = values.map((v, i) => {
    const x = startX + i * (barW + groupGap);
    const yVal = yScale(v.pct);
    const y = Math.min(yVal, zeroY);
    const h = Math.abs(yVal - zeroY);
    return { ...v, x, y, h, barW, zeroY };
  });

  return { bars, yRange, yScale, zeroY };
}

function ticks(min: number, max: number, n = 5) {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(min + ((max - min) * i) / n);
  return out;
}

function formatStartsLine(payload: ApiPayload | null): string {
  if (!payload?.series?.length) return "";
  const bits = payload.series
    .map((s) => {
      const style = SERIES_STYLE[s.id];
      if (!style) return null;
      const d =
        s.startDate ??
        payload.seriesStarts?.[s.id] ??
        (s.points[0] ? new Date(s.points[0].t * 1000).toISOString().slice(0, 10) : null);
      if (!d) return null;
      return `${style.short} ${d}`;
    })
    .filter(Boolean);
  return bits.length ? bits.join(" · ") : "";
}

function windowCopy(windowKey: WindowKey, payload: ApiPayload | null) {
  if (windowKey === "all") {
    const starts = formatStartsLine(payload);
    return {
      heading: "All-time relative chart",
      kpiSuffix: "% all-time",
      chartTitle: payload?.title ?? "All-time index relative %",
      chartHint: "Selected series · start = 0% · BTC partial from ~Sep 2014",
      aria: "All-time relative percentage returns for selected series",
      loading: "Loading all-time relative returns…",
      footerLead:
        "Compare from the first date NDX, SPX and AORD all exist (NDX daily, Oct 1985). Toggle series chips to show or hide lines; BTC can be toggled on with its shorter history from around Sep 2014",
      startsLine: starts,
      errorLabel: "all-time compare chart",
    };
  }
  const label =
    payload?.windowLabel ?? chartTimeframeLongLabel(windowKey);
  const days = payload?.windowDays;
  const daysBit = days != null ? `~${days}d` : windowKey;
  return {
    heading: `${label} relative chart`,
    kpiSuffix: `${windowKey.toUpperCase()} %`,
    chartTitle: payload?.title ?? `Relative % over ${label}`,
    chartHint: `Shared % scale · from ${daysBit} ago · not price levels`,
    aria: `Relative ${label} percentage returns on a shared Y-axis for selected series`,
    loading: `Loading ${label} relative %…`,
    footerLead: `Educational compare of percentage returns over the same ${label} window (all lines start at 0% on the left)`,
    startsLine: "",
    errorLabel: `${label} compare chart`,
  };
}

export function BtcFourYearChart() {
  const [windowKey, setWindowKey] = useState<WindowKey>(DEFAULT_HOMEPAGE_CHART_TIMEFRAME);
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [selected, setSelected] = useState<Set<SeriesId>>(
    () => new Set(DEFAULT_SELECTED),
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [lineHover, setLineHover] = useState<LineHover | null>(null);
  const lineSvgRef = useRef<SVGSVGElement | null>(null);
  /* Phones (<640px): the 920-wide viewBox shrinks ~2.5x, so axis text is drawn
     larger in viewBox units and tick counts are thinned to stay readable. */
  const [narrow, setNarrow] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const axisFont = narrow ? 11 : 10;
  const dims = narrow ? MOBILE : DESKTOP;
  const { W, H, PAD } = dims;
  const lineWrapRef = useRef<HTMLDivElement | null>(null);

  // Read the homepage preference, preserving legacy shared-key choices.
  useEffect(() => {
    const stored = readStoredHomepageChartTimeframe(DEFAULT_HOMEPAGE_CHART_TIMEFRAME);
    setWindowKey(stored);
  }, []);

  const selectWindow = useCallback((key: WindowKey) => {
    setWindowKey(key);
    writeStoredHomepageChartTimeframe(key);
  }, []);

  const toggleSeries = useCallback((id: SeriesId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    setLineHover(null);
  }, [windowKey, chartMode, selected]);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    // Hard ceiling so relative mode never sits on "Loading…" forever (cold FRED / Vercel).
    const hardStop = setTimeout(() => ac.abort(), 35_000);
    (async () => {
      try {
        setStatus("loading");
        setError(null);
        const r = await fetch(`/api/four-year-gains?window=${windowKey}`, {
          signal: ac.signal,
        });
        const data = (await r.json()) as ApiPayload;
        if (cancelled) return;
        if (!r.ok || !data.ok || !data.series?.length) {
          throw new Error(data.error || "No series returned");
        }
        setPayload(data);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        const msg =
          e instanceof Error
            ? e.name === "AbortError"
              ? "Timed out waiting for market data"
              : e.message
            : "Chart unavailable";
        setError(msg);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(hardStop);
      ac.abort();
    };
  }, [windowKey]);

  const copy = useMemo(
    () => windowCopy(windowKey, payload),
    [windowKey, payload],
  );

  const selectedSeries = useMemo(() => {
    if (!payload?.series?.length) return [] as SeriesPayload[];
    return payload.series.filter((s) => selected.has(s.id));
  }, [payload, selected]);

  const chart = useMemo(() => {
    if (!selectedSeries.length || chartMode !== "line") return null;
    return selectedSeries.length
      ? buildSharedAxis(selectedSeries, payload!, windowKey, dims)
      : null;
  }, [selectedSeries, payload, chartMode, windowKey, dims]);

  const barLayout = useMemo(
    () =>
      selectedSeries.length && chartMode === "bar"
        ? buildBarLayout(selectedSeries, dims)
        : null,
    [selectedSeries, chartMode, dims],
  );

  const activeYRange = chart?.yRange ?? barLayout?.yRange ?? null;
  const activeYScale = chart?.yScale ?? barLayout?.yScale ?? null;

  const yTicks = useMemo(() => {
    let out: number[] = [];
    if (chartMode === "line" && chart?.yTicks?.length) out = chart.yTicks;
    else if (activeYRange) out = ticks(activeYRange.min, activeYRange.max);
    // Narrow screens: keep every other tick (always keeping 0% when present).
    if (narrow && out.length > 6) out = out.filter((v, i) => i % 2 === 0 || v === 0);
    return out;
  }, [chart, chartMode, activeYRange, narrow]);

  const xTicks = useMemo(() => {
    if (!chart) return [];
    // Always tick from the shared domain so 1Y never shows 1988 labels
    const { minT, maxT } = chart;
    const mid1 = minT + (maxT - minT) / 3;
    const mid2 = minT + (2 * (maxT - minT)) / 3;
    if (narrow) return [{ t: minT, pct: 0 }, { t: (minT + maxT) / 2, pct: 0 }, { t: maxT, pct: 0 }];
    return [
      { t: minT, pct: 0 },
      { t: mid1, pct: 0 },
      { t: mid2, pct: 0 },
      { t: maxT, pct: 0 },
    ];
  }, [chart, narrow]);

  const zeroY = useMemo(() => {
    if (!activeYRange || !activeYScale) return null;
    if (activeYRange.min > 0 || activeYRange.max < 0) return null;
    return activeYScale(0);
  }, [activeYRange, activeYScale]);

  const endMarks = useMemo(() => {
    if (!chart || !activeYScale) return [];
    const marks = chart.clipped
      .filter((s) => s.points.length > 1 && !chart.omitted.includes(s.id))
      .map((s) => {
        const last = s.points[s.points.length - 1]!;
        return { id: s.id, color: SERIES_STYLE[s.id].color, pct: last.pct, x: chart.xScale(last.t), y: activeYScale(last.pct), labelY: 0, lead: false };
      })
      .sort((a, b) => a.y - b.y);
    if (marks[0]) marks[0].lead = true;
    // De-overlap labels: keep a minimum vertical gap, then shift up if we ran past the bottom.
    const gap = narrow ? 14 : 13;
    let prev = -Infinity;
    for (const m of marks) {
      m.labelY = Math.max(m.y, prev + gap);
      prev = m.labelY;
    }
    const overflow = prev - (H - PAD.bottom);
    if (overflow > 0) for (const m of marks) m.labelY -= overflow;
    return marks;
  }, [chart, activeYScale, narrow]);

  const onLineMouseMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (!chart || !chart.clipped?.length) {
        setLineHover(null);
        return;
      }
      const svg = lineSvgRef.current;
      if (!svg) return;
      const local = clientToSvgPoint(svg, e.clientX, e.clientY);
      if (!local) return;
      const svgX = local.x;
      const svgY = local.y;
      const iw = W - PAD.left - PAD.right;
      const ih = H - PAD.top - PAD.bottom;
      if (
        svgX < PAD.left ||
        svgX > W - PAD.right ||
        svgY < PAD.top ||
        svgY > PAD.top + ih
      ) {
        setLineHover(null);
        return;
      }
      const { minT, maxT, yScale } = chart;
      const t = minT + ((svgX - PAD.left) / (iw || 1)) * (maxT - minT || 1);
      const maxGapSec = Math.max((maxT - minT) * 0.03, 3 * 86400);

      const values = chart.clipped
        .filter((s) => !chart.omitted.includes(s.id))
        .map((s) => {
        const style = SERIES_STYLE[s.id];
        const pt = nearestPoint(s.points, t);
        if (!pt || Math.abs(pt.t - t) > maxGapSec) {
          return {
            id: s.id,
            short: style.short,
            color: style.color,
            pct: null as number | null,
            y: null as number | null,
          };
        }
        return {
          id: s.id,
          short: style.short,
          color: style.color,
          pct: pt.pct,
          y: yScale(pt.pct),
        };
      });

      const lineX = Math.max(PAD.left, Math.min(W - PAD.right, svgX));
      const wrap = lineWrapRef.current;
      setLineHover({
        svgX: lineX,
        px: wrap ? svgXToContainerPx(svg, wrap, lineX) : null,
        t,
        dateLabel: fmtTooltipDate(t),
        values,
      });
    },
    [chart, W, PAD],
  );

  const onLineMouseLeave = useCallback(() => {
    setLineHover(null);
  }, []);

  const segBtn =
    "min-h-9 shrink-0 rounded-md px-[7px] py-1.5 text-[11px] font-semibold tracking-wide transition-colors sm:px-3 sm:text-xs";
  const segOn = "bg-accent text-white shadow-sm";
  const segOff = "bg-transparent text-foreground/65 hover:bg-white/5 hover:text-foreground";

  return (
    <section
      aria-label="Multi-timeframe percentage gains compare"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Relative price chart
            </h2>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Live data
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">How different assets have performed against each other.</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-lg border border-border/90 bg-[#141b24] p-0.5"
          role="group"
          aria-label="Timeframe"
        >
          {HOMEPAGE_CHART_TIMEFRAMES.map((w) => (
            <button
              key={w.key}
              type="button"
              className={`${segBtn} ${windowKey === w.key ? segOn : segOff}`}
              aria-pressed={windowKey === w.key}
              onClick={() => selectWindow(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div
          className="flex flex-nowrap gap-0.5 rounded-lg border border-border/90 bg-[#141b24] p-0.5"
          role="group"
          aria-label="Chart type"
        >
          {(["line", "bar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`${segBtn} ${chartMode === m ? segOn : segOff}`}
              aria-pressed={chartMode === m}
              onClick={() => setChartMode(m)}
            >
              {m === "line" ? "Line" : "Bar"}
            </button>
          ))}
        </div>
      </div>

      {status === "ready" && payload?.series && (
        <div className="mb-3">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Toggle series visibility (tap to show or hide)"
          >
            {ALL_SERIES_IDS.map((id) => {
              const s = payload.series!.find((x) => x.id === id);
              const style = SERIES_STYLE[id];
              const on = selected.has(id);
              const pct = s?.latestPct ?? null;
              const start =
                s?.startDate ??
                payload.seriesStarts?.[id] ??
                (windowKey === "all" && s?.points[0]
                  ? new Date(s.points[0].t * 1000).toISOString().slice(0, 10)
                  : null);
              const missing = !s;
              const title = `${s?.ticker ?? style.short} · ${copy.kpiSuffix}${start ? ` · from ${start}` : ""}${
                s?.shortHistory ? ` · since ${start?.slice(0, 4) ?? ""}` : s?.stored ? " · stored copy (live feed unavailable)" : ""
              }${style.hint ? ` · ${style.hint}` : ""}${missing ? " · unavailable" : ""}`;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={missing}
                  aria-pressed={on}
                  title={title}
                  aria-label={`${style.chip}${style.hint ? ` (${style.hint})` : ""}${on ? ", shown" : ", hidden"}`}
                  onClick={() => toggleSeries(id)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    missing
                      ? "cursor-not-allowed border-border/40 opacity-40"
                      : on
                        ? "bg-white/[0.04]"
                        : "border-border/60 text-muted hover:border-border"
                  }`}
                  style={on && !missing ? { borderColor: `${style.color}99` } : undefined}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={on ? { background: style.color } : { border: `1.5px solid ${style.color}` }}
                    aria-hidden
                  />
                  <span className={on ? "font-medium text-foreground" : ""}>{style.chip}</span>
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: on ? style.color : undefined }}
                  >
                    {missing ? "—" : pct == null ? "—" : fmtPct(pct, 0)}
                  </span>
                  {s?.shortHistory && start ? (
                    <span className="text-[10px] text-muted">since {start.slice(0, 4)}</span>
                  ) : s?.stored ? (
                    <span className="rounded-full border border-border/70 px-1.5 text-[10px] text-muted">stored copy</span>
                  ) : s?.lastObs ? (
                    <span className="text-[10px] text-muted">
                      to {new Date(`${s.lastObs}T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" })}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {status === "loading" && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-muted">{copy.loading}</p>
            <p className="text-xs text-muted/70">
              BTC · S&amp;P 500 · US real estate · equities · MSCI World · AU real estate · US M2
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="flex min-h-[320px] items-center justify-center px-4 py-10 text-center">
            <p className="max-w-md text-sm text-muted">
              Could not load the {copy.errorLabel} ({error}). Live market data may
              be temporarily unavailable — try again later, or open the{" "}
              <a
                href="/dashboard/btc-cycle"
                className="text-accent hover:underline"
              >
                detailed cycle map
              </a>
              .
            </p>
          </div>
        )}

        {status === "ready" && selectedSeries.length === 0 && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-muted">Select a series</p>
            <p className="max-w-sm text-xs text-muted/70">
              All chips are off — turn on one or more series above to plot the
              compare chart. Empty chart is intentional.
            </p>
          </div>
        )}
        {status === "ready" && chartMode === "line" && chart && activeYScale && (
          <div className="relative" ref={lineWrapRef}>
          <svg
            ref={lineSvgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full sm:h-[420px]"
            role="img"
            aria-label={copy.aria}
            style={{ background: "#000", aspectRatio: `${W} / ${H}` }}
            onMouseMove={onLineMouseMove}
            onMouseLeave={onLineMouseLeave}
          >
            <title>{copy.chartTitle}</title>
            {yTicks.map((v) => {
              const y = activeYScale(v);
              return (
                <g key={`Y-${v}`}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="#1a1a1a"
                    strokeWidth="1"
                  />
                  <text
                    x={narrow ? PAD.left + 4 : PAD.left - 8}
                    y={narrow ? y - 6 : y + 3}
                    fill="#9eb0c8"
                    fontSize={axisFont}
                    fontFamily="system-ui, sans-serif"
                    textAnchor={narrow ? "start" : "end"}
                    opacity="0.9"
                  >
                    {chart.yLog ? fmtAxisPct(v) : fmtPct(v, 0)}
                  </text>
                </g>
              );
            })}

            {zeroY != null && (
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={zeroY}
                y2={zeroY}
                stroke="#3a4558"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            )}

            {xTicks.map((p, i) => {
              const x = chart.xScale(p.t);
              return (
                <text
                  key={p.t}
                  x={x}
                  y={narrow ? H - 6 : H - 14}
                  fill="#8b9bb4"
                  fontSize={axisFont}
                  fontFamily="system-ui, sans-serif"
                  textAnchor={narrow ? (i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle") : "middle"}
                >
                  {fmtDate(p.t)}
                </text>
              );
            })}

            {chart.paths
              .filter((p) => p.id !== "btc")
              .map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="1.6"
                  strokeOpacity="0.9"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {chart.paths
              .filter((p) => p.id === "btc")
              .map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="2.4"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

            {/* Current value: Live dot at each line's latest point + label in the right margin */}
            {endMarks.map((m) => (
              <g key={`end-${m.id}`} pointerEvents="none">
                {m.id === "btc" || m.lead ? (
                  <circle className="cycle-live-ring" cx={m.x} cy={m.y} r={5} fill="none" stroke={m.color} strokeWidth="1.5" />
                ) : null}
                <circle cx={m.x} cy={m.y} r={4} fill={m.color} stroke="#000" strokeWidth="1.5" />
                <text
                  x={W - PAD.right + 8}
                  y={m.labelY}
                  dominantBaseline="middle"
                  fill={m.color}
                  fontSize={narrow ? 12 : 11}
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                >
                  {fmtPct(m.pct, 0)}
                </text>
              </g>
            ))}

            {/* Invisible hit target for hover (plot area) */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={W - PAD.left - PAD.right}
              height={H - PAD.top - PAD.bottom}
              fill="transparent"
              style={{ cursor: "crosshair" }}
            />

            {lineHover && (
              <g pointerEvents="none">
                <line
                  x1={lineHover.svgX}
                  x2={lineHover.svgX}
                  y1={PAD.top}
                  y2={H - PAD.bottom}
                  stroke="#9eb0c8"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity={0.85}
                />
                {lineHover.values.map(
                  (v) =>
                    v.y != null && (
                      <circle
                        key={v.id}
                        cx={lineHover.svgX}
                        cy={v.y}
                        r={4}
                        fill={v.color}
                        stroke="#000"
                        strokeWidth="1.5"
                      />
                    ),
                )}
              </g>
            )}
          </svg>
          {lineHover && (
            <div
              className="pointer-events-none absolute z-10 min-w-[140px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
              style={{
                left:
                  lineHover.px != null
                    ? `clamp(8px, ${lineHover.px + 12}px, calc(100% - 168px))`
                    : `clamp(8px, calc(${(lineHover.svgX / W) * 100}% + 12px), calc(100% - 168px))`,
                top: 48,
              }}
            >
              <p className="mb-1.5 text-[11px] font-semibold text-[#e8eef7]">
                {lineHover.dateLabel}
              </p>
              <ul className="space-y-1">
                {[...lineHover.values]
                  .sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity))
                  .map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 text-[11px] tabular-nums"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: v.color }}
                        aria-hidden
                      />
                      <span style={{ color: v.color }}>{v.short}</span>
                    </span>
                    <span className="font-semibold" style={{ color: v.color }}>
                      {v.pct == null ? "—" : fmtPct(v.pct)}
                    </span>
                  </li>
                  ))}
              </ul>
            </div>
          )}
          </div>
        )}
        {status === "ready" && chartMode === "bar" && barLayout && activeYScale && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full sm:h-[420px]"
            role="img"
            aria-label={`Latest ${copy.kpiSuffix} as grouped bars for selected series`}
            style={{ background: "#000", aspectRatio: `${W} / ${H}` }}
          >
            <title>
              Latest {windowKey === "all" ? "cumulative" : windowKey.toUpperCase()}{" "}
              % return (bars)
            </title>
            <text
              x={PAD.left}
              y={18}
              fill="#e8eef7"
              fontSize="14"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              Latest{" "}
              {windowKey === "all"
                ? "cumulative % (own inception)"
                : `${windowKey.toUpperCase()} %`}{" "}
              by asset
            </text>
{!narrow && (
            <text
              x={W - PAD.right}
              y={16}
              fill="#8b9bb4"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
              textAnchor="end"
            >
              Grouped bars · current window only · shared % scale
            </text>
            )}

            {!narrow && <text
              x={PAD.left}
              y={34}
              fill="#8b9bb4"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              % gain (shared)
            </text>}

            {yTicks.map((v) => {
              const y = activeYScale(v);
              return (
                <g key={`BY-${v}`}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="#1a1a1a"
                    strokeWidth="1"
                  />
                  {!narrow && <text
                    x={narrow ? PAD.left + 4 : PAD.left - 8}
                    y={narrow ? y - 6 : y + 3}
                    fill="#9eb0c8"
                    fontSize={axisFont}
                    fontFamily="system-ui, sans-serif"
                    textAnchor={narrow ? "start" : "end"}
                    opacity="0.9"
                  >
                    {fmtPct(v, 0)}
                  </text>}
                </g>
              );
            })}

            {zeroY != null && (
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={zeroY}
                y2={zeroY}
                stroke="#3a4558"
                strokeWidth="1"
                strokeDasharray="4 3"
              />
            )}

            {barLayout.bars.map((b) => (
              <g key={b.id}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.barW}
                  height={Math.max(b.h, 1)}
                  fill={b.color}
                  rx={3}
                  opacity={0.92}
                />
                <text
                  x={b.x + b.barW / 2}
                  y={b.pct >= 0 ? b.y - 8 : b.y + b.h + 14}
                  fill={b.color}
                  fontSize="12"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {fmtPct(b.pct)}
                </text>
                <text
                  x={b.x + b.barW / 2}
                  y={narrow ? H - 12 : H - 28}
                  fill="#c8d0dc"
                  fontSize="11"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {b.label}
                </text>
                {!narrow && <text
                  x={b.x + b.barW / 2}
                  y={H - 14}
                  fill="#8b9bb4"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {b.ticker}
                </text>}
              </g>
            ))}
          </svg>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowNotes((v) => !v)}
        aria-expanded={showNotes}
        className="mt-3 text-xs font-medium text-accent hover:underline"
      >
        {showNotes ? "Hide source notes" : "Show source notes"}
      </button>
      {showNotes ? (
      <p className="mt-2 text-xs text-muted">
        {copy.footerLead}
        {copy.startsLine ? ` — starts: ${copy.startsLine}` : ""}. Not absolute
        price levels.{" "}
        <strong className="font-medium text-muted">Shared % scale:</strong>{" "}
        selected series share one Y-axis so relative paths are comparable
        (equities and housing may look flatter on long windows — that is the
        compare).{" "}
        {windowKey === "all" ? (
          <>
            <strong className="font-medium text-muted">ALL:</strong> the shared
            start is NDX, SPX and AORD from Oct 1985. Bitcoin can be toggled on
            for the line when selected; its daily history here starts around Sep
            2014, so it is marked with its start year. Shorter series show
            &ldquo;since&nbsp;year&rdquo;.{" "}
          </>
        ) : (
          <>
            Each line is close_t / close_at_window_start − 1 (starts at ~0% on
            the left; the right edge matches the bar).{" "}
          </>
        )}
        <strong className="font-medium text-muted">Series toggles:</strong> click
        chips to show or hide lines and bars (defaults: S&amp;P 500, BTC, US
        real estate).{" "}
        <strong className="font-medium text-muted">US M2</strong> is relative %
        change from the window start, not the raw money-stock level.{" "}
        <strong className="font-medium text-muted">Bar mode:</strong> latest %
        for the selected window as grouped bars (same end value as the line).
        BTC: Coinbase Exchange BTC-USD daily closes (Blockchain.com before mid-2015).
        Nasdaq 100, S&amp;P 500, All Ordinaries and MSCI World: Yahoo Finance delayed chart feed
        (^NDX, ^GSPC, ^AORD, ^990100-USD-STRD) — no free public equivalent; index names are
        trademarks of their owners (MSCI®, S&amp;P®, ASX®), no endorsement implied. Gold: monthly USD/oz from datasets/gold-prices (Open Data Commons PDDL) with IMF Primary Commodity
        Prices (PGOLD, London fix monthly average) on the tail; held flat after the latest monthly print, which
        the &ldquo;to&nbsp;month&rdquo; tag on the chip shows. FRED®, Federal
        Reserve Bank of St. Louis: USSTHPI (FHFA All-Transactions House Price Index), QAUN628BIS
        (BIS AU residential property prices), M2SL (US M2). Monthly/quarterly series are
        step-forward-filled to the shared axis. A &ldquo;stored copy&rdquo; tag means the live
        feed was unavailable and a saved copy is shown. Bonds not included yet. For the BTC
        cycle theory, open{" "}
        <a href="/dashboard/btc-cycle" className="text-accent hover:underline">
          BTC 4-year cycle
        </a>
        .
      </p>
      ) : null}
      {payload?.errors && Object.keys(payload.errors).length > 0 && (
        <p className="mt-1 text-[11px] text-muted/80">
          Some feeds had errors:{" "}
          {Object.entries(payload.errors)
            .map(([k, v]) => `${k} (${v})`)
            .join("; ")}
        </p>
      )}
    </section>
  );
}
