"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  FACTORY_FOOTER,
  FACTORY_FRED_URL,
  FACTORY_KEY_LINE,
  FACTORY_LEVELS,
  FACTORY_LEVELS_FOOTNOTE,
  FACTORY_MA_MONTHS,
  FACTORY_NOT_ISM_NOTE,
  FACTORY_PHILLY_URL,
  FACTORY_SOURCE_LINE,
  NBER_RECESSIONS,
  factoryState,
  fmtMonthKey,
  fmtReading,
  monthIndex,
  movingAverage,
  type FactoryPayload,
  type FactoryPoint,
} from "@/lib/factoryMonitor";

type TfKey = "1Y" | "3Y" | "5Y" | "10Y" | "20Y" | "ALL";

const TIMEFRAMES: { key: TfKey; months: number | null }[] = [
  { key: "1Y", months: 12 },
  { key: "3Y", months: 36 },
  { key: "5Y", months: 60 },
  { key: "10Y", months: 120 },
  { key: "20Y", months: 240 },
  { key: "ALL", months: null },
];

const W = 760;
const H = 320;
const PAD = { top: 16, right: 44, bottom: 30, left: 40 };
const LINE = "#22d3ee";

const LEVEL_LINES: Array<{
  v: number;
  color: string;
  label: string;
  dash?: string;
  width: number;
  /** Optional caption, stacked under the value label in the right gutter. */
  caption?: string;
}> = [
  {
    v: FACTORY_LEVELS.high,
    color: "#a7f3d0",
    label: "+40",
    caption: "High range",
    width: 1.25,
    dash: "6 4",
  },
  { v: FACTORY_LEVELS.hot, color: "#39e75f", label: "+25", width: 1.25, dash: "6 4" },
  { v: FACTORY_LEVELS.zero, color: "#f5f7fa", label: "0", width: 1.25 },
  { v: FACTORY_LEVELS.weak, color: "#ef4444", label: "−10", width: 1.25, dash: "6 4" },
];

type Mode = "smoothed" | "raw";

/** Monthly point with its trailing 3-month average (null until 3 months exist). */
type ChartPoint = FactoryPoint & { ma: number | null };

type Hover = {
  x: number;
  y: number;
  /** Raw reading position (shown as a small secondary dot in Smoothed mode). */
  yRaw: number;
  p: ChartPoint;
  inRecession: boolean;
};

function inNber(m: string): boolean {
  return NBER_RECESSIONS.some((r) => m >= r.start && m <= r.end);
}

