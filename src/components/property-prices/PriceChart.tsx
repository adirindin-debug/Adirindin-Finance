"use client";

import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { SERIES_COLORS } from "@/lib/rea/seed";
import {
  propertyPoints,
  sleevePoints,
  toRelative,
  toRelativeWithBase,
  toMs,
  valueAt,
  type Point,
} from "@/lib/rea/chart";
import {
  CHART_AS_OF,
  clipPoints,
  hasIndexedPath,
  indexedPath,
  melbourneOverlay,
  australiaOverlay,
  suburbOverlays,
  windowStart,
  type OverlayKey,
  type RangeKey,
} from "@/lib/rea/market";
import type { Property } from "@/lib/rea/types";
import { aud, signedPct } from "@/lib/utils";

type Scale = "aud" | "rel";
type SeriesMode = "each" | "sleeves" | "both";

const W = 960;
const H = 360;
const PAD = { top: 18, right: 18, bottom: 30, left: 58 };

type Series = {
  key: string;
  label: string;
  color: string;
  dash?: string;
  overlay?: boolean;
  proxy?: boolean;
  audPoints: Point[];
  linePoints: Point[];
  printPoints: Point[];
};

function firstValue(pts: Point[]): number | null {
  const hit = pts.find((p) => p.value != null && p.value !== 0);
  return hit?.value ?? null;
}

function prettyDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function pathD(
  pts: Point[],
  xOf: (t: number) => number,
  yOf: (v: number) => number,
): string {
  const known = pts.filter((p): p is { date: string; value: number } => p.value != null);
  if (known.length < 2) return "";
  return known
    .map((p, i) => {
      const cmd = i === 0 ? "M" : "L";
      return `${cmd}${xOf(toMs(p.date)).toFixed(1)} ${yOf(p.value).toFixed(1)}`;
    })
    .join(" ");
}

function buildSeries(
  properties: Property[],
  scale: Scale,
  mode: SeriesMode,
  range: RangeKey,
  overlay: OverlayKey,
): Series[] {
  const start = windowStart(range);
  const end = CHART_AS_OF;
  const carryFrom = start ? windowStart(range, start) : null;
  const yearCarry = start ? windowStart("1", start) : null;
  const series: Series[] = [];

  if (mode !== "sleeves") {
    properties.forEach((p, i) => {
      const proxy = indexedPath(p);
      const prints = propertyPoints(p).filter((pt) => {
        if (pt.value == null || proxy.length < 2) return true;
        const v = valueAt(proxy, pt.date);
        if (v == null || v === 0) return true;
        return Math.abs(pt.value - v) / v < 0.18;
      });
      const lineSrc = proxy.length >= 2 ? proxy : prints.length >= 2 ? prints : [];
      const linePts = clipPoints(lineSrc, start, end, true, yearCarry);
      const printPts = clipPoints(prints, start, end, false);
      if (!linePts.length && !printPts.length) return;
      const base = scale === "rel" ? (firstValue(linePts) ?? firstValue(printPts)) : null;
      series.push({
        key: p.id,
        label: p.address,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        proxy: proxy.length >= 2,
        audPoints: linePts,
        linePoints: scale === "rel" ? toRelativeWithBase(linePts, base) : linePts,
        printPoints: scale === "rel" ? toRelativeWithBase(printPts, base) : printPts,
      });
    });
  }
  if (mode !== "each") {
    const watch = clipPoints(sleevePoints(properties, "watch"), start, end, true, carryFrom);
    const owned = clipPoints(sleevePoints(properties, "owned"), start, end, true, carryFrom);
    if (watch.length) {
      series.push({
        key: "watch-sleeve",
        label: "Watchlist total",
        color: SERIES_COLORS[1],
        dash: "6 4",
        audPoints: watch,
        linePoints: scale === "rel" ? toRelative(watch) : watch,
        printPoints: [],
      });
    }
    if (owned.length) {
      series.push({
        key: "owned-sleeve",
        label: "Owned total",
        color: SERIES_COLORS[2],
        dash: "2 3",
        audPoints: owned,
        linePoints: scale === "rel" ? toRelative(owned) : owned,
        printPoints: [],
      });
    }
  }
  if (overlay === "australia") {
    const pts = clipPoints(australiaOverlay(), start, end, true, carryFrom);
    if (pts.length) {
      series.push({
        key: "australia-mean-abs",
        label: "Australia mean (ABS)",
        color: SERIES_COLORS[6],
        dash: "5 4",
        overlay: true,
        audPoints: pts,
        linePoints: scale === "rel" ? toRelative(pts) : pts,
        printPoints: [],
      });
    }
  }
  if (overlay === "melbourne") {
    const pts = clipPoints(melbourneOverlay(), start, end, true, carryFrom);
    if (pts.length) {
      series.push({
        key: "melbourne-houses",
        label: "Melbourne houses (VGV / Abelson)",
        color: SERIES_COLORS[6],
        dash: "3 5",
        overlay: true,
        audPoints: pts,
        linePoints: scale === "rel" ? toRelative(pts) : pts,
        printPoints: [],
      });
    }
  }
  if (overlay === "suburbs") {
    suburbOverlays(properties).forEach((s, i) => {
      const pts = clipPoints(s.points, start, end, true, carryFrom);
      if (!pts.length) return;
      series.push({
        key: s.key,
        label: s.label,
        color: SERIES_COLORS[(4 + i) % SERIES_COLORS.length],
        dash: "2 4",
        overlay: true,
        audPoints: pts,
        linePoints: scale === "rel" ? toRelative(pts) : pts,
        printPoints: [],
      });
    });
  }
  return series;
}

