"use client";

import { useEffect, useMemo, useState } from "react";

type SeriesId = "btc" | "ndx" | "spx" | "aord";
type WindowKey = "1y" | "3y" | "4y" | "5y" | "10y" | "all";
type ChartMode = "line" | "bar";

type PctPoint = { t: number; pct: number };

type SeriesPayload = {
  id: SeriesId;
  label: string;
  ticker: string;
  points: PctPoint[];
  latestPct: number | null;
};

type ApiPayload = {
  ok: boolean;
  title?: string;
  definition?: string;
  window?: WindowKey;
  windowLabel?: string;
  windowShort?: string;
  mode?: "rolling" | "cumulative";
  windowDays?: number | null;
  windowSec?: number | null;
  commonStart?: string;
  source?: string;
  series?: SeriesPayload[];
  errors?: Record<string, string>;
  error?: string;
  asOf?: string;
};

const SERIES_STYLE: Record<SeriesId, { color: string; short: string }> = {
  btc: { color: "#f7931a", short: "BTC" },
  ndx: { color: "#4c9fff", short: "NDX" },
  spx: { color: "#3dcc9a", short: "SPX" },
  aord: { color: "#e8873a", short: "AORD" },
};

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "1y", label: "1Y" },
  { key: "3y", label: "3Y" },
  { key: "4y", label: "4Y" },
  { key: "5y", label: "5Y" },
  { key: "10y", label: "10Y" },
  { key: "all", label: "ALL" },
];

const W = 920;
const H = 420;
const PAD = { top: 40, right: 28, bottom: 48, left: 58 };

function fmtPct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
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

