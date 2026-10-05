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
  DD_LEVELS,
  EQ_FOOTER,
  PHASES,
  REPAIR_COLOR,
  enrich,
  fmtDay,
  fmtPct,
  fmtPx,
  summarise,
  type EqPayload,
  type EqPoint,
} from "@/lib/globalEquities";

type TfKey = "YTD" | "1Y" | "3Y" | "5Y" | "10Y" | "15Y" | "20Y" | "MAX";
/** years: null = everything; "ytd" = from 1 Jan of the browser's current year. */
const TIMEFRAMES: { key: TfKey; label: string; years: number | "ytd" | null }[] = [
  { key: "YTD", label: "YTD", years: "ytd" },
  { key: "1Y", label: "1Y", years: 1 },
  { key: "3Y", label: "3Y", years: 3 },
  { key: "5Y", label: "5Y", years: 5 },
  { key: "10Y", label: "10Y", years: 10 },
  { key: "15Y", label: "15Y", years: 15 },
  { key: "20Y", label: "20Y", years: 20 },
  { key: "MAX", label: "Max", years: null },
];

const W = 760;
const PAD_L = 52;
const PAD_R = 56;
const TOP = { y: 12, h: 250 };
const BAR = { y: 270, h: 10 };
const BOT = { y: 292, h: 165 };
const H = 485;
const LINE = "#22d3ee";
const VIX_COLOR = "#c4b5fd";
const DD_COLOR = "#f87171";
const LEVEL_COLORS = ["#fbbf24", "#fb923c", "#a78bfa", "#e879f9"];

const PHASE_ORDER = [
  PHASES.hot,
  PHASES.cooling,
  PHASES.stress,
  PHASES.washout,
  PHASES.capitulation,
];

function cutoff(last: string, years: number): string {
  return `${String(Number(last.slice(0, 4)) - years).padStart(4, "0")}${last.slice(4)}`;
}

function dayNum(d: string): number {
  return Date.parse(`${d}T00:00:00Z`) / 86400000;
}