export function FactoryMonitorPanel() {
  const [data, setData] = useState<FactoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>("20Y");
  const [mode, setMode] = useState<Mode>("smoothed");
  const [hover, setHover] = useState<Hover | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/factory-monitor");
        const json = (await res.json()) as FactoryPayload;
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

  useEffect(() => setHover(null), [tf, mode]);

  // Average over the full history so window edges still have values.
  const all = useMemo<ChartPoint[]>(() => {
    const raw = data?.points ?? [];
    const ma = movingAverage(raw);
    return raw.map((p, i) => ({ ...p, ma: ma[i] ?? null }));
  }, [data]);
  const last = all.length ? all[all.length - 1]! : null;
  const lastState = last ? factoryState(last.v) : null;

  const points = useMemo(() => {
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    if (meta.months == null) return all;
    return all.slice(-meta.months);
  }, [all, tf]);

  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const i0 = monthIndex(points[0]!.m);
    const i1 = monthIndex(points[points.length - 1]!.m);
    let lo = Math.min(FACTORY_LEVELS.weak, ...points.map((p) => p.v));
    let hi = Math.max(FACTORY_LEVELS.high, ...points.map((p) => p.v));
    lo = Math.floor((lo - 4) / 10) * 10;
    hi = Math.ceil((hi + 4) / 10) * 10;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const xOf = (idx: number) => PAD.left + ((idx - i0) / Math.max(i1 - i0, 1)) * iw;
    const yOf = (v: number) => PAD.top + ((hi - v) / Math.max(hi - lo, 1)) * ih;
    const path = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(monthIndex(p.m)).toFixed(1)} ${yOf(p.v).toFixed(1)}`,
      )
      .join(" ");
    let maPath = "";
    for (const p of points) {
      if (p.ma == null) continue;
      maPath += `${maPath ? "L" : "M"}${xOf(monthIndex(p.m)).toFixed(1)} ${yOf(p.ma).toFixed(1)} `;
    }
    maPath = maPath.trim();
    const yTicks: number[] = [];
    const step = hi - lo > 80 ? 20 : 10;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v);
    const y0 = Math.floor(i0 / 12);
    const y1 = Math.floor(i1 / 12);
    const xTicks: { idx: number; label: string }[] = [];
    const span = i1 - i0;
    if (span < 48) {
      // Short windows: quarterly (≤2y) or half-yearly month labels, e.g. "Jan 26".
      const every = span < 24 ? 3 : 6;
      for (let idx = i0; idx <= i1; idx++) {
        if (idx % every === 0) {
          const mk = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
          const [mon, yr] = fmtMonthKey(mk).split(" ");
          xTicks.push({ idx, label: `${mon} ${yr!.slice(2)}` });
        }
      }
    } else {
      const yearStep = span <= 132 ? 1 : y1 - y0 > 30 ? 10 : 5;
      for (let y = Math.ceil(y0 / yearStep) * yearStep; y <= y1; y += yearStep) {
        if (y * 12 >= i0) xTicks.push({ idx: y * 12, label: String(y) });
      }
    }
    const bands = NBER_RECESSIONS.map((r) => {
      const a = Math.max(monthIndex(r.start), i0);
      const b = Math.min(monthIndex(r.end), i1);
      if (b < a) return null;
      return { x: xOf(a), w: Math.max(xOf(b) - xOf(a), 2), key: r.start };
    }).filter((b): b is { x: number; w: number; key: string } => b != null);
    return { i0, i1, lo, hi, xOf, yOf, path, maPath, yTicks, xTicks, bands };
  }, [points]);

  const onMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!chart || !svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const sx = ((e.clientX - rect.left) / rect.width) * W;
      if (sx < PAD.left - 4 || sx > W - PAD.right + 4) {
        setHover(null);
        return;
      }
      const iw = W - PAD.left - PAD.right;
      const idx = Math.round(
        chart.i0 + ((sx - PAD.left) / iw) * (chart.i1 - chart.i0),
      );
      const k = Math.min(Math.max(idx - chart.i0, 0), points.length - 1);
      // Points are contiguous monthly, but guard against any gap.
      let p = points[k]!;
      if (monthIndex(p.m) !== idx) {
        p = points.reduce((best, q) =>
          Math.abs(monthIndex(q.m) - idx) < Math.abs(monthIndex(best.m) - idx)
            ? q
            : best,
        );
      }
      const yRaw = chart.yOf(p.v);
      setHover({
        x: chart.xOf(monthIndex(p.m)),
        y: mode === "smoothed" && p.ma != null ? chart.yOf(p.ma) : yRaw,
        yRaw,
        p,
        inRecession: inNber(p.m),
      });
    },
    [chart, points, mode],
  );

  const toggleBtn =
    "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-accent text-white shadow-sm";
  const toggleOff =
    "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  const hoverState = hover ? factoryState(hover.p.v) : null;
  const asOfLabel = data?.asOf ? fmtMonthKey(data.asOf) : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#22d3ee]">
              Philly Fed Manufacturing
            </h2>
            <div
              className="inline-flex gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1"
              role="group"
              aria-label="Timeframe"
            >
              {TIMEFRAMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`${toggleBtn} ${tf === t.key ? toggleOn : toggleOff}`}
                  aria-pressed={tf === t.key}
                  onClick={() => setTf(t.key)}
                >
                  {t.key === "ALL" ? "All" : t.key}
                </button>
              ))}
            </div>
            <div
              className="inline-flex gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1"
              role="group"
              aria-label="Line"
            >
              {(
                [
                  { key: "smoothed", label: `Smoothed (${FACTORY_MA_MONTHS}-mo avg)` },
                  { key: "raw", label: "Raw" },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${mode === m.key ? toggleOn : toggleOff}`}
                  aria-pressed={mode === m.key}
                  onClick={() => setMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Current general activity, seasonally adjusted, monthly since May
            1968. Diffusion index: % of firms reporting higher activity minus %
            reporting lower.
          </p>
        </div>
        {last && lastState && (
          <div className="text-right">
            <p className="font-mono text-4xl font-semibold tabular-nums text-[#22d3ee]">
              {fmtReading(last.v)}
            </p>
            <span
              className="mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                color: lastState.color,
                borderColor: `${lastState.color}66`,
                background: `${lastState.color}1a`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: lastState.color }}
                aria-hidden
              />
              {lastState.label}
            </span>
            {lastState.note && (
              <p className="mt-1 text-[11px] text-muted">{lastState.note}</p>
            )}
            {last.ma != null && (
              <p className="mt-1 text-[11px] text-muted">
                {FACTORY_MA_MONTHS}-mo avg{" "}
                <span className="font-mono font-semibold tabular-nums text-[#22d3ee]">
                  {fmtReading(last.ma)}
                </span>
              </p>
            )}
            <p className="mt-1 font-mono text-[11px] text-muted">
              {fmtMonthKey(last.m)}
              {data?.snapshot ? " · snapshot" : ""}
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 rounded-lg border border-[#22d3ee]/30 bg-[#22d3ee]/5 px-3 py-2 text-xs leading-relaxed text-foreground/90">
        {FACTORY_NOT_ISM_NOTE}
      </p>

      <div className="mt-3 overflow-x-auto">
        {loading && (
          <p className="py-20 text-center text-sm text-muted">
            Loading Philly Fed survey…
          </p>
        )}
        {!loading && data && !data.ok && (
          <p className="py-16 text-center text-sm text-red-400">
            {data.error ?? "Could not load the survey data"}
          </p>
        )}
        {!loading && chart && (
          <div className="relative w-full min-w-[340px]">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair touch-none select-none"
              role="img"
              aria-label={`Philadelphia Fed manufacturing current general activity, ${tf} window. Hover for date, reading and state.`}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHover(null)}
            >
              <rect x={0} y={0} width={W} height={H} fill="#000" />
              {chart.bands.map((b) => (
                <rect
                  key={b.key}
                  x={b.x}
                  y={PAD.top}
                  width={b.w}
                  height={H - PAD.top - PAD.bottom}
                  fill="#9aa8b5"
                  opacity={0.14}
                />
              ))}
              {chart.yTicks.map((v) => (
                <g key={`y${v}`}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={chart.yOf(v)}
                    y2={chart.yOf(v)}
                    stroke="#1a222c"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 6}
                    y={chart.yOf(v) + 3}
                    textAnchor="end"
                    fill="#6b7785"
                    fontSize={10}
                  >
                    {v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0"}
                  </text>
                </g>
              ))}
              {chart.xTicks.map((t) => {
                const x = chart.xOf(t.idx);
                return (
                  <text
                    key={`x${t.idx}`}
                    x={x}
                    y={H - 10}
                    textAnchor="middle"
                    fill="#6b7785"
                    fontSize={10}
                  >
                    {t.label}
                  </text>
                );
              })}
              {LEVEL_LINES.map((l) => (
                <g key={`lvl${l.v}`}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={chart.yOf(l.v)}
                    y2={chart.yOf(l.v)}
                    stroke={l.color}
                    strokeWidth={l.width}
                    strokeDasharray={l.dash}
                    opacity={0.85}
                  />
                  <text
                    x={W - PAD.right + 4}
                    y={chart.yOf(l.v) + 3}
                    fill={l.color}
                    fontSize={10}
                    fontWeight={600}
                  >
                    {l.label}
                  </text>
                  {l.caption && (
                    // Right gutter, stacked under the value label so it never
                    // sits on top of the data line.
                    <text
                      x={W - PAD.right + 4}
                      y={chart.yOf(l.v) + 13}
                      fill={l.color}
                      fontSize={8.5}
                      fontWeight={500}
                    >
                      {l.caption.split(" ").map((w, i) => (
                        <tspan key={w} x={W - PAD.right + 4} dy={i === 0 ? 0 : 9}>
                          {w}
                        </tspan>
                      ))}
                    </text>
                  )}
                </g>
              ))}
              {last && (
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={chart.yOf(last.v)}
                  y2={chart.yOf(last.v)}
                  stroke={LINE}
                  strokeWidth={1}
                  strokeDasharray="1 4"
                  opacity={0.6}
                />
              )}
              {mode === "smoothed" ? (
                <>
                  <path
                    d={chart.path}
                    fill="none"
                    stroke={LINE}
                    strokeWidth={1}
                    strokeLinejoin="round"
                    opacity={0.3}
                  />
                  <path
                    d={chart.maPath}
                    fill="none"
                    stroke={LINE}
                    strokeWidth={tf === "ALL" ? 1.75 : 2.25}
                    strokeLinejoin="round"
                  />
                </>
              ) : (
                <path
                  d={chart.path}
                  fill="none"
                  stroke={LINE}
                  strokeWidth={tf === "ALL" ? 1.25 : 1.75}
                  strokeLinejoin="round"
                />
              )}
              {hover && (
                <g pointerEvents="none">
                  <line
                    x1={hover.x}
                    x2={hover.x}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke="#9eb0c8"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.8}
                  />
                  {mode === "smoothed" && hover.p.ma != null && (
                    <circle
                      cx={hover.x}
                      cy={hover.yRaw}
                      r={2.5}
                      fill={LINE}
                      opacity={0.55}
                    />
                  )}
                  <circle
                    cx={hover.x}
                    cy={hover.y}
                    r={4}
                    fill={LINE}
                    stroke="#000"
                    strokeWidth={1.5}
                  />
                </g>
              )}
            </svg>
            {hover && hoverState && (
              <div
                className="pointer-events-none absolute z-10 min-w-[180px] max-w-[240px] rounded-md border border-border/80 bg-[#0b0f14]/95 px-2.5 py-2 shadow-lg"
                style={{
                  left: `clamp(8px, calc(${(hover.x / W) * 100}% + 12px), calc(100% - 248px))`,
                  top: 12,
                }}
              >
                <p className="text-[11px] font-semibold text-[#e8eef7]">
                  {fmtMonthKey(hover.p.m)}
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted">Reading</span>
                  <span className="font-mono font-semibold tabular-nums text-[#22d3ee]">
                    {fmtReading(hover.p.v)}
                  </span>
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted">{FACTORY_MA_MONTHS}-mo avg</span>
                  <span className="font-mono font-semibold tabular-nums text-[#22d3ee]">
                    {hover.p.ma != null ? fmtReading(hover.p.ma) : "—"}
                  </span>
                </p>
                <p className="mt-1 flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-muted">State</span>
                  <span className="font-semibold" style={{ color: hoverState.color }}>
                    {hoverState.label}
                  </span>
                </p>
                {hoverState.note && (
                  <p className="mt-1 text-[10px] leading-snug text-muted">
                    {hoverState.note}
                  </p>
                )}
                {hover.inRecession && (
                  <p className="mt-1 text-[10px] text-[#b8c2cc]">
                    NBER recession month
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs font-medium text-foreground/85">
        {FACTORY_KEY_LINE}
      </p>
      <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted">
        <p>{FACTORY_LEVELS_FOOTNOTE}</p>
        <p>
          States: ≥+25 Hot market (manufacturing strong · bull-market
          backdrop; ≥+40 marks the high range, a reference line only) · 0 to &lt;+25 Expansion · −10 to &lt;0 Neutral / sluggish
          (manufacturing contracting, not automatically NBER recession) ·
          &lt;−10 Recessionary / weak (states use the raw monthly reading).
          Grey bands: NBER US recessions. Smoothed view: bold cyan line is the
          trailing {FACTORY_MA_MONTHS}-month average, faint line is the raw
          monthly reading. Dotted cyan line: latest raw reading.
        </p>
        <p>
          {asOfLabel ? FACTORY_SOURCE_LINE(asOfLabel) : FACTORY_SOURCE_LINE("—")}{" "}
          <a
            href={FACTORY_FRED_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            View on FRED →
          </a>
        </p>
        <p>
          Regional survey of manufacturers in the Philadelphia Fed district
          (eastern Pennsylvania, southern New Jersey and Delaware).{" "}
          <a
            href={FACTORY_PHILLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Survey page →
          </a>{" "}
          FRED® is a
          registered trademark of the Federal Reserve Bank of St. Louis. No
          endorsement implied.
        </p>
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs text-foreground/80">
        {FACTORY_FOOTER}
      </p>
    </section>
  );
}