function buildSharedAxis(series: SeriesPayload[]) {
  const allPts = series.flatMap((s) => s.points);
  if (!allPts.length) return null;

  let minT = allPts[0].t;
  let maxT = allPts[0].t;
  for (const p of allPts) {
    if (p.t < minT) minT = p.t;
    if (p.t > maxT) maxT = p.t;
  }

  const yRange = rangeFor(allPts) ?? { min: 0, max: 100 };

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const xScale = (t: number) =>
    PAD.left + ((t - minT) / (maxT - minT || 1)) * iw;
  const yScale = (pct: number) =>
    PAD.top +
    (1 - (pct - yRange.min) / (yRange.max - yRange.min || 1)) * ih;

  const paths = series
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

  return { paths, yRange, minT, maxT, yScale, xScale };
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

function windowCopy(windowKey: WindowKey, payload: ApiPayload | null) {
  if (windowKey === "all") {
    const since = payload?.commonStart ? ` since ${payload.commonStart}` : "";
    return {
      heading: "All-time cumulative chart",
      subtitle: `Cumulative % from first common date${since} · shared scale · educational · NFA`,
      kpiSuffix: "cumulative %",
      chartTitle: payload?.title ?? "Cumulative % since first common date",
      chartHint: "Shared % scale · cumulative from common start · not price levels",
      aria: "Cumulative percentage returns from first common date for BTC-USD, Nasdaq 100, S&P 500, and All Ordinaries",
      loading: "Loading cumulative % gains…",
      footerLead:
        "Educational compare of cumulative percentage returns from the first date where all four series have data",
      errorLabel: "all-time compare chart",
    };
  }
  const label =
    payload?.windowLabel ??
    ({
      "1y": "1-year",
      "3y": "3-year",
      "4y": "4-year",
      "5y": "5-year",
      "10y": "10-year",
    }[windowKey] as string);
  const days = payload?.windowDays;
  const daysBit = days != null ? `~${days}d` : windowKey;
  return {
    heading: `${label} running chart`,
    subtitle: `Relative ${label} % gains · shared scale · educational · NFA`,
    kpiSuffix: `current ${windowKey.toUpperCase()} %`,
    chartTitle: payload?.title ?? `${label} rolling % gains`,
    chartHint: `Shared % scale · trailing ${daysBit} · not price levels`,
    aria: `Rolling ${label} percentage gains on a shared Y-axis for BTC-USD, Nasdaq 100, S&P 500, and All Ordinaries`,
    loading: `Loading ${label} running % gains…`,
    footerLead: `Educational compare of rolling ${label} percentage returns (same calendar-day lookback for each series)`,
    errorLabel: `${label} compare chart`,
  };
}

export function BtcFourYearChart() {
  const [windowKey, setWindowKey] = useState<WindowKey>("4y");
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        setError(null);
        const r = await fetch(`/api/four-year-gains?window=${windowKey}`);
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
        setError(e instanceof Error ? e.message : "Chart unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [windowKey]);

  const copy = useMemo(
    () => windowCopy(windowKey, payload),
    [windowKey, payload],
  );

  const chart = useMemo(
    () =>
      payload?.series?.length && chartMode === "line"
        ? buildSharedAxis(payload.series)
        : null,
    [payload, chartMode],
  );

  const barLayout = useMemo(
    () =>
      payload?.series?.length && chartMode === "bar"
        ? buildBarLayout(payload.series)
        : null,
    [payload, chartMode],
  );

  const activeYRange = chart?.yRange ?? barLayout?.yRange ?? null;
  const activeYScale = chart?.yScale ?? barLayout?.yScale ?? null;

  const yTicks = useMemo(
    () => (activeYRange ? ticks(activeYRange.min, activeYRange.max) : []),
    [activeYRange],
  );

  const xTicks = useMemo(() => {
    if (!chart || !payload?.series?.length) return [];
    const densest = [...payload.series].sort(
      (a, b) => b.points.length - a.points.length,
    )[0];
    if (!densest?.points.length) return [];
    const pts = densest.points;
    const idxs = [
      0,
      Math.floor(pts.length / 3),
      Math.floor((2 * pts.length) / 3),
      pts.length - 1,
    ];
    return idxs.map((i) => pts[i]);
  }, [chart, payload]);

  const zeroY = useMemo(() => {
    if (!activeYRange || !activeYScale) return null;
    if (activeYRange.min > 0 || activeYRange.max < 0) return null;
    return activeYScale(0);
  }, [activeYRange, activeYScale]);

  const toggleBtn =
    "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-accent text-white";
  const toggleOff = "bg-transparent text-muted hover:text-foreground";

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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-card p-0.5"
          role="group"
          aria-label="Timeframe"
        >
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              type="button"
              className={`${toggleBtn} ${windowKey === w.key ? toggleOn : toggleOff}`}
              aria-pressed={windowKey === w.key}
              onClick={() => setWindowKey(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div
          className="inline-flex gap-0.5 rounded-lg border border-border bg-card p-0.5"
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

      {status === "ready" && payload?.series && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {payload.series.map((s) => {
            const style = SERIES_STYLE[s.id];
            const pct = s.latestPct;
            return (
              <div
                key={s.id}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: style.color }}
                    aria-hidden
                  />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    {s.label}
                  </span>
                </div>
                <p
                  className="mt-1 text-lg font-semibold tabular-nums"
                  style={{ color: style.color }}
                >
                  {pct == null ? "—" : fmtPct(pct)}
                </p>
                <p className="text-[10px] text-muted">
                  {s.ticker} · {copy.kpiSuffix}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {status === "loading" && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-muted">{copy.loading}</p>
            <p className="text-xs text-muted/70">
              BTC-USD · Nasdaq 100 (^NDX) · S&amp;P 500 (^GSPC) · All Ordinaries
              (^AORD)
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
        {status === "ready" && chartMode === "line" && chart && activeYScale && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={copy.aria}
            style={{ background: "#000", height: 420 }}
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
              % gain (shared)
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

            {xTicks.map((p) => {
              const x = chart.xScale(p.t);
              return (
                <text
                  key={p.t}
                  x={x}
                  y={H - 30}
                  fill="#8b9bb4"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {fmtDate(p.t)}
                </text>
              );
            })}

            {payload?.series?.map((s, i) => {
              const style = SERIES_STYLE[s.id];
              const x = PAD.left + i * 155;
              return (
                <g key={s.id} transform={`translate(${x}, ${H - 12})`}>
                  <line
                    x1={0}
                    y1={-3}
                    x2={16}
                    y2={-3}
                    stroke={style.color}
                    strokeWidth="2.5"
                  />
                  <text
                    x={22}
                    y={0}
                    fill="#c8d0dc"
                    fontSize="10"
                    fontFamily="system-ui, sans-serif"
                  >
                    {style.short} ({s.ticker})
                  </text>
                </g>
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
          </svg>
        )}
        {status === "ready" && chartMode === "bar" && barLayout && activeYScale && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label={`Latest ${copy.kpiSuffix} as grouped bars for BTC-USD, Nasdaq 100, S&P 500, and All Ordinaries`}
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
                ? "cumulative %"
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
        {windowKey === "all" && payload?.commonStart
          ? ` (${payload.commonStart})`
          : ""}{" "}
        — not absolute price levels.{" "}
        <strong className="font-medium text-muted">Shared % scale:</strong> all
        four series use one Y-axis so Bitcoin&apos;s relative outperformance is
        visible (equities may look flatter — that is intentional).{" "}
        {windowKey === "all" ? (
          <>
            <strong className="font-medium text-muted">ALL semantics:</strong>{" "}
            cumulative % from the first date where BTC-USD, ^NDX, ^GSPC, and
            ^AORD all have data (not a rolling lookback).{" "}
          </>
        ) : (
          <>
            Rolling definition: close_t / close_at_or_before_t−window − 1.{" "}
          </>
        )}
        <strong className="font-medium text-muted">Bar mode:</strong> latest %
        for the selected window as grouped bars (clearest for outperformance);
        Line mode shows the full rolling/cumulative history. Data via Yahoo
        Finance chart API: BTC-USD, ^NDX, ^GSPC, ^AORD. Partial series may
        appear if one feed fails. For the full BTC+MSTR cycle desk, open{" "}
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
