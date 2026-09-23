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

type SeriesId = "btc" | "ndx" | "spx" | "aord" | "msci" | "case" | "auhouses" | "m2";
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
  case: { color: "#f472b6", short: "CASE", chip: "US real estate" },
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
  "case",
  "auhouses",
  "m2",
];

const DEFAULT_SELECTED: SeriesId[] = [...ALL_SERIES_IDS];

const W = 920;
const H = 420;
const PAD = { top: 40, right: 28, bottom: 36, left: 58 };

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

type LineHover = {
  svgX: number;
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
) {
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

function buildBarLayout(series: SeriesPayload[]) {
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

  let minPct = Math.min(0, ...values.map((v) => v.pct));
  let maxPct = Math.max(0, ...values.map((v) => v.pct));
  const padY = Math.max((maxPct - minPct) * 0.12, 8);
  const yRange = { min: minPct - padY, max: maxPct + padY };

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const yScale = (pct: number) =>
    PAD.top +
    (1 - (pct - yRange.min) / (yRange.max - yRange.min || 1)) * ih;

  const groupGap = 28;
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
      subtitle:
        "NDX, SPX and AORD set the shared start · toggle series on chips · BTC can join the line from ~Sep 2014 · educational · NFA",
      kpiSuffix: "% all-time",
      chartTitle: payload?.title ?? "All-time index relative %",
      chartHint: "Selected series · start = 0% · BTC partial from ~Sep 2014",
      aria: "All-time relative percentage returns for selected series",
      loading: "Loading all-time relative returns…",
      footerLead:
        "Educational compare from the first date NDX, SPX and AORD all exist on Yahoo (NDX daily, Oct 1985). Toggle series chips to show or hide lines; BTC can be toggled on with its shorter history from around Sep 2014",
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
    subtitle: `Each line starts at 0% · ${label} window · shared scale · educational · NFA`,
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
      ? buildSharedAxis(selectedSeries, payload!, windowKey)
      : null;
  }, [selectedSeries, payload, chartMode, windowKey]);

  const barLayout = useMemo(
    () =>
      selectedSeries.length && chartMode === "bar"
        ? buildBarLayout(selectedSeries)
        : null,
    [selectedSeries, chartMode],
  );

  const activeYRange = chart?.yRange ?? barLayout?.yRange ?? null;
  const activeYScale = chart?.yScale ?? barLayout?.yScale ?? null;

  const yTicks = useMemo(() => {
    if (chartMode === "line" && chart?.yTicks?.length) return chart.yTicks;
    if (activeYRange) return ticks(activeYRange.min, activeYRange.max);
    return [];
  }, [chart, chartMode, activeYRange]);

  const xTicks = useMemo(() => {
    if (!chart) return [];
    // Always tick from the shared domain so 1Y never shows 1988 labels
    const { minT, maxT } = chart;
    const mid1 = minT + (maxT - minT) / 3;
    const mid2 = minT + (2 * (maxT - minT)) / 3;
    return [
      { t: minT, pct: 0 },
      { t: mid1, pct: 0 },
      { t: mid2, pct: 0 },
      { t: maxT, pct: 0 },
    ];
  }, [chart]);

  const zeroY = useMemo(() => {
    if (!activeYRange || !activeYScale) return null;
    if (activeYRange.min > 0 || activeYRange.max < 0) return null;
    return activeYScale(0);
  }, [activeYRange, activeYScale]);

  const onLineMouseMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (!chart || !chart.clipped?.length) {
        setLineHover(null);
        return;
      }
      const svg = lineSvgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const svgY = ((e.clientY - rect.top) / rect.height) * H;
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

      setLineHover({
        svgX: Math.max(PAD.left, Math.min(W - PAD.right, svgX)),
        t,
        dateLabel: fmtTooltipDate(t),
        values,
      });
    },
    [chart],
  );

  const onLineMouseLeave = useCallback(() => {
    setLineHover(null);
  }, []);

  const toggleBtn =
    "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-accent text-white shadow-sm";
  const toggleOff =
    "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  return (
    <section
      className="mt-12"
      aria-label="Multi-timeframe percentage gains compare"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          {copy.heading}
        </h2>
        <p className="text-xs text-muted">{copy.subtitle}</p>
      </div>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Window
          </span>
          <div
            className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
            role="group"
            aria-label="Timeframe"
          >
            {HOMEPAGE_CHART_TIMEFRAMES.map((w) => (
              <button
                key={w.key}
                type="button"
                className={`${toggleBtn} ${windowKey === w.key ? toggleOn : toggleOff}`}
                aria-pressed={windowKey === w.key}
                onClick={() => selectWindow(w.key)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            View
          </span>
          <div
            className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
            role="group"
            aria-label="Chart type"
          >
            <button
              type="button"
              className={`${toggleBtn} ${chartMode === "line" ? toggleOn : toggleOff}`}
              aria-pressed={chartMode === "line"}
              onClick={() => setChartMode("line")}
            >
              Line
            </button>
            <button
              type="button"
              className={`${toggleBtn} ${chartMode === "bar" ? toggleOn : toggleOff}`}
              aria-pressed={chartMode === "bar"}
              onClick={() => setChartMode("bar")}
            >
              Bar
            </button>
          </div>
        </div>
      </div>

      {status === "ready" && payload?.series && (
        <div className="mb-3">
          <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Series (click to toggle)
          </span>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label="Toggle series visibility"
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
              return (
                <button
                  key={id}
                  type="button"
                  disabled={missing}
                  aria-pressed={on}
                  aria-label={`${style.chip}${style.hint ? ` (${style.hint})` : ""}${on ? ", shown" : ", hidden"}`}
                  onClick={() => toggleSeries(id)}
                  className={`rounded-lg bg-card px-3 py-2 text-left transition-colors ${
                    missing
                      ? "cursor-not-allowed border border-border/40 opacity-40"
                      : on
                        ? "border-2 border-accent shadow-sm"
                        : "border border-border/50 opacity-70 hover:opacity-90"
                  }`}
                  style={
                    on && !missing
                      ? { borderColor: style.color, boxShadow: `0 0 0 1px ${style.color}33` }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: style.color, opacity: on ? 1 : 0.45 }}
                      aria-hidden
                    />
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      {style.chip}
                    </span>
                  </div>
                  <p
                    className="mt-1 text-lg font-semibold tabular-nums"
                    style={{ color: on ? style.color : "#8b9bb4" }}
                  >
                    {missing ? "—" : pct == null ? "—" : fmtPct(pct)}
                  </p>
                  <p className="text-[10px] text-muted">
                    {s?.ticker ?? style.short} · {copy.kpiSuffix}
                    {start ? ` · from ${start}` : ""}
                    {s?.coverage === "partial" ? " · short history" : ""}
                    {style.hint ? ` · ${style.hint}` : ""}
                    {missing ? " · unavailable" : on ? "" : " · hidden"}
                  </p>
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
              BTC · S&amp;P 500 · Case-Shiller · equities · MSCI World · AU real estate · US M2
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
          <div className="relative">
          <svg
            ref={lineSvgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={copy.aria}
            style={{ background: "#000", height: 420 }}
            onMouseMove={onLineMouseMove}
            onMouseLeave={onLineMouseLeave}
          >
            <title>{copy.chartTitle}</title>
            <text
              x={PAD.left}
              y={18}
              fill="#e8eef7"
              fontSize="14"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              {copy.chartTitle}
            </text>
            <text
              x={W - PAD.right}
              y={16}
              fill="#8b9bb4"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
              textAnchor="end"
            >
              {copy.chartHint}
            </text>

            <text
              x={PAD.left}
              y={34}
              fill="#8b9bb4"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              {chart.yLog ? "% gain (log)" : "% gain (shared)"}
            </text>

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
                    x={PAD.left - 8}
                    y={y + 3}
                    fill="#9eb0c8"
                    fontSize="10"
                    fontFamily="system-ui, sans-serif"
                    textAnchor="end"
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

            {xTicks.map((p) => {
              const x = chart.xScale(p.t);
              return (
                <text
                  key={p.t}
                  x={x}
                  y={H - 14}
                  fill="#8b9bb4"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
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
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
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
                  strokeWidth="2.1"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
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
                left: `clamp(8px, calc(${(lineHover.svgX / W) * 100}% + 12px), calc(100% - 168px))`,
                top: 48,
              }}
            >
              <p className="mb-1.5 text-[11px] font-semibold text-[#e8eef7]">
                {lineHover.dateLabel}
              </p>
              <ul className="space-y-1">
                {lineHover.values.map((v) => (
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
                    <span style={{ color: v.color }}>
                      {v.pct == null ? "—" : fmtPct(v.pct)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Legend outside SVG so x-axis dates never collide with chips */}
          <div
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] bg-black px-4 pb-3 pt-2.5"
            aria-hidden
          >
            {selectedSeries.map((s) => {
              const style = SERIES_STYLE[s.id];
              return (
                <div key={s.id} className="inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-[2px] w-4 rounded-full"
                    style={{ background: style.color }}
                  />
                  <span className="text-[10px] leading-none text-[#c8d0dc]">
                    {style.short} ({s.ticker})
                  </span>
                </div>
              );
            })}
          </div>
          </div>
        )}
        {status === "ready" && chartMode === "bar" && barLayout && activeYScale && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={`Latest ${copy.kpiSuffix} as grouped bars for selected series`}
            style={{ background: "#000", height: 420 }}
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

            <text
              x={PAD.left}
              y={34}
              fill="#8b9bb4"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              % gain (shared)
            </text>

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
                  <text
                    x={PAD.left - 8}
                    y={y + 3}
                    fill="#9eb0c8"
                    fontSize="10"
                    fontFamily="system-ui, sans-serif"
                    textAnchor="end"
                    opacity="0.9"
                  >
                    {fmtPct(v, 0)}
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
                  y={H - 28}
                  fill="#c8d0dc"
                  fontSize="11"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {b.label}
                </text>
                <text
                  x={b.x + b.barW / 2}
                  y={H - 14}
                  fill="#8b9bb4"
                  fontSize="9"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {b.ticker}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
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
            for the line when selected; Yahoo daily BTC-USD starts around Sep
            2014, so it is marked partial/short history versus that shared
            start. Shorter series (e.g. Bitcoin from 2014) are marked partial.{" "}
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
        Data via Yahoo Finance delayed third-party chart feeds (BTC-USD, ^NDX, ^GSPC, ^AORD, ^990100-USD-STRD) and FRED®,
        Federal Reserve Bank of St. Louis (CSUSHPISA S&amp;P CoreLogic Case-Shiller
        US National HPI; QAUN628BIS BIS AU residential property prices; M2SL US M2).
        The MSCI World chip is the developed-world MSCI World Standard (price)
        index via Yahoo&apos;s delayed chart feed (^990100-USD-STRD) — not an ETF,
        not ACWI, and not a net total-return series. MSCI® is a trademark of MSCI
        Inc.; Case-Shiller® and other index names are trademarks of their owners; no
        endorsement implied. Monthly/quarterly series are step-forward-filled to the shared axis.
        Partial series may appear if history is short or a feed fails. Bonds not
        included yet. For the full BTC+MSTR cycle desk, open{" "}
        <a href="/dashboard" className="text-accent hover:underline">
          Cycle desk
        </a>
        . Educational only — not investment advice (NFA).
      </p>
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
