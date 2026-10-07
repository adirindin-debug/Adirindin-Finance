"use client";

/**
 * Commodity charts — gold (default), silver, copper, nickel, lithium, iron ore.
 * Multi-select toggles: one metal = native units; 2+ metals = overlay with each
 * series indexed to 100 at the start of the visible window (daily + monthly
 * aligned on dates). Auto-scaled axis (log or linear), timeframe toggles,
 * hover read-out for every selected series and per-metal source attribution.
 * Gold is the long-run USD series that used to sit on /tools/gold-cycle
 * (with its 15 Aug 1971 Nixon Shock marker). Educational · NFA.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  COMMODITY_META,
  COMMODITY_ORDER,
  fmtCommodityValue,
  type CommoditiesPayload,
  type CommodityId,
  type CommodityPoint,
} from "@/lib/commodities";
import { GOLD_HISTORICAL_POINTS } from "@/lib/goldCommodityCycle";

type TfKey = "1Y" | "5Y" | "10Y" | "20Y" | "50Y" | "ALL";

const TIMEFRAMES: { key: TfKey; label: string; years: number | null }[] = [
  { key: "1Y", label: "1Y", years: 1 },
  { key: "5Y", label: "5Y", years: 5 },
  { key: "10Y", label: "10Y", years: 10 },
  { key: "20Y", label: "20Y", years: 20 },
  { key: "50Y", label: "50Y", years: 50 },
  { key: "ALL", label: "ALL", years: null },
];

const W = 760;
const H_DESK = 340;
/** Phones: taller plot so the series is readable at ~360px wide. */
const H_NARROW = 600;
const PAD = { top: 28, right: 18, bottom: 40, left: 66 };
const YEAR_SEC = 365.2425 * 86400;
const HISTORICAL = "#ffe14a";


function fmtDay(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function fmtMonth(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function nearestPoint<T extends { t: number }>(points: T[], t: number): T | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.t < t) lo = mid + 1;
    else hi = mid;
  }
  let best = points[lo]!;
  if (lo > 0 && Math.abs(points[lo - 1]!.t - t) <= Math.abs(best.t - t)) best = points[lo - 1]!;
  return best;
}

