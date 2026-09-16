"use client";
import { Component, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SERIES_COLORS } from "@/lib/rea/seed";
import {
  propertyPoints,
  sleevePoints,
  toRelative,
  toRelativeWithBase,
  unionDates,
  monthGrid,
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
  toMs,
  windowStart,
  yearTicks,
  type OverlayKey,
  type RangeKey,
} from "@/lib/rea/market";
import type { Property } from "@/lib/rea/types";
import { aud, cn, signedPct } from "@/lib/utils";

type Scale = "aud" | "rel";
type SeriesMode = "each" | "sleeves" | "both";

const SWATCH = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
  "bg-chart-8",
];

function mapByDate(pts: Point[]): Record<string, number | null> {
  const o: Record<string, number | null> = {};
  for (const p of pts) o[p.date] = p.value;
  return o;
}

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

function HoverTip({
  active,
  payload,
  maps,
}: {
  active?: boolean;
  payload?: Array<{ payload?: Record<string, unknown> }>;
  maps: { key: string; label: string; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const date = typeof row.date === "string" ? row.date : "";
  const items = maps.flatMap((s) => {
    const audV = row[`${s.key}__aud`];
    const relV = row[`${s.key}__rel`];
    if (typeof audV !== "number") return [];
    return [
      {
        key: s.key,
        label: s.label,
        color: s.color,
        aud: audV,
        rel: typeof relV === "number" ? relV : null,
      },
    ];
  });
  if (!items.length) return null;
  return (
    <div className="min-w-[240px] max-w-[320px] rounded-lg border border-border bg-navy px-3 py-2.5 shadow-xl">
      <div className="mb-2 font-mono text-[11px] text-muted">{prettyDate(date)}</div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.key} className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: it.color }}
              />
              <span className="truncate">{it.label}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground">
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
  );
}

function useBox() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...box };
}

function formatTick(ms: number, range: RangeKey): string {
  const iso = new Date(ms).toISOString().slice(0, 10);
  if (range === "1" || range === "3") return iso.slice(0, 7);
  return iso.slice(0, 4);
}