export function GlobalEquitiesPanel() {
  const [data, setData] = useState<EqPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>("MAX");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/global-equities");
        const json = (await res.json()) as EqPayload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setData({ ok: false, error: e instanceof Error ? e.message : "Fetch failed" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Zoom window in day numbers (UTC days since epoch); null = full range.
  const [zoom, setZoom] = useState<{ a: number; b: number } | null>(null);
  const [sel, setSel] = useState<{ x0: number; x1: number } | null>(null);
  const dragRef = useRef<{ startX: number } | null>(null);
  const touchesRef = useRef<Map<number, number>>(new Map());
  const pinchRef = useRef<{ d0: number; a0: number; b0: number; midFrac: number; midDay: number } | null>(null);

  useEffect(() => {
    setHoverIdx(null);
    setZoom(null);
    setSel(null);
  }, [tf]);

  const all = useMemo(() => (data?.ok && data.rows ? enrich(data.rows) : []), [data]);
  const summary = useMemo(() => summarise(all), [all]);

  const rangePts = useMemo(() => {
    if (!all.length) return [] as EqPoint[];
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    if (meta.years == null) return all;
    if (meta.years === "ytd") {
      // Live from the browser date: 1 Jan of the current calendar year.
      const jan1 = `${new Date().getFullYear()}-01-01`;
      const ytd = all.filter((p) => p.d >= jan1);
      if (ytd.length >= 2) return ytd;
      // First days of January: anchor on the last close of the prior year.
      const prior = all.filter((p) => p.d < jan1).slice(-1);
      return [...prior, ...ytd];
    }
    const c = cutoff(all[all.length - 1]!.d, meta.years);
    return all.filter((p) => p.d > c);
  }, [all, tf]);

  /** Points in view: the range, narrowed by any zoom. */
  const pts = useMemo(() => {
    if (!zoom) return rangePts;
    const v = rangePts.filter((p) => {
      const n = dayNum(p.d);
      return n >= zoom.a && n <= zoom.b;
    });
    return v.length >= 2 ? v : rangePts;
  }, [rangePts, zoom]);

  const chart = useMemo(() => {
    if (pts.length < 2) return null;
    const x0 = dayNum(pts[0]!.d);
    const x1 = dayNum(pts[pts.length - 1]!.d);
    const iw = W - PAD_L - PAD_R;
    const xOf = (d: string) => PAD_L + ((dayNum(d) - x0) / Math.max(x1 - x0, 1)) * iw;

    let pLo = Infinity;
    let pHi = -Infinity;
    let ddLo = 0;
    let vHi = 0;
    for (const p of pts) {
      pLo = Math.min(pLo, p.px);
      pHi = Math.max(pHi, p.ath);
      ddLo = Math.min(ddLo, p.dd);
      if (p.vix != null) vHi = Math.max(vHi, p.vix);
    }
    const pad = (pHi - pLo) * 0.06;
    pLo -= pad;
    pHi += pad;
    const yP = (v: number) => TOP.y + ((pHi - v) / (pHi - pLo)) * TOP.h;
    ddLo = Math.min(-0.14, Math.floor((ddLo - 0.02) * 20) / 20);
    const yD = (dd: number) => BOT.y + (dd / ddLo) * BOT.h;
    vHi = Math.ceil((vHi + 2) / 10) * 10 || 40;
    const yV = (v: number) => BOT.y + BOT.h - (v / vHi) * BOT.h;

    const line = (f: (p: EqPoint) => number | null) => {
      let s = "";
      let pen = false;
      for (const p of pts) {
        const y = f(p);
        if (y == null) {
          pen = false;
          continue;
        }
        s += `${pen ? "L" : "M"}${xOf(p.d).toFixed(1)} ${y.toFixed(1)}`;
        pen = true;
      }
      return s;
    };
    const pricePath = line((p) => yP(p.px));
    const athPath = line((p) => yP(p.ath));
    const bandPaths = DD_LEVELS.map((lvl) => line((p) => yP(p.ath * (1 + lvl))));
    const ddLine = line((p) => yD(p.dd));
    const ddArea = `${ddLine} L${xOf(pts[pts.length - 1]!.d).toFixed(1)} ${BOT.y} L${xOf(pts[0]!.d).toFixed(1)} ${BOT.y} Z`;
    const vixPath = line((p) => (p.vix != null ? yV(p.vix) : null));

    // Phase bar segments (runs of the same phase) and Repair runs.
    type Seg = { x: number; w: number; color: string; key: string };
    const segs: Seg[] = [];
    const repairs: Seg[] = [];
    let start = 0;
    for (let i = 1; i <= pts.length; i++) {
      if (i === pts.length || pts[i]!.phase.key !== pts[start]!.phase.key) {
        const xa = xOf(pts[start]!.d);
        const xb = i < pts.length ? xOf(pts[i]!.d) : W - PAD_R;
        segs.push({ x: xa, w: Math.max(xb - xa, 0.6), color: pts[start]!.phase.color, key: `p${start}` });
        start = i;
      }
    }
    start = -1;
    for (let i = 0; i <= pts.length; i++) {
      const on = i < pts.length && pts[i]!.repair;
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
        const xa = xOf(pts[start]!.d);
        const xb = i < pts.length ? xOf(pts[i]!.d) : W - PAD_R;
        repairs.push({ x: xa, w: Math.max(xb - xa, 0.6), color: REPAIR_COLOR, key: `r${start}` });
        start = -1;
      }
    }

    const pTicks: number[] = [];
    const rawStep = (pHi - pLo) / 4;
    const mag = 10 ** Math.floor(Math.log10(rawStep));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? rawStep;
    for (let v = Math.ceil(pLo / step) * step; v <= pHi; v += step) pTicks.push(v);
    const y0 = Number(pts[0]!.d.slice(0, 4));
    const y1 = Number(pts[pts.length - 1]!.d.slice(0, 4));
    const yStep = y1 - y0 > 8 ? 2 : 1;
    const xTicks: { d: string; label: string }[] = [];
    if (x1 - x0 < 730) {
      // Short windows: quarterly ticks (Jan / Apr / Jul / Oct).
      // Very short (zoomed) windows: monthly ticks.
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const every = x1 - x0 < 200 || tf === "YTD" ? 1 : 3;
      for (let y = y0; y <= y1; y++) {
        for (let m = 0; m < 12; m += every) {
          const d = `${y}-${String(m + 1).padStart(2, "0")}-01`;
          const n = dayNum(d);
          if (n > x0 && n <= x1) xTicks.push({ d, label: `${MON[m]} ${String(y).slice(2)}` });
        }
      }
    } else {
      for (let y = y0 + 1; y <= y1; y += 1)
        if ((y - y0 - 1) % yStep === 0) xTicks.push({ d: `${y}-01-01`, label: String(y) });
    }
    // Deeper labelled gridlines (−40%, −50%, …) only when the auto-scaled axis reaches them.
    const deeperTicks: number[] = [];
    for (let k = 4; -k / 10 >= ddLo; k++) deeperTicks.push(-k / 10);
    const ddTicks = [0, ...DD_LEVELS, ...deeperTicks].filter((l) => l >= ddLo);
    const lastP = pts[pts.length - 1]!;
    return {
      xOf, yP, yD, yV, vHi, pricePath, athPath, bandPaths, ddLine, ddArea, vixPath,
      segs, repairs, pTicks, xTicks, ddTicks, ddLo, lastP, x0, x1,
    };
  }, [pts, tf]);

  const toSvgX = useCallback((clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width) return null;
    return ((clientX - rect.left) / rect.width) * W;
  }, []);

  const dayAt = useCallback(
    (sx: number): number => {
      if (!chart) return 0;
      const f = Math.min(Math.max((sx - PAD_L) / (W - PAD_L - PAD_R), 0), 1);
      return chart.x0 + f * (chart.x1 - chart.x0);
    },
    [chart],
  );

  const hoverAt = useCallback(
    (sx: number) => {
      if (!chart) return;
      if (sx < PAD_L - 4 || sx > W - PAD_R + 4) {
        setHoverIdx(null);
        return;
      }
      const target = dayAt(sx);
      let lo = 0;
      let hi = pts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (dayNum(pts[mid]!.d) < target) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && Math.abs(dayNum(pts[lo - 1]!.d) - target) < Math.abs(dayNum(pts[lo]!.d) - target)) lo--;
      setHoverIdx(lo);
    },
    [chart, pts, dayAt],
  );

  const applyZoom = useCallback(
    (a: number, b: number) => {
      if (rangePts.length < 2) return;
      const ra = dayNum(rangePts[0]!.d);
      const rb = dayNum(rangePts[rangePts.length - 1]!.d);
      const span = Math.max(b - a, 10); // at least ~2 trading weeks
      if (span >= rb - ra) {
        setZoom(null);
        return;
      }
      let za = Math.max(a, ra);
      let zb = za + span;
      if (zb > rb) {
        zb = rb;
        za = rb - span;
      }
      setZoom({ a: za, b: zb });
    },
    [rangePts],
  );

  const onDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const sx = toSvgX(e.clientX);
      if (sx == null || !chart) return;
      if (e.pointerType === "touch") {
        touchesRef.current.set(e.pointerId, e.clientX);
        if (touchesRef.current.size === 2) {
          const xs = [...touchesRef.current.values()].map((cx) => toSvgX(cx) ?? 0);
          const mid = (xs[0]! + xs[1]!) / 2;
          pinchRef.current = {
            d0: Math.max(Math.abs(xs[0]! - xs[1]!), 1),
            a0: chart.x0,
            b0: chart.x1,
            midFrac: Math.min(Math.max((mid - PAD_L) / (W - PAD_L - PAD_R), 0), 1),
            midDay: dayAt(mid),
          };
          setHoverIdx(null);
          return;
        }
        hoverAt(sx);
        return;
      }
      if (e.button !== 0) return;
      dragRef.current = { startX: Math.min(Math.max(sx, PAD_L), W - PAD_R) };
      setSel(null);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      hoverAt(sx);
    },
    [chart, toSvgX, dayAt, hoverAt],
  );

  const onMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const sx = toSvgX(e.clientX);
      if (sx == null || !chart) return;
      if (e.pointerType === "touch" && touchesRef.current.has(e.pointerId)) {
        touchesRef.current.set(e.pointerId, e.clientX);
        const pinch = pinchRef.current;
        if (pinch && touchesRef.current.size === 2) {
          const xs = [...touchesRef.current.values()].map((cx) => toSvgX(cx) ?? 0);
          const d1 = Math.max(Math.abs(xs[0]! - xs[1]!), 1);
          const span = (pinch.b0 - pinch.a0) * (pinch.d0 / d1);
          const a = pinch.midDay - pinch.midFrac * span;
          applyZoom(a, a + span);
          return;
        }
      }
      const drag = dragRef.current;
      if (drag) {
        setSel({ x0: drag.startX, x1: Math.min(Math.max(sx, PAD_L), W - PAD_R) });
      }
      hoverAt(sx);
    },
    [chart, toSvgX, applyZoom, hoverAt],
  );

  const onUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "touch") {
        touchesRef.current.delete(e.pointerId);
        if (touchesRef.current.size < 2) pinchRef.current = null;
        return;
      }
      const drag = dragRef.current;
      dragRef.current = null;
      setSel(null);
      if (!drag || !chart) return;
      const sx = toSvgX(e.clientX);
      if (sx == null) return;
      const end = Math.min(Math.max(sx, PAD_L), W - PAD_R);
      if (Math.abs(end - drag.startX) < 6) return; // a click, not a drag
      const a = dayAt(Math.min(drag.startX, end));
      const b = dayAt(Math.max(drag.startX, end));
      setHoverIdx(null);
      applyZoom(a, b);
    },
    [chart, toSvgX, dayAt, applyZoom],
  );

  const resetZoom = useCallback(() => {
    setZoom(null);
    setSel(null);
    setHoverIdx(null);
  }, []);

  useEffect(() => setHoverIdx(null), [zoom]);

  const hp = hoverIdx != null ? pts[hoverIdx] : null;

  const toggleBtn = "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-accent text-white shadow-sm";
  const toggleOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  const scalePos = summary ? Math.min(Math.max(-summary.dd / 0.4, 0), 1) : 0;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#22d3ee]">
              World equities drawdown
            </h2>
            <div className="inline-flex gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1" role="group" aria-label="Timeframe">
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
            {zoom && (
              <button
                type="button"
                onClick={resetZoom}
                className="rounded-md border border-[#22d3ee]/60 bg-[#22d3ee]/10 px-3 py-1.5 text-xs font-semibold text-[#22d3ee] transition-colors hover:bg-[#22d3ee]/20"
              >
                Reset zoom
              </button>
            )}
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Developed-world equities via the iShares MSCI World ETF (URTH), a labelled proxy for
            MSCI World. Drawdown from the all-time high sets the phase; VIX tilts the label one
            notch.
          </p>
        </div>
        {summary && (
          <div className="w-full max-w-[260px] text-right">
            <p className="font-mono text-4xl font-semibold tabular-nums text-[#22d3ee]">
              {fmtPct(summary.dd)}
            </p>
            <p className="text-[11px] text-muted">from ATH · {fmtDay(summary.date)}</p>
            <span
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                color: summary.phase.color,
                borderColor: `${summary.phase.color}66`,
                background: `${summary.phase.color}1a`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: summary.phase.color }} aria-hidden />
              {summary.phase.label}
            </span>
            <p className="mt-1 text-[11px] text-muted">
              {summary.tag ?? "No sentiment tilt"}
            </p>
            <div className="relative mt-2 h-2 w-full overflow-visible rounded-full" aria-label="Phase scale by drawdown">
              <div className="flex h-2 w-full overflow-hidden rounded-full">
                {[
                  [PHASES.hot, 5],
                  [PHASES.cooling, 7],
                  [PHASES.stress, 8],
                  [PHASES.washout, 10],
                  [PHASES.capitulation, 10],
                ].map(([ph, w]) => {
                  const p = ph as (typeof PHASES)["hot"];
                  return <span key={p.key} style={{ width: `${((w as number) / 40) * 100}%`, background: p.color, opacity: p.key === summary.phase.key ? 1 : 0.35 }} />;
                })}
              </div>
              <span
                className="absolute -top-1 h-4 w-0.5 rounded bg-white"
                style={{ left: `calc(${scalePos * 100}% - 1px)` }}
                aria-hidden
              />
            </div>
            <div className="relative mt-1 h-3 font-mono text-[9px] text-muted">
              {[
                [0, "0%"],
                [12 / 40, "−12%"],
                [20 / 40, "−20%"],
                [30 / 40, "−30%"],
              ].map(([pos, lab]) => (
                <span
                  key={lab as string}
                  className="absolute -translate-x-1/2 first:translate-x-0"
                  style={{ left: `${(pos as number) * 100}%` }}
                >
                  {lab}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {summary && (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-black/40 p-3 text-xs sm:grid-cols-4 lg:grid-cols-7">
          {[
            ["Last (adj.)", `US$${fmtPx(summary.px)}`],
            ["ATH", `US$${fmtPx(summary.ath)} · ${fmtDay(summary.athDate)}`],
            ["Drawdown", fmtPct(summary.dd)],
            ["12m total return", fmtPct(summary.ret12m)],
            ["vs 200-day MA", fmtPct(summary.dist200d)],
            ["vs 200-week MA", fmtPct(summary.dist200w)],
            [
              "VIX (5y pctile)",
              summary.vix != null
                ? `${summary.vix.toFixed(1)}${summary.vixPct != null ? ` (p${Math.round(summary.vixPct)})` : ""}`
                : "—",
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 overflow-x-auto">
        {loading && <p className="py-24 text-center text-sm text-muted">Loading global equities…</p>}
        {!loading && data && !data.ok && (
          <p className="py-16 text-center text-sm text-red-400">{data.error ?? "Could not load data"}</p>
        )}
        {!loading && chart && (
          <div className="relative w-full min-w-[360px]">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair touch-none select-none"
              role="img"
              aria-label={`URTH (MSCI World proxy) with all-time-high bands, phase bar, drawdown and VIX, ${tf} window. Hover for values.`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onPointerLeave={() => {
                if (!dragRef.current) setHoverIdx(null);
              }}
              onDoubleClick={resetZoom}
            >
              <defs>
                <clipPath id="eq-top">
                  <rect x={PAD_L} y={TOP.y} width={W - PAD_L - PAD_R} height={TOP.h} />
                </clipPath>
              </defs>
              <rect x={0} y={0} width={W} height={H} fill="#000" />
              {/* Top pane */}
              {chart.pTicks.map((v) => (
                <g key={`pt${v}`}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={chart.yP(v)} y2={chart.yP(v)} stroke="#1a222c" />
                  <text x={PAD_L - 6} y={chart.yP(v) + 3} textAnchor="end" fill="#6b7785" fontSize={10}>
                    {v.toFixed(0)}
                  </text>
                </g>
              ))}
              <g clipPath="url(#eq-top)">
                {chart.bandPaths.map((d, i) => (
                  <path key={`b${i}`} d={d} fill="none" stroke={LEVEL_COLORS[i]} strokeWidth={0.9} strokeDasharray="4 4" opacity={0.7} />
                ))}
                <path d={chart.athPath} fill="none" stroke="#f5f7fa" strokeWidth={1} opacity={0.75} />
                <path d={chart.pricePath} fill="none" stroke={LINE} strokeWidth={1.5} strokeLinejoin="round" />
              </g>
              {(["ATH", "−5%", "−12%", "−20%", "−30%"] as const).map((lab, i) => {
                const y = chart.yP(chart.lastP.ath * (i === 0 ? 1 : 1 + DD_LEVELS[i - 1]!));
                if (y < TOP.y - 2 || y > TOP.y + TOP.h + 2) return null;
                return (
                  <text key={lab} x={W - PAD_R + 4} y={y + 3} fontSize={10} fontWeight={600} fill={i === 0 ? "#f5f7fa" : LEVEL_COLORS[i - 1]}>
                    {lab}
                  </text>
                );
              })}
              {/* Phase bar */}
              {chart.segs.map((s) => (
                <rect key={s.key} x={s.x} y={BAR.y} width={s.w} height={BAR.h} fill={s.color} opacity={0.9} />
              ))}
              {chart.repairs.map((s) => (
                <rect key={s.key} x={s.x} y={BAR.y + BAR.h - 3} width={s.w} height={3} fill={s.color} />
              ))}
              {/* Bottom pane */}
              {chart.ddTicks.map((l) => (
                <g key={`dt${l}`}>
                  <line
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={chart.yD(l)}
                    y2={chart.yD(l)}
                    stroke={
                      DD_LEVELS.includes(l as (typeof DD_LEVELS)[number])
                        ? LEVEL_COLORS[DD_LEVELS.indexOf(l as (typeof DD_LEVELS)[number])]
                        : "#3a4656"
                    }
                    strokeDasharray={l === 0 ? undefined : "3 4"}
                    opacity={l === 0 ? 1 : 0.6}
                  />
                  <text x={PAD_L - 6} y={chart.yD(l) + 3} textAnchor="end" fill="#6b7785" fontSize={10}>
                    {l === 0 ? "0%" : `−${Math.round(-l * 100)}%`}
                  </text>
                </g>
              ))}
              <path d={chart.ddArea} fill={DD_COLOR} opacity={0.28} />
              <path d={chart.ddLine} fill="none" stroke={DD_COLOR} strokeWidth={1} opacity={0.9} />
              <path d={chart.vixPath} fill="none" stroke={VIX_COLOR} strokeWidth={0.9} opacity={0.75} />
              {[0, chart.vHi / 2, chart.vHi].map((v) => (
                <text key={`v${v}`} x={W - PAD_R + 4} y={chart.yV(v) + 3} fill={VIX_COLOR} fontSize={9} opacity={0.85}>
                  {v.toFixed(0)}
                </text>
              ))}
              <text x={W - PAD_R + 4} y={BOT.y - 4} fill={VIX_COLOR} fontSize={9} fontWeight={600}>
                VIX
              </text>
              <text x={PAD_L} y={BOT.y - 4} fill="#9aa8b5" fontSize={9} fontWeight={600}>
                Drawdown from ATH
              </text>
              {chart.xTicks.map((t) => (
                <text key={`x${t.d}`} x={chart.xOf(t.d)} y={H - 8} textAnchor="middle" fill="#6b7785" fontSize={10}>
                  {t.label}
                </text>
              ))}
              {sel && Math.abs(sel.x1 - sel.x0) > 1 && (
                <rect
                  x={Math.min(sel.x0, sel.x1)}
                  y={TOP.y}
                  width={Math.abs(sel.x1 - sel.x0)}
                  height={BOT.y + BOT.h - TOP.y}
                  fill="#22d3ee"
                  opacity={0.12}
                  stroke="#22d3ee"
                  strokeOpacity={0.5}
                  pointerEvents="none"
                />
              )}
              {hp && (
                <g pointerEvents="none">
                  <line x1={chart.xOf(hp.d)} x2={chart.xOf(hp.d)} y1={TOP.y} y2={BOT.y + BOT.h} stroke="#9eb0c8" strokeDasharray="3 3" opacity={0.8} />
                  <circle cx={chart.xOf(hp.d)} cy={chart.yP(hp.px)} r={3.5} fill={LINE} stroke="#000" strokeWidth={1.5} />
                  <circle cx={chart.xOf(hp.d)} cy={chart.yD(hp.dd)} r={3} fill={DD_COLOR} stroke="#000" strokeWidth={1.2} />
                  {hp.vix != null && (
                    <circle cx={chart.xOf(hp.d)} cy={chart.yV(hp.vix)} r={2.5} fill={VIX_COLOR} stroke="#000" strokeWidth={1} />
                  )}
                </g>
              )}
            </svg>
            {hp && (
              <div
                className="pointer-events-none absolute z-10 min-w-[200px] max-w-[250px] rounded-md border border-border/80 bg-[#0b0f14]/95 px-2.5 py-2 text-[11px] shadow-lg"
                style={{
                  left: `clamp(8px, calc(${(chart.xOf(hp.d) / W) * 100}% + 12px), calc(100% - 258px))`,
                  top: 12,
                }}
              >
                <p className="font-semibold text-[#e8eef7]">{fmtDay(hp.d)}</p>
                {[
                  ["URTH (adj.)", `US$${fmtPx(hp.px)}`, LINE],
                  ["ATH to date", `US$${fmtPx(hp.ath)}`, "#c5d0de"],
                  ["Drawdown", fmtPct(hp.dd), DD_COLOR],
                  [
                    "VIX",
                    hp.vix != null ? `${hp.vix.toFixed(1)}${hp.vixPct != null ? ` (5y p${Math.round(hp.vixPct)})` : ""}` : "—",
                    VIX_COLOR,
                  ],
                ].map(([k, v, c]) => (
                  <p key={k} className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-muted">{k}</span>
                    <span className="font-mono font-semibold tabular-nums" style={{ color: c }}>
                      {v}
                    </span>
                  </p>
                ))}
                <p className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-muted">Phase</span>
                  <span className="font-semibold" style={{ color: hp.phase.color }}>
                    {hp.phase.label}
                  </span>
                </p>
                {hp.tag && <p className="mt-1 text-[10px] leading-snug" style={{ color: hp.repair ? REPAIR_COLOR : "#b8c2cc" }}>{hp.tag}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {chart && (
        <p className="mt-2 text-[11px] text-muted">
          {zoom && pts.length
            ? `Zoomed: ${fmtDay(pts[0]!.d)} – ${fmtDay(pts[pts.length - 1]!.d)} · `
            : ""}
          Drag across the chart to zoom (pinch on touch) · double-click or Reset zoom to go back ·
          range buttons reset the zoom
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/85">
        {PHASE_ORDER.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ background: p.color }} aria-hidden />
            {p.label} ({p.band})
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1 w-3 rounded-sm" style={{ background: REPAIR_COLOR }} aria-hidden />
          Repair (thin strip)
        </span>
      </div>
      <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted">
        <p>
          Phase = drawdown of URTH adjusted close from its all-time high (series starts 12 Jan 2012,
          so 15Y, 20Y and Max show the same span). Repair: still more than 12% below the high, at least 5%
          off the low since that high, and higher than three months ago — fear staying high is normal
          here. Sentiment tilt, one notch only, from VIX vs its own 5-year range: Hot market+ when VIX is
          in its lowest 10% (complacent), &quot;Hot market but nervous&quot; at the 75th percentile or above,
          Cooling with rising vol, Washout+ on a VIX spike (90th percentile or ≥30). Greed or low vol
          is a strength flag only, not a short signal. No top or bottom dates.
        </p>
        <p>
          Price: iShares MSCI World ETF (URTH, NYSE Arca) adjusted close (dividends reinvested) via
          Yahoo Finance, used as a proxy — not MSCI index data. MSCI World is a trademark of MSCI Inc.;
          iShares is a trademark of BlackRock. No endorsement implied.
        </p>
        <p>
          Sentiment: Chicago Board Options Exchange, CBOE Volatility Index: VIX, via FRED (VIXCLS).{" "}
          <a href="https://fred.stlouisfed.org/series/VIXCLS" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            View on FRED →
          </a>{" "}
          As of {data?.asOf ? fmtDay(data.asOf) : "—"} (price)
          {data?.vixAsOf ? ` · ${fmtDay(data.vixAsOf)} (VIX)` : ""}
          {data?.snapshot ? " · dated snapshot" : ""}.
        </p>
      </div>
      <p className="mt-4 border-t border-border pt-3 text-xs text-foreground/80">{EQ_FOOTER}</p>
    </section>
  );
}
