"use client";

import { useEffect, useMemo, useState } from "react";

type SeriesId = "btc" | "ndx" | "spx" | "aord";

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
  windowDays?: number;
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

const W = 920;
const H = 420;
const PAD = { top: 40, right: 58, bottom: 48, left: 58 };

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

function buildDualAxis(series: SeriesPayload[]) {
  const btc = series.find((s) => s.id === "btc");
  const equities = series.filter((s) => s.id !== "btc");
  const allPts = series.flatMap((s) => s.points);
  if (!allPts.length) return null;

  let minT = allPts[0].t;
  let maxT = allPts[0].t;
  for (const p of allPts) {
    if (p.t < minT) minT = p.t;
    if (p.t > maxT) maxT = p.t;
  }

  const leftRange = rangeFor(btc?.points ?? []) ?? { min: 0, max: 100 };
  const rightRange = rangeFor(equities.flatMap((s) => s.points)) ?? {
    min: 0,
    max: 100,
  };

  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const xScale = (t: number) =>
    PAD.left + ((t - minT) / (maxT - minT || 1)) * iw;
  const yLeft = (pct: number) =>
    PAD.top +
    (1 - (pct - leftRange.min) / (leftRange.max - leftRange.min || 1)) * ih;
  const yRight = (pct: number) =>
    PAD.top +
    (1 - (pct - rightRange.min) / (rightRange.max - rightRange.min || 1)) * ih;

  const paths = series
    .filter((s) => s.points.length > 1)
    .map((s) => {
      const yScale = s.id === "btc" ? yLeft : yRight;
      let d = "";
      s.points.forEach((p, i) => {
        const x = xScale(p.t);
        const y = yScale(p.pct);
        d +=
          i === 0
            ? `M ${x.toFixed(2)} ${y.toFixed(2)}`
            : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
      });
      return { id: s.id, d, color: SERIES_STYLE[s.id].color, axis: s.id === "btc" ? "left" : "right" };
    });

  return { paths, leftRange, rightRange, minT, maxT, yLeft, yRight, xScale };
}

function ticks(min: number, max: number, n = 5) {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(min + ((max - min) * i) / n);
  return out;
}

export function BtcFourYearChart() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ApiPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        setError(null);
        const r = await fetch("/api/four-year-gains");
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
  }, []);

  const chart = useMemo(
    () => (payload?.series?.length ? buildDualAxis(payload.series) : null),
    [payload],
  );

  const leftTicks = useMemo(
    () => (chart ? ticks(chart.leftRange.min, chart.leftRange.max) : []),
    [chart],
  );
  const rightTicks = useMemo(
    () => (chart ? ticks(chart.rightRange.min, chart.rightRange.max) : []),
    [chart],
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

  const zeroLeft = useMemo(() => {
    if (!chart) return null;
    if (chart.leftRange.min > 0 || chart.leftRange.max < 0) return null;
    return chart.yLeft(0);
  }, [chart]);

  return (
    <section className="mt-12" aria-label="4-year running percentage gains compare">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          4-year running chart
        </h2>
        <p className="text-xs text-muted">
          Relative ~4y % gains · split scale · educational · NFA
        </p>
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
                  {s.ticker} · current 4y %
                  {s.id === "btc" ? " · left axis" : " · right axis"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {status === "loading" && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-muted">Loading 4-year running % gains…</p>
            <p className="text-xs text-muted/70">
              BTC-USD · Nasdaq 100 (^NDX) · S&amp;P 500 (^GSPC) · All Ordinaries (^AORD)
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="flex min-h-[320px] items-center justify-center px-4 py-10 text-center">
            <p className="max-w-md text-sm text-muted">
              Could not load the 4-year compare chart ({error}). Live market data may be
              temporarily unavailable — try again later, or open the{" "}
              <a href="/dashboard/btc-cycle" className="text-accent hover:underline">
                detailed cycle map
              </a>
              .
            </p>
          </div>
        )}
        {status === "ready" && chart && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label="Rolling 4-year percentage gains with dual Y-axes: BTC on left, equity indices on right"
            style={{ background: "#000", height: 420 }}
          >
            <title>4-year running % gains (dual axis)</title>
            <text
              x={PAD.left}
              y={18}
              fill="#e8eef7"
              fontSize="14"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              4-year running % gains
            </text>
            <text
              x={W - PAD.right}
              y={16}
              fill="#8b9bb4"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
              textAnchor="end"
            >
              Dual axis · trailing ~{payload?.windowDays ?? 1461}d · not price levels
            </text>

            {/* Axis captions */}
            <text
              x={PAD.left}
              y={34}
              fill="#f7931a"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              BTC % (left)
            </text>
            <text
              x={W - PAD.right}
              y={34}
              fill="#8b9bb4"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
              textAnchor="end"
            >
              Equities % (right)
            </text>

            {/* Left grid + BTC ticks */}
            {leftTicks.map((v) => {
              const y = chart.yLeft(v);
              return (
                <g key={`L-${v}`}>
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
                    fill="#f7931a"
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

            {/* Right equity ticks */}
            {rightTicks.map((v) => {
              const y = chart.yRight(v);
              return (
                <text
                  key={`R-${v}`}
                  x={W - PAD.right + 8}
                  y={y + 3}
                  fill="#9eb0c8"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="start"
                >
                  {fmtPct(v, 0)}
                </text>
              );
            })}

            {zeroLeft != null && (
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={zeroLeft}
                y2={zeroLeft}
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

            {/* Legend */}
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
                    {s.id === "btc" ? " L" : " R"}
                  </text>
                </g>
              );
            })}

            {/* Draw equities first (under), BTC on top */}
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
      </div>
      <p className="mt-2 text-xs text-muted">
        Educational compare of rolling ~4-year percentage returns (same ~1461 calendar-day
        lookback for each series) — not absolute price levels.{" "}
        <strong className="font-medium text-muted">Dual Y-axis:</strong> BTC on the left scale,
        Nasdaq 100 / S&amp;P 500 / All Ords share the right scale so equity moves stay readable
        beside BTC&apos;s larger % swings. Data via Yahoo Finance chart API: BTC-USD, ^NDX,
        ^GSPC, ^AORD. Partial series may appear if one feed fails. For the full BTC+MSTR cycle
        desk, open{" "}
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