class ChartGuard extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };
  static getDerivedStateFromError(err: unknown) {
    const message = err instanceof Error ? err.message : "Chart failed to render.";
    return { message };
  }
  render() {
    if (this.state.message) {
      return (
        <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border bg-black px-4 text-center text-sm text-muted md:h-96">
          {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export function PriceChart(props: {
  properties: Property[];
  scale: Scale;
  mode: SeriesMode;
  range: RangeKey;
  overlay: OverlayKey;
}) {
  return (
    <ChartGuard>
      <PriceChartInner {...props} />
    </ChartGuard>
  );
}

function PriceChartInner({
  properties,
  scale,
  mode,
  range,
  overlay,
}: {
  properties: Property[];
  scale: Scale;
  mode: SeriesMode;
  range: RangeKey;
  overlay: OverlayKey;
}) {
  const { ref, w, h } = useBox();
  const start = windowStart(range);
  const end = CHART_AS_OF;
  const carryFrom = start ? windowStart(range, start) : null;
  const yearCarry = start ? windowStart("1", start) : null;

  type Series = {
    key: string;
    printKey?: string;
    label: string;
    color: string;
    swatch: string;
    dash?: string;
    overlay?: boolean;
    proxy?: boolean;
    audPoints: Point[];
    linePoints: Point[];
    printPoints: Point[];
  };
  const series: Series[] = [];

  if (mode !== "sleeves") {
    properties.forEach((p, i) => {
      const proxy = indexedPath(p);
      const prints = propertyPoints(p);
      const lineSrc = proxy.length >= 2 ? proxy : prints.length >= 2 ? prints : [];
      const linePts = clipPoints(lineSrc, start, end, true, yearCarry);
      const printPts = clipPoints(prints, start, end, false);
      if (!linePts.length && !printPts.length) return;
      const base = scale === "rel" ? (firstValue(linePts) ?? firstValue(printPts)) : null;
      series.push({
        key: p.id,
        printKey: `${p.id}__print`,
        label: p.address,
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        swatch: SWATCH[i % SWATCH.length],
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
        swatch: SWATCH[1],
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
        swatch: SWATCH[2],
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
        swatch: SWATCH[6],
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
        swatch: SWATCH[6],
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
      const idx = (4 + i) % SWATCH.length;
      series.push({
        key: s.key,
        label: s.label,
        color: SERIES_COLORS[idx],
        swatch: SWATCH[idx],
        dash: "2 4",
        overlay: true,
        audPoints: pts,
        linePoints: scale === "rel" ? toRelative(pts) : pts,
        printPoints: [],
      });
    });
  }

  const axisStart = start ?? "2005-01-01";
  const knownDates = unionDates(series.flatMap((s) => [s.audPoints, s.printPoints]));
  const dates = [
    ...new Set([...monthGrid(axisStart, end), ...knownDates]),
  ].sort();
  const maps = series.map((s) => ({
    ...s,
    base: firstValue(s.audPoints),
    printByDate: mapByDate(s.printPoints),
  }));
  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = {
      date,
      t: toMs(date),
    };
    for (const s of maps) {
      const audV = valueAt(s.audPoints, date);
      const relV =
        audV != null && s.base
          ? ((audV / s.base - 1) * 100)
          : null;
      row[s.key] = scale === "rel" ? relV : audV;
      row[`${s.key}__aud`] = audV;
      row[`${s.key}__rel`] = relV;
      if (s.printKey) row[s.printKey] = s.printByDate[date] ?? null;
    }
    return row;
  });
  const ticks = yearTicks(axisStart, end)
    .map((ms) => new Date(ms).toISOString().slice(0, 10))
    .filter((d) => dates.includes(d));
  const noProxy = properties
    .filter((p) => p.marks.length > 0 && !hasIndexedPath(p))
    .map((p) => p.address);
  const empty = properties.filter((p) => p.marks.length === 0).map((p) => p.address);

  return (
    <div className="min-w-0">
      <div ref={ref} className="h-72 w-full min-w-0 cursor-crosshair overflow-hidden md:h-96">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted">
            No public prints in this window. Widen the range or log a dated mid.
          </div>
        ) : w < 40 || h < 40 ? (
          <div className="h-full w-full rounded-md border border-dashed border-border bg-black" />
        ) : (
          <ComposedChart
            width={w}
            height={h}
            data={data}
            margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(d: string) =>
                range === "1" || range === "3" ? String(d).slice(0, 7) : String(d).slice(0, 4)
              }
              tickMargin={8}
              minTickGap={24}
              interval="preserveStartEnd"
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(v: number) =>
                scale === "rel"
                  ? `${v}%`
                  : new Intl.NumberFormat("en-AU", { notation: "compact" }).format(v)
              }
              width={56}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{
                stroke: "var(--accent)",
                strokeOpacity: 0.55,
                strokeWidth: 1,
              }}
              content={(props) => <HoverTip {...props} maps={maps} />}
              isAnimationActive={false}
              wrapperStyle={{ zIndex: 20, pointerEvents: "none" }}
            />
            {maps.map((s) =>
              s.linePoints.length ? (
                <Line
                  key={`${s.key}-line`}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={s.overlay ? 1.25 : 2}
                  strokeDasharray={s.dash}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                  legendType="none"
                />
              ) : null,
            )}
            {maps
              .filter((s) => s.printKey && s.printPoints.length)
              .map((s) => (
                <Scatter
                  key={`${s.key}-dot`}
                  dataKey={s.printKey}
                  name={`${s.label} · print`}
                  fill={s.color}
                  stroke="var(--navy)"
                  strokeWidth={1.5}
                  r={5}
                  tooltipType="none"
                  isAnimationActive={false}
                  legendType="none"
                />
              ))}
          </ComposedChart>
        )}
      </div>
      {maps.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {maps.map((s) => (
            <span
              key={s.key}
              className="inline-flex items-center gap-1.5 text-xs text-muted"
            >
              {s.dash ? (
                <span
                  className={cn(
                    "w-3.5 border-t-2 border-dashed",
                    s.swatch.replace(/^bg-/, "border-"),
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "w-3.5 border-t-2",
                    s.swatch.replace(/^bg-/, "border-"),
                  )}
                />
              )}
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Solid line is a suburb-proxy (VGV suburb YoY from 2013; Abelson/ABS
        Melbourne YoY before that), reset at each public sale and drawn
        through every print — including the latest mark. Dots are public
        prints (sale, list-mid, estimate). Overlay can be Off, Australia
        mean (ABS 6432.0 stock mean — same series as TradingView AUAHP),
        Melbourne houses, or suburb medians. Not a valuation, not Cotality
        HVI, and not a monthly AVM.
        {noProxy.length
          ? ` No suburb-proxy for ${noProxy.join(", ")} (need a sale, or an estimate in a suburb we have tables for).`
          : ""}
        {empty.length ? ` Unresolved: ${empty.join(", ")}.` : ""}
      </p>
    </div>
  );
}