function yTicksOf(min: number, max: number): number[] {
  const span = max - min || 1;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(mag, Math.round(raw / mag) * mag) || 1;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return ticks.slice(0, 8);
}

export function PriceChart(props: {
  properties: Property[];
  scale: Scale;
  mode: SeriesMode;
  range: RangeKey;
  overlay: OverlayKey;
}) {
  const { properties, scale, mode, range, overlay } = props;
  const series = useMemo(
    () => buildSeries(properties, scale, mode, range, overlay),
    [properties, scale, mode, range, overlay],
  );
  const [hover, setHover] = useState<{
    svgX: number;
    date: string;
    items: { key: string; label: string; color: string; aud: number; rel: number | null }[];
  } | null>(null);

  const layout = useMemo(() => {
    const pts = series.flatMap((s) => s.linePoints).filter((p) => p.value != null);
    const start = windowStart(range) ?? "2005-01-01";
    const tMin = toMs(start);
    const tMax = toMs(CHART_AS_OF);
    let vMin = 0;
    let vMax = 1;
    if (pts.length) {
      vMin = Math.min(...pts.map((p) => p.value as number));
      vMax = Math.max(...pts.map((p) => p.value as number));
    }
    const pad = Math.max((vMax - vMin) * 0.08, scale === "rel" ? 2 : 20_000);
    vMin -= pad;
    vMax += pad;
    if (vMax === vMin) {
      vMax += 1;
      vMin -= 1;
    }
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const xOf = (t: number) => PAD.left + ((t - tMin) / Math.max(1, tMax - tMin)) * innerW;
    const yOf = (v: number) => PAD.top + ((vMax - v) / (vMax - vMin)) * innerH;
    const yTicks = yTicksOf(vMin, vMax);
    const y0 = Number(start.slice(0, 4));
    const y1 = Number(CHART_AS_OF.slice(0, 4));
    const step = y1 - y0 > 12 ? 2 : 1;
    const xTicks: string[] = [];
    for (let y = y0; y <= y1; y += step) xTicks.push(`${y}-01-01`);
    return { xOf, yOf, yTicks, xTicks, tMin, tMax, innerW };
  }, [series, range, scale]);

  function onMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!series.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = Math.min(1, Math.max(0, (svgX - PAD.left) / layout.innerW));
    const t = layout.tMin + ratio * (layout.tMax - layout.tMin);
    if (!Number.isFinite(t)) return;
    const date = new Date(t).toISOString().slice(0, 10);
    const items = series.flatMap((s) => {
      const audV = valueAt(s.audPoints, date);
      if (audV == null) return [];
      const base = firstValue(s.audPoints);
      const relV = base ? (audV / base - 1) * 100 : null;
      return [{ key: s.key, label: s.label, color: s.color, aud: audV, rel: relV }];
    });
    setHover({
      svgX: Math.min(W - PAD.right, Math.max(PAD.left, svgX)),
      date,
      items,
    });
  }

  const noProxy = properties
    .filter((p) => p.marks.length > 0 && !hasIndexedPath(p))
    .map((p) => p.address);
  const empty = properties.filter((p) => p.marks.length === 0).map((p) => p.address);

  return (
    <div className="min-w-0">
      <div className="relative overflow-hidden rounded-md bg-black">
        {series.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted md:h-96">
            No public prints in this window. Widen the range or log a dated mid.
          </div>
        ) : (
          <>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-72 w-full cursor-crosshair md:h-96"
              role="img"
              aria-label="Property prices"
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
            >
              {layout.yTicks.map((yt) => (
                <g key={yt}>
                  <line
                    x1={PAD.left}
                    y1={layout.yOf(yt)}
                    x2={W - PAD.right}
                    y2={layout.yOf(yt)}
                    stroke="#243041"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={8}
                    y={layout.yOf(yt) + 4}
                    fill="#9aa8b5"
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                  >
                    {scale === "rel"
                      ? `${Math.round(yt)}%`
                      : new Intl.NumberFormat("en-AU", { notation: "compact" }).format(yt)}
                  </text>
                </g>
              ))}
              {layout.xTicks.map((d) => (
                <text
                  key={d}
                  x={layout.xOf(toMs(d))}
                  y={H - 8}
                  fill="#9aa8b5"
                  fontSize="11"
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                >
                  {d.slice(0, 4)}
                </text>
              ))}
              {series.map((s) => {
                const d = pathD(s.linePoints, layout.xOf, layout.yOf);
                if (!d) return null;
                return (
                  <path
                    key={s.key}
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.overlay ? 1.5 : 2.25}
                    strokeDasharray={s.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })}
              {series.flatMap((s) =>
                s.printPoints
                  .filter((p) => p.value != null)
                  .map((p) => (
                    <circle
                      key={`${s.key}-${p.date}`}
                      cx={layout.xOf(toMs(p.date))}
                      cy={layout.yOf(p.value as number)}
                      r={4}
                      fill={s.color}
                      stroke="#0c1a2e"
                      strokeWidth={1.5}
                    />
                  )),
              )}
              {hover ? (
                <line
                  x1={hover.svgX}
                  y1={PAD.top}
                  x2={hover.svgX}
                  y2={H - PAD.bottom}
                  stroke="#3b82c4"
                  strokeOpacity={0.55}
                />
              ) : null}
            </svg>
            {hover && hover.items.length > 0 ? (
              <div
                className="pointer-events-none absolute top-3 z-10 min-w-[220px] max-w-[300px] rounded-lg border border-border bg-navy px-3 py-2.5 shadow-xl"
                style={{
                  left: `min(max(8px, calc(${(hover.svgX / W) * 100}% + 12px)), calc(100% - 260px))`,
                }}
              >
                <div className="mb-2 font-mono text-[11px] text-muted">
                  {prettyDate(hover.date)}
                </div>
                <ul className="space-y-1.5">
                  {hover.items.map((it) => (
                    <li key={it.key} className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: it.color }}
                        />
                        <span className="truncate">{it.label}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] tabular-nums">
                        {aud(it.aud)}
                        {it.rel != null ? (
                          <span className="ml-2 text-muted">{signedPct(it.rel)}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-muted">% vs first mark in this window</p>
              </div>
            ) : null}
          </>
        )}
      </div>
      {series.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span
                className="w-3.5 border-t-2"
                style={{
                  borderColor: s.color,
                  borderStyle: s.dash ? "dashed" : "solid",
                }}
              />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Solid line is a smoothed area-median path (official sale medians),
        scaled through each sale so it does not kink. History before the
        first print follows that median. Dots are the property’s own prints.
        Overlay: Off, Australia mean (ABS), Melbourne houses, or suburb
        medians. Not a valuation.
        {noProxy.length
          ? ` No suburb-proxy for ${noProxy.join(", ")}.`
          : ""}
        {empty.length ? ` Unresolved: ${empty.join(", ")}.` : ""}
      </p>
    </div>
  );
}