/** Keep min/max per bucket so spikes survive decimation. */
function decimate(points: CommodityPoint[], maxPts: number): CommodityPoint[] {
  if (points.length <= maxPts) return points;
  const buckets = Math.floor(maxPts / 2);
  const size = points.length / buckets;
  const out: CommodityPoint[] = [];
  for (let b = 0; b < buckets; b++) {
    const s = Math.floor(b * size);
    const e = Math.min(points.length, Math.floor((b + 1) * size));
    let lo = points[s]!;
    let hi = points[s]!;
    for (let i = s; i < e; i++) {
      const p = points[i]!;
      if (p.c < lo.c) lo = p;
      if (p.c > hi.c) hi = p;
    }
    if (lo.t <= hi.t) out.push(lo, hi);
    else out.push(hi, lo);
  }
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

function niceStep(span: number, target: number): number {
  const raw = span / Math.max(target, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * mag;
}

function linearTicks(lo: number, hi: number, target: number): number[] {
  const step = niceStep(hi - lo, target);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

function logTicks(lo: number, hi: number, target: number): number[] {
  const out: number[] = [];
  const e0 = Math.floor(Math.log10(lo));
  const e1 = Math.ceil(Math.log10(hi));
  for (const mult of [[1], [1, 5], [1, 2, 5], [1, 2, 3, 5, 7]]) {
    out.length = 0;
    for (let e = e0; e <= e1; e++) {
      for (const m of mult) {
        const v = m * Math.pow(10, e);
        if (v >= lo && v <= hi) out.push(Number(v.toPrecision(12)));
      }
    }
    if (out.length >= Math.min(3, target)) break;
  }
  return out;
}

function fmtTick(v: number): string {
  if (v >= 10000) return `${(v / 1000).toLocaleString("en-AU", { maximumFractionDigits: 0 })}k`;
  if (v >= 1000) return v.toLocaleString("en-AU", { maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(v % 1 === 0 ? 0 : 1);
  if (v >= 1) return v.toFixed(v % 1 === 0 ? 0 : 2);
  return v.toFixed(2);
}

type Drawn = {
  id: CommodityId;
  color: string;
  label: string;
  /** Windowed raw points. */
  raw: CommodityPoint[];
  /** Plotted values: native units (single) or indexed to 100 (overlay). */
  pts: { t: number; v: number }[];
  base: CommodityPoint | null;
  /** True when the series starts after the window start (rebased at its own first print). */
  lateStart: boolean;
};

export function CommodityChartsPanel() {
  const [data, setData] = useState<CommoditiesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CommodityId[]>(["gold"]);
  const [tf, setTf] = useState<TfKey>("ALL");
  const [log, setLog] = useState<boolean>(COMMODITY_META.gold.defaultLog);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setNarrow(w > 0 && w < 560);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);
  const fs = narrow ? 2.1 : 1;
  const H = narrow ? H_NARROW : H_DESK;

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const hardStop = setTimeout(() => ac.abort(), 25_000);
    (async () => {
      try {
        const res = await fetch("/api/commodities", { signal: ac.signal });
        const json = (await res.json()) as CommoditiesPayload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData({
            ok: false,
            error:
              e instanceof Error
                ? e.name === "AbortError"
                  ? "Timed out loading commodity prices"
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

  /** Selected metals that actually have data, in the fixed legend order. */
  const active = useMemo(
    () => COMMODITY_ORDER.filter((id) => selected.includes(id) && (data?.series?.[id]?.points.length ?? 0) >= 2),
    [selected, data],
  );
  const overlay = active.length >= 2;
  const single = !overlay ? active[0] ?? null : null;

  useEffect(() => setHoverT(null), [tf, selected, log]);

  const spanOf = useCallback(
    (id: CommodityId) => {
      const pts = data?.series?.[id]?.points ?? [];
      return pts.length >= 2 ? (pts[pts.length - 1]!.t - pts[0]!.t) / YEAR_SEC : 0;
    },
    [data],
  );
  /** Longest history among the selection — timeframes beyond it are disabled. */
  const maxSpan = active.length ? Math.max(...active.map(spanOf)) : 0;

  const toggleMetal = (id: CommodityId) => {
    const on = selected.includes(id);
    if (on && selected.length === 1) return; // keep at least one metal on
    const next = on ? selected.filter((x) => x !== id) : [...selected, id];
    const nextActive = COMMODITY_ORDER.filter((m) => next.includes(m));
    setSelected(nextActive);
    // Overlay reads best on log (equal % moves = equal distance); single uses the metal default.
    setLog(nextActive.length >= 2 ? true : COMMODITY_META[nextActive[0]!].defaultLog);
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    const longest = Math.max(...nextActive.map(spanOf), 0);
    if (meta.years != null && longest > 0 && meta.years > longest + 0.5) setTf("ALL");
  };

  const chart = useMemo(() => {
    if (!active.length || !data?.series) return null;
    const all = active.map((id) => ({ id, pts: data.series![id]!.points }));
    const tEnd = Math.max(...all.map((s) => s.pts[s.pts.length - 1]!.t));
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    let tStart: number;
    if (meta.years != null) tStart = tEnd - meta.years * YEAR_SEC;
    else if (all.length >= 2) tStart = Math.max(...all.map((s) => s.pts[0]!.t)); // ALL overlay: common start
    else tStart = all[0]!.pts[0]!.t;

    const drawn: Drawn[] = [];
    for (const s of all) {
      const raw = s.pts.filter((p) => p.t >= tStart && p.t <= tEnd && p.c > 0);
      if (raw.length < 2) continue;
      const base = overlay ? raw[0]! : null;
      drawn.push({
        id: s.id,
        color: COMMODITY_META[s.id].color,
        label: COMMODITY_META[s.id].label,
        raw,
        base,
        lateStart: overlay && raw[0]!.t - tStart > 40 * 86400,
        pts: raw.map((p) => ({ t: p.t, v: base ? (p.c / base.c) * 100 : p.c })),
      });
    }
    if (!drawn.length) return null;

    const t0 = Math.min(...drawn.map((d) => d.pts[0]!.t));
    const t1 = Math.max(...drawn.map((d) => d.pts[d.pts.length - 1]!.t));
    let vMin = Infinity;
    let vMax = -Infinity;
    for (const d of drawn) for (const p of d.pts) {
      vMin = Math.min(vMin, p.v);
      vMax = Math.max(vMax, p.v);
    }
    if (!Number.isFinite(vMin) || vMin <= 0) return null;
    const useLog = log && vMax / vMin > 1.05;
    const f = (v: number) => (useLog ? Math.log(v) : v);
    let v0 = f(vMin);
    let v1 = f(vMax);
    const pad = (v1 - v0) * 0.07 || Math.abs(v1) * 0.05 || 1;
    v0 -= pad;
    v1 += pad;
    if (!useLog && v0 < 0) v0 = 0;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const xOf = (t: number) => PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * iw;
    const yOf = (v: number) => PAD.top + ((v1 - f(Math.max(v, 1e-9))) / Math.max(v1 - v0, 1e-12)) * ih;
    const paths = drawn.map((d) => {
      const dec = decimate(
        d.pts.map((p) => ({ t: p.t, c: p.v })),
        drawn.length > 1 ? 700 : 900,
      );
      return {
        id: d.id,
        color: d.color,
        d: dec.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.c).toFixed(1)}`).join(" "),
      };
    });
    const lo = useLog ? Math.exp(v0) : v0;
    const hi = useLog ? Math.exp(v1) : v1;
    const target = narrow ? 4 : 6;
    const yTicks = useLog ? logTicks(lo, hi, target) : linearTicks(lo, hi, target);

    const y0 = new Date(t0 * 1000).getUTCFullYear();
    const y1 = new Date(t1 * 1000).getUTCFullYear();
    const span = (t1 - t0) / YEAR_SEC;
    let xTicks: { t: number; label: string }[] = [];
    if (span <= 1.5) {
      const d = new Date(t0 * 1000);
      let y = d.getUTCFullYear();
      let m = Math.ceil((d.getUTCMonth() + 1) / 3) * 3;
      for (let i = 0; i < 12; i++) {
        if (m >= 12) {
          m -= 12;
          y += 1;
        }
        const t = Date.UTC(y, m, 1) / 1000;
        if (t > t1) break;
        if (t >= t0) xTicks.push({ t, label: fmtMonth(t) });
        m += 3;
      }
    } else {
      const base = span > 120 ? 25 : span > 60 ? 10 : span > 25 ? 5 : span > 8 ? 2 : 1;
      const step = narrow ? base * 2 : base;
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
        const t = Date.UTC(y, 0, 1) / 1000;
        if (t >= t0 && t <= t1) xTicks.push({ t, label: String(y) });
      }
    }
    if (xTicks.length > 9) xTicks = xTicks.filter((_, i) => i % 2 === 0);

    const historical = active.includes("gold")
      ? GOLD_HISTORICAL_POINTS.map((h) => ({ ...h, ts: h.t / 1000 })).filter((h) => h.ts >= t0 && h.ts <= t1)
      : [];

    return { t0, t1, tStart, xOf, yOf, paths, drawn, yTicks, xTicks, historical, useLog };
  }, [active, data, tf, log, narrow, overlay, H]);

  /** Hover: nearest print per selected series (daily and monthly aligned on the date). */
  const hover = useMemo(() => {
    if (!chart || hoverT == null) return null;
    const rows = chart.drawn
      .map((d) => {
        const monthly = data?.series?.[d.id]?.frequency === "monthly";
        const maxGap = (monthly ? 46 : 10) * 86400;
        const p = nearestPoint(d.pts, hoverT);
        if (!p || Math.abs(p.t - hoverT) > maxGap) return null;
        const raw = nearestPoint(d.raw, p.t);
        return { id: d.id, label: d.label, color: d.color, t: p.t, v: p.v, raw: raw?.c ?? null, monthly };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    if (!rows.length) return null;
    return { x: chart.xOf(hoverT), t: hoverT, rows };
  }, [chart, hoverT, data]);

  const onMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (!chart || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      if (!rect.width) return;
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      if (svgX < PAD.left || svgX > W - PAD.right) {
        setHoverT(null);
        return;
      }
      let t = chart.t0 + ((svgX - PAD.left) / (W - PAD.left - PAD.right)) * (chart.t1 - chart.t0);
      // Single series: snap to its nearest print.
      if (chart.drawn.length === 1) {
        const p = nearestPoint(chart.drawn[0]!.raw, t);
        if (p) t = p.t;
      }
      setHoverT(t);
    },
    [chart],
  );

  const singleSeries = single ? data?.series?.[single] : undefined;
  const singleDrawn = single && chart ? chart.drawn[0] : undefined;
  const last = singleDrawn ? singleDrawn.raw[singleDrawn.raw.length - 1]! : null;
  const first = singleDrawn ? singleDrawn.raw[0]! : null;
  const chg = first && last ? (last.c / first.c - 1) * 100 : null;
  const fmtFor = (id: CommodityId, t: number) =>
    data?.series?.[id]?.frequency === "monthly" ? fmtMonth(t) : fmtDay(t);
  const fmtIdx = (v: number) => {
    const pct = v - 100;
    return `${v.toLocaleString("en-AU", { maximumFractionDigits: v >= 1000 ? 0 : 1 })} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`;
  };
  const headColor = single ? COMMODITY_META[single].color : "#e8eef7";

  const toggleBtn =
    "min-h-10 shrink-0 rounded-md px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs";
  const toggleOn = "bg-accent text-white shadow-sm";
  const toggleOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div
          className="flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
          role="group"
          aria-label="Metals (multi-select)"
        >
          {COMMODITY_ORDER.map((id) => {
            const on = selected.includes(id);
            const has = Boolean(data?.series?.[id]);
            const c = COMMODITY_META[id].color;
            return (
              <button
                key={id}
                type="button"
                className={`${toggleBtn} inline-flex items-center gap-1.5 border normal-case ${
                  on ? "text-[#f2f5f9]" : "border-transparent text-foreground/60 hover:bg-white/5 hover:text-foreground"
                }`}
                style={on ? { borderColor: `${c}cc`, background: `${c}2e` } : undefined}
                aria-pressed={on}
                disabled={!loading && !has}
                title={on && selected.length === 1 ? "At least one metal stays on" : undefined}
                onClick={() => toggleMetal(id)}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border"
                  style={{ background: on ? c : "transparent", borderColor: c }}
                  aria-hidden
                />
                {COMMODITY_META[id].label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted">Tap several metals to overlay them.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {overlay ? (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                Overlay · indexed
                <span className="ml-2 font-mono text-[11px] normal-case tracking-normal text-muted">
                  100 = {chart ? fmtMonth(chart.drawn.reduce((m, d) => Math.min(m, d.base?.t ?? m), Infinity)) : "start"}
                  {chart?.useLog ? " · log" : ""}
                </span>
              </h2>
              <p className="mt-1 max-w-xl text-xs text-muted sm:text-sm">
                Each metal is rebased to 100 at its first print in the visible window, so lines show
                relative % moves — not prices. Daily and monthly series are aligned on dates.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: headColor }}>
                {single ? COMMODITY_META[single].label : "—"}
                {singleSeries ? (
                  <span className="ml-2 font-mono text-[11px] normal-case tracking-normal text-muted">
                    {singleSeries.unit} · {singleSeries.frequency}
                    {chart?.useLog ? " · log" : ""}
                  </span>
                ) : null}
              </h2>
              {singleSeries ? (
                <p className="mt-1 max-w-xl text-xs text-muted sm:text-sm">{singleSeries.benchmark}</p>
              ) : null}
            </>
          )}
        </div>
        {!overlay && last && single ? (
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {fmtCommodityValue(single, last.c)}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">
              {singleSeries?.unit} · {fmtFor(single, last.t)}
              {singleSeries && !singleSeries.live ? (
                <span className="ml-1.5 uppercase tracking-wide text-amber-300/90">
                  {singleSeries.snapshot ? "snapshot" : "stale"}
                </span>
              ) : null}
            </p>
            {chg != null ? (
              <p className="mt-0.5 font-mono text-xs" style={{ color: chg >= 0 ? "#3dcc9a" : "#ef6b6b" }}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(1)}% over window
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
          role="group"
          aria-label="Timeframe"
        >
          {TIMEFRAMES.map((w) => (
            <button
              key={w.key}
              type="button"
              className={`${toggleBtn} ${tf === w.key ? toggleOn : toggleOff}`}
              aria-pressed={tf === w.key}
              disabled={w.years != null && maxSpan > 0 && w.years > maxSpan + 0.5}
              onClick={() => setTf(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div
          className="inline-flex gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
          role="group"
          aria-label="Axis scale"
        >
          {[
            { k: true, l: "Log" },
            { k: false, l: "Linear" },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              className={`${toggleBtn} ${log === o.k ? toggleOn : toggleOff}`}
              aria-pressed={log === o.k}
              onClick={() => setLog(o.k)}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {overlay && chart ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
          {chart.drawn.map((d) => {
            const lastV = d.pts[d.pts.length - 1]!.v;
            return (
              <li key={d.id} className="inline-flex items-center gap-1.5 text-xs">
                <span className="h-[3px] w-4 rounded-full" style={{ background: d.color }} aria-hidden />
                <span className="font-semibold" style={{ color: d.color }}>
                  {d.label}
                </span>
                <span className="font-mono text-muted">
                  {fmtIdx(lastV)}
                  {d.lateStart && d.base ? ` · from ${fmtMonth(d.base.t)}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div ref={boxRef} className="mt-3">
        {loading && <p className="py-20 text-center text-sm text-muted">Loading commodity prices…</p>}
        {!loading && data && !data.ok && (
          <p className="py-16 text-center text-sm text-red-400">
            {data.error ?? "Could not load commodity prices"}
          </p>
        )}
        {!loading && data?.ok && !active.length && (
          <p className="py-16 text-center text-sm text-muted">
            Selected metal data is unavailable right now — never invented, so nothing is drawn.
          </p>
        )}
        {!loading && chart && (
          <div className="relative w-full">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="w-full cursor-crosshair touch-pan-y"
              role="img"
              aria-label={
                overlay
                  ? `${chart.drawn.map((d) => d.label).join(", ")} overlaid, each indexed to 100 at the start of the ${tf} window${chart.useLog ? ", log scale" : ""}. Hover for values.`
                  : `${single ? COMMODITY_META[single].label : ""} price, ${singleSeries?.unit ?? ""}, ${tf} window${chart.useLog ? ", log scale" : ""}. Hover for values.`
              }
              onMouseMove={onMove}
              onMouseLeave={() => setHoverT(null)}
            >
              <rect width={W} height={H} fill="#0a0a0a" rx="6" />
              {chart.yTicks.map((v) => (
                <g key={v}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={chart.yOf(v)}
                    y2={chart.yOf(v)}
                    stroke={overlay && v === 100 ? "#3a4558" : "#1c2430"}
                    strokeWidth={1}
                    strokeDasharray={overlay && v === 100 ? "4 3" : undefined}
                  />
                  <text
                    x={PAD.left - 8}
                    y={chart.yOf(v) + 3.5 * fs}
                    textAnchor="end"
                    fill="#8a97a8"
                    fontSize={10 * fs}
                  >
                    {fmtTick(v)}
                  </text>
                </g>
              ))}
              {chart.xTicks.map((x) => (
                <g key={x.t}>
                  <line
                    x1={chart.xOf(x.t)}
                    x2={chart.xOf(x.t)}
                    y1={PAD.top}
                    y2={H - PAD.bottom}
                    stroke="#141b24"
                    strokeWidth={1}
                  />
                  <text
                    x={chart.xOf(x.t)}
                    y={H - PAD.bottom + 16 * (narrow ? 1.5 : 1)}
                    textAnchor="middle"
                    fill="#8a97a8"
                    fontSize={10 * fs}
                  >
                    {x.label}
                  </text>
                </g>
              ))}
              {overlay ? (
                <text x={PAD.left} y={PAD.top - 10} fill="#6b7a90" fontSize={9 * fs}>
                  Index · 100 = window start
                </text>
              ) : null}

              {chart.historical.map((h) => {
                const x = chart.xOf(h.ts);
                return (
                  <g key={h.t}>
                    <title>{`${h.label} — ${h.note}`}</title>
                    <line
                      x1={x}
                      x2={x}
                      y1={PAD.top + 4}
                      y2={H - PAD.bottom}
                      stroke={HISTORICAL}
                      strokeWidth={1.25}
                      strokeDasharray="3 3"
                      opacity={0.8}
                    />
                    <text x={x + 5} y={PAD.top + 12 * fs} fill={HISTORICAL} fontSize={10 * fs} fontWeight={700}>
                      {h.label}
                    </text>
                    <text x={x + 5} y={PAD.top + 24 * fs} fill={HISTORICAL} fontSize={8.5 * fs} opacity={0.85}>
                      Nixon Shock
                    </text>
                  </g>
                );
              })}

              {chart.paths.map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={(narrow ? 2.4 : 1.9) * (overlay && p.id !== "gold" ? 0.9 : 1)}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}

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
                    opacity={0.85}
                  />
                  {hover.rows.map((r) => (
                    <circle
                      key={r.id}
                      cx={chart.xOf(r.t)}
                      cy={chart.yOf(r.v)}
                      r={4}
                      fill={r.color}
                      stroke="#0a0a0a"
                      strokeWidth={1.5}
                    />
                  ))}
                </g>
              )}
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-10 min-w-[190px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: `clamp(8px, calc(${(hover.x / W) * 100}% + 12px), calc(100% - ${overlay ? 250 : 200}px))`,
                  top: 12,
                }}
              >
                <p className="mb-1 text-[11px] font-semibold text-[#e8eef7]">
                  {overlay ? fmtMonth(hover.t) : fmtFor(hover.rows[0]!.id, hover.rows[0]!.t)}
                </p>
                {hover.rows.map((r) => (
                  <p key={r.id} className="mt-0.5 flex items-center justify-between gap-3 text-[11px] tabular-nums">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} aria-hidden />
                      {r.label}
                    </span>
                    <span className="font-mono font-semibold text-[#e8eef7]">
                      {overlay ? (
                        <>
                          {fmtIdx(r.v)}
                          {r.raw != null ? (
                            <span className="ml-1 font-normal text-muted">
                              {fmtCommodityValue(r.id, r.raw)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {fmtCommodityValue(r.id, r.v)}{" "}
                          <span className="text-muted">{data?.series?.[r.id]?.unit}</span>
                        </>
                      )}
                    </span>
                  </p>
                ))}
              </div>
            )}
            <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-muted">
              {chart.drawn.map((d) => {
                const s = data?.series?.[d.id];
                if (!s) return null;
                return (
                  <p key={d.id}>
                    <span className="font-semibold" style={{ color: d.color }}>
                      {d.label}
                    </span>{" "}
                    ·{" "}
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {s.source}
                    </a>{" "}
                    · {s.frequency === "daily" ? "daily closes" : "monthly"} · {s.unit} ·{" "}
                    {fmtFor(d.id, s.points[0]!.t)} – {fmtFor(d.id, s.points[s.points.length - 1]!.t)}
                    {s.snapshot ? " · dated snapshot (live source unavailable)" : s.stale ? " · last good copy" : ""}
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-border/70 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">Sources</h3>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          {COMMODITY_ORDER.map((id) => {
            const s = data?.series?.[id];
            return (
              <li key={id}>
                <span className="font-semibold" style={{ color: COMMODITY_META[id].color }}>
                  {COMMODITY_META[id].label}
                </span>{" "}
                —{" "}
                {s ? (
                  <>
                    <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {s.source}
                    </a>{" "}
                    · {s.benchmark} · {s.unit} · {s.frequency}
                  </>
                ) : loading ? (
                  "loading…"
                ) : (
                  "unavailable right now"
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Futures closes via Yahoo Finance are delayed third-party data (continuous front-month
          contracts can jump at rolls). IMF PCPS prices are monthly averages of benchmark quotes ©
          International Monetary Fund; nickel / iron ore fall back to the same IMF series via FRED®
          (Federal Reserve Bank of St. Louis). Gold peg-era levels are documented official prints,
          not invented. The lithium series is the IMF’s lithium metal benchmark, not lithium
          carbonate or spodumene. Overlay mode indexes each metal to 100 at the window start — it
          compares % moves, not prices. No endorsement implied. Educational only — not financial
          advice (NFA).
        </p>
      </div>
    </section>
  );
}
