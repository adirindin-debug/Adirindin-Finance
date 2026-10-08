"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  factoryState,
  factorySummary,
  fmtReading,
  type FactoryPayload,
} from "@/lib/factoryMonitor";
import {
  eqHoverLine,
  enrich as enrichEquities,
  fmtPct,
  summarise as summariseEquities,
  type EqPayload,
} from "@/lib/globalEquities";
import {
  ASSET_DEF,
  MONTH_LABELS,
  cellKey,
  currentMonthOdds,
  fmtRet,
  tileBg,
  type SeasonAsset,
  type SeasonPayload,
} from "@/lib/seasonality";
import {
  ETF_ASSET_META,
  aggregateFlows,
  buildTotalSeries,
  flowColor,
  fmtFlowUsd,
  type EtfFlowsPayload,
} from "@/lib/etfFlows";
import type { CommodityTilePayload } from "@/lib/commodities";

type TileStatus = "loading" | "ok" | "error";

type SparkPoint = { t: number; v: number };

type TileLive = {
  status: TileStatus;
  headline: string;
  headlineColor?: string;
  secondary: string;
  secondaryColor?: string;
  spark?: SparkPoint[];
  /** Optional overrides used by the Philly Fed tile (others unchanged). */
  sparkColor?: string;
  chip?: { label: string; color: string };
  /** Small line under the chip (e.g. sentiment tilt). */
  chipSubtitle?: string;
  tooltip?: string;
  /** false = dated snapshot fallback (hides the Live badge). */
  isLive?: boolean;
  /** Seasonality tile only: mini year × month heatmap instead of a sparkline. */
  mini?: MiniHeat;
  /** ETF flows tile: recent monthly net-flow bars. */
  miniBars?: MiniBars;
  /** Commodity charts tile: rebased multi-line preview (no fills). */
  multi?: MultiLines;
};

type MultiLines = {
  caption: string;
  lines: Array<{ id: string; label: string; color: string; points: SparkPoint[] }>;
};

type MiniHeat = {
  caption: string;
  cols: string[];
  rows: Array<{
    year: number;
    cells: Array<{ bg: string; title: string; current: boolean }>;
  }>;
};

type MiniBars = {
  caption: string;
  bars: Array<{ key: string; label: string; v: number; title: string }>;
};

type Category = {
  id: string;
  label: string;
  tiles: TileDef[];
};

type TileDef = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  endpoint: string;
  parse: (json: unknown) => Omit<TileLive, "status"> | null;
};

function fmtCompactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

function fmtPctSigned(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtRatio(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

function lastSpark(
  points: Array<{ t: number; v: number }> | undefined,
  max = 72,
): SparkPoint[] | undefined {
  if (!points?.length) return undefined;
  return points.slice(-max);
}

function parseFearGreed(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as {
    ok?: boolean;
    current?: { value?: number; classification?: string; color?: string };
    points?: Array<{ t: number; value: number }>;
  };
  if (
    !data?.ok ||
    data.current?.value == null ||
    !Number.isFinite(data.current.value)
  ) {
    return null;
  }
  const value = Math.round(data.current.value);
  const classification = data.current.classification?.trim() || "—";
  const color = data.current.color;
  const spark = lastSpark(data.points?.map((p) => ({ t: p.t, v: p.value })));
  return {
    headline: String(value),
    headlineColor: color,
    secondary: classification,
    secondaryColor: color,
    spark,
  };
}

function parseMarketVolume(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as {
    ok?: boolean;
    currentVolumeUsd?: number | null;
    seriesKind?: string | null;
    maWindow?: number;
    points?: Array<{ t: number; volumeUsd: number }>;
  };
  if (
    !data?.ok ||
    data.currentVolumeUsd == null ||
    !Number.isFinite(data.currentVolumeUsd)
  ) {
    return null;
  }
  const is7dma = data.seriesKind === "7dma" || (data.maWindow ?? 0) === 7;
  const spark = lastSpark(
    data.points?.map((p) => ({ t: p.t, v: p.volumeUsd })),
  );
  return {
    headline: fmtCompactUsd(data.currentVolumeUsd),
    secondary: is7dma ? "7D MA volume" : "24h volume (raw)",
    spark,
  };
}

function parseBtc200w(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as {
    ok?: boolean;
    current?: {
      price?: number;
      ma200w?: number;
      pctFromMa?: number;
    };
    points?: Array<{ t: number; price: number; pctFromMa?: number }>;
  };
  const cur = data?.current;
  if (!data?.ok || cur?.pctFromMa == null || !Number.isFinite(cur.pctFromMa)) {
    return null;
  }
  const pct = cur.pctFromMa;
  const positive = pct >= 0;
  const spark = lastSpark(
    data.points?.map((p) => ({
      t: p.t,
      v: Number.isFinite(p.pctFromMa) ? (p.pctFromMa as number) : p.price,
    })),
  );
  return {
    headline: fmtPctSigned(pct),
    headlineColor: positive ? "#3dcc9a" : "#ef6b6b",
    secondary: "vs 200w MA",
    secondaryColor: positive ? "#3dcc9a" : "#ef6b6b",
    spark,
  };
}

/** Live BTC spot for the cycle-map tile (same /api/btc-200w-ma feed). */
function parseBtcCycleMap(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as {
    ok?: boolean;
    current?: {
      price?: number;
    };
    points?: Array<{ t: number; price: number }>;
  };
  const price = data?.current?.price;
  if (!data?.ok || price == null || !Number.isFinite(price)) {
    return null;
  }
  const spark = lastSpark(data.points?.map((p) => ({ t: p.t, v: p.price })));
  return {
    headline: fmtCompactUsd(price),
    secondary: "50w / 200w desk",
    spark,
  };
}

function parseWilshireM2(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as {
    ok?: boolean;
    current?: { ratio?: number };
    points?: Array<{ t: number; ratio: number }>;
    snapshot?: boolean;
  };
  const ratio = data?.current?.ratio;
  if (!data?.ok || ratio == null || !Number.isFinite(ratio)) {
    return null;
  }
  const spark = lastSpark(data.points?.map((p) => ({ t: p.t, v: p.ratio })));
  return {
    headline: fmtRatio(ratio),
    secondary: "Wilshire ÷ US M2",
    spark,
    isLive: !data.snapshot,
  };
}

/** Philly Fed manufacturing survey (via FRED) — 20Y monthly sparkline. NOT ISM. */
function parseFactoryMonitor(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as FactoryPayload;
  const pts = data?.ok ? (data.points ?? []) : [];
  const last = pts[pts.length - 1];
  if (!last || !Number.isFinite(last.v)) return null;
  const state = factoryState(last.v);
  const spark = pts.slice(-240).map((p, i) => ({ t: i, v: p.v }));
  return {
    headline: fmtReading(last.v),
    headlineColor: "#22d3ee",
    secondary: `${state.label}${state.note ? ` · ${state.note}` : ""}`,
    spark,
    sparkColor: "#22d3ee",
    chip: { label: state.label, color: state.color },
    tooltip: factorySummary(pts) ?? undefined,
    isLive: !data.snapshot,
  };
}

/** World equities drawdown — URTH (MSCI World proxy) drawdown phase + VIX tilt. */
function parseGlobalEquities(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as EqPayload;
  if (!data?.ok || !data.rows?.length) return null;
  const pts = enrichEquities(data.rows);
  const s = summariseEquities(pts);
  if (!s) return null;
  // Weekly-sampled sparkline over the full URTH history (~14.7 years).
  const spark: SparkPoint[] = [];
  for (let i = 0; i < pts.length; i += 5) spark.push({ t: i, v: pts[i]!.px });
  const lastPt = pts[pts.length - 1]!;
  if (spark[spark.length - 1]?.v !== lastPt.px) spark.push({ t: pts.length, v: lastPt.px });
  return {
    headline: `${fmtPct(s.dd)} from ATH`,
    headlineColor: "#22d3ee",
    secondary: s.phase.label,
    spark,
    sparkColor: "#22d3ee",
    chip: { label: s.phase.label, color: s.phase.color },
    chipSubtitle: s.tag ?? "No sentiment tilt (VIX mid-range)",
    tooltip: eqHoverLine(s),
    isLive: !data.snapshot,
  };
}

/**
 * Seasonality cards — one per market, led by its headline asset (Bitcoin for
 * crypto, MSCI World for equities): this month's average past return, its green
 * odds, and a mini year × month grid.
 */
function seasonalityParser(lead: SeasonAsset) {
  return (json: unknown): Omit<TileLive, "status"> | null => {
    const data = json as SeasonPayload;
    const series = data?.ok ? data.assets?.[lead] : undefined;
    if (!series?.months?.length) return null;
    const odds = currentMonthOdds(series);
    if (odds.stat.avg == null || odds.stat.pctGreen == null) return null;
    const short = odds.monthName.slice(0, 3);
    const label = ASSET_DEF[lead].label;
    const years = odds.grid.years.slice(0, 5);
    const rows = years.map((year) => ({
      year,
      cells: MONTH_LABELS.map((m, col) => {
        const c = odds.grid.cells.get(cellKey(year, col));
        const ret = c && (c.ret != null || c.inProgress) ? c.ret : null;
        return {
          bg: c && ret != null ? tileBg(lead, "monthly", ret) : "rgba(255,255,255,0.03)",
          title: c && ret != null ? `${m} ${year}: ${fmtRet(ret)}${c.inProgress ? " (in progress)" : ""}` : `${m} ${year}`,
          current: Boolean(c?.inProgress) || (year === odds.grid.current?.year && col === odds.grid.current.col),
        };
      }),
    }));
    const greenPct = Math.round(odds.stat.pctGreen);
    const redPct = 100 - greenPct;
    const leanGreen = greenPct >= redPct;
    const topPct = leanGreen ? greenPct : redPct;
    const topWord = leanGreen ? "green" : "red";
    const soFar = odds.live?.ret != null ? ` · ${short} ${odds.grid.current?.year} so far ${fmtRet(odds.live.ret)}` : "";
    return {
      // At-a-glance: whichever side is more common for this month, plus the average return.
      headline: `${topPct}% ${topWord} · avg ${fmtRet(odds.stat.avg)}`,
      headlineColor: leanGreen ? "#3dcc9a" : "#ef6b6b",
      secondary: `${label} ${odds.monthName}s: ${odds.stat.green} of ${odds.stat.n}${soFar} · history, not a forecast`,
      mini: { caption: `${label} monthly returns · last 5 years`, cols: MONTH_LABELS, rows },
      isLive: !series.snapshot,
    };
  };
}

/**
 * Crypto ETF flows — Bitcoin monthly net bars at a glance; detail page has
 * daily/weekly/monthly/quarterly/yearly for BTC/ETH/SOL/ZCSH.
 */
function parseEtfFlows(json: unknown): Omit<TileLive, "status"> | null {
  const data = json as EtfFlowsPayload;
  if (!data?.ok || !data.assets) return null;
  const total = buildTotalSeries(data.assets);
  if (total.status !== "ok" || !total.days.length) return null;
  const months = aggregateFlows(total.days, "monthly").slice(-12);
  if (!months.length) return null;
  const last = months[months.length - 1]!;
  const cum = last.cumulativeUsd;
  return {
    headline: fmtFlowUsd(cum),
    headlineColor: flowColor(cum),
    secondary: `${last.label} · ${fmtFlowUsd(last.netFlowUsd)} · Total net ${fmtFlowUsd(cum)}`,
    secondaryColor: flowColor(last.netFlowUsd),
    miniBars: {
      caption: "Monthly net flows · Total (all crypto ETFs)",
      bars: months.map((m) => ({
        key: m.key,
        label: m.label.split(" ")[0]!.slice(0, 3),
        v: m.netFlowUsd,
        title: `${m.label}: ${fmtFlowUsd(m.netFlowUsd)}`,
      })),
    },
    isLive: !total.snapshot,
  };
}

function parseCommodities(json: unknown): Omit<TileLive, "status"> | null {
  const p = json as CommodityTilePayload;
  if (!p?.ok || !Array.isArray(p.lines) || p.lines.length < 2) return null;
  const lines = p.lines
    .filter((l) => Array.isArray(l.points) && l.points.length >= 2)
    .map((l) => ({ id: l.id, label: l.label, color: l.color, points: l.points }));
  if (lines.length < 2) return null;
  const gold = p.gold;
  const goldLine = lines.find((l) => l.id === "gold");
  const goldChg = goldLine ? goldLine.points[goldLine.points.length - 1]!.v - 100 : null;
  return {
    headline:
      gold && Number.isFinite(gold.c)
        ? `$${gold.c.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`
        : "—",
    headlineColor: "#f0c14a",
    secondary:
      goldChg != null
        ? `Gold US$/oz · ${fmtPctSigned(goldChg)} over ${p.windowYears ?? 5}y`
        : "Gold US$/oz",
    multi: {
      caption: `Rebased to 100 · ${p.windowYears ?? 5} years · monthly`,
      lines,
    },
    isLive: p.live !== false,
  };
}

const CATEGORIES: Category[] = [
  {
    id: "sentiment",
    label: "Sentiment",
    tiles: [
      {
        id: "fear-greed",
        href: "/charts/fear-greed",
        title: "Fear & Greed",
        endpoint: "/api/fear-greed",
        parse: parseFearGreed,
      },
      {
        id: "crypto-fear-greed",
        href: "/charts/crypto-fear-greed",
        title: "Crypto Fear & Greed",
        endpoint: "/api/fear-greed-crypto",
        parse: parseFearGreed,
      },
    ],
  },
{
    id: "seasonality",
    label: "Seasonality",
    tiles: [
      {
        id: "seasonality-equities",
        href: "/charts/seasonality/equities",
        title: "Equities seasonality",
        subtitle: "MSCI World · monthly & quarterly returns",
        endpoint: "/api/seasonality?market=equities",
        parse: seasonalityParser("msci"),
      },
      {
        id: "seasonality-crypto",
        href: "/charts/seasonality/crypto",
        title: "Crypto seasonality",
        subtitle: "Bitcoin · monthly & quarterly returns",
        endpoint: "/api/seasonality?market=crypto",
        parse: seasonalityParser("btc"),
      },
    
    ],
  },
  {
    id: "macro",
    label: "Macro",
    tiles: [
      {
        id: "global-equities",
        href: "/charts/global-equities",
        title: "World equities drawdown",
        subtitle: "MSCI World proxy (URTH) · daily · VIX tilt",
        endpoint: "/api/global-equities",
        parse: parseGlobalEquities,
      },
      {
        id: "factory-monitor",
        href: "/charts/factory-monitor",
        title: "Philly Fed Manufacturing",
        subtitle: "Philly Fed survey · monthly · not ISM",
        endpoint: "/api/factory-monitor",
        parse: parseFactoryMonitor,
      },
      {
        id: "wilshire-m2",
        href: "/charts/wilshire-m2",
        title: "Wilshire 5000 / US M2",
        endpoint: "/api/wilshire-m2",
        parse: parseWilshireM2,
      },
      {
        id: "commodities",
        href: "/charts/commodities",
        title: "Commodity charts",
        subtitle: "Gold · silver · copper · nickel · lithium · iron ore",
        endpoint: "/api/commodities?view=tile",
        parse: parseCommodities,
      },
    ],
  },
  {
    id: "crypto-markets",
    label: "Crypto markets",
    tiles: [
      {
        id: "etf-flows",
        href: "/charts/etf-flows",
        title: "Crypto ETF flows",
        subtitle: "US spot · BTC · ETH · SOL · ZCSH",
        endpoint: "/api/etf-flows",
        parse: parseEtfFlows,
      },
      {
        id: "market-volume",
        href: "/charts/market-volume",
        title: "Market volume",
        endpoint: "/api/market-volume",
        parse: parseMarketVolume,
      },
      {
        id: "btc-200w-ma",
        href: "/charts/btc-200w-ma",
        title: "BTC 200-week MA",
        endpoint: "/api/btc-200w-ma",
        parse: parseBtc200w,
      },
      {
        id: "btc-cycle-map",
        href: "/charts/btc-cycle-map",
        title: "BTC cycle map",
        endpoint: "/api/btc-200w-ma",
        parse: parseBtcCycleMap,
      },
    ],
  },
  ];

const ALL_TILES = CATEGORIES.flatMap((c) => c.tiles);

function Sparkline({
  points,
  color = "#3b82c4",
}: {
  points: SparkPoint[];
  color?: string;
}) {
  if (points.length < 2) return null;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 320;
  const h = 140;
  const padY = 8;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = padY + (1 - (p.v - min) / span) * (h - padY * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Soft fill under the line for at-a-glance presence on large tiles.
  const area = `${d} L${w.toFixed(1)},${h} L0,${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-[140px] w-full opacity-90"
      aria-hidden
    >
      <path d={area} fill={color} fillOpacity="0.12" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MultiLineChart({ lines }: { lines: MultiLines["lines"] }) {
  const all = lines.flatMap((l) => l.points);
  if (all.length < 2) return null;
  const t0 = Math.min(...all.map((p) => p.t));
  const t1 = Math.max(...all.map((p) => p.t));
  // Log scale so a 3× move and a ⅓ move read the same distance from 100.
  const lv = all.map((p) => Math.log(Math.max(p.v, 1e-6)));
  const min = Math.min(...lv);
  const max = Math.max(...lv);
  const span = max - min || 1;
  const w = 320;
  const h = 118;
  const padY = 6;
  const xOf = (t: number) => ((t - t0) / Math.max(t1 - t0, 1)) * w;
  const yOf = (v: number) => padY + (1 - (Math.log(Math.max(v, 1e-6)) - min) / span) * (h - padY * 2);
  const base = yOf(100);
  return (
    <div aria-hidden>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-[118px] w-full">
        <line
          x1={0}
          x2={w}
          y1={base}
          y2={base}
          stroke="#3a4558"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
        {lines.map((l) => (
          <path
            key={l.id}
            d={l.points
              .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)},${yOf(p.v).toFixed(1)}`)
              .join(" ")}
            fill="none"
            stroke={l.color}
            strokeWidth={l.id === "gold" ? 2.25 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            opacity={l.id === "gold" ? 1 : 0.9}
          />
        ))}
      </svg>
      <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
        {lines.map((l) => (
          <span key={l.id} className="inline-flex items-center gap-1 text-[10px] text-muted">
            <span className="h-[2px] w-2.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniRow({ row }: { row: MiniHeat["rows"][number] }) {
  return (
    <>
      <span className="self-center font-mono text-[10px] text-foreground/75">{row.year}</span>
      {row.cells.map((c, i) => (
        <span
          key={i}
          title={c.title}
          className="h-5 rounded-[3px] sm:h-6"
          style={{
            background: c.bg,
            outline: c.current ? "1.5px dashed rgba(232,238,247,0.9)" : undefined,
            outlineOffset: c.current ? "-1.5px" : undefined,
          }}
        />
      ))}
    </>
  );
}

function MiniBarsChart({ bars }: { bars: MiniBars["bars"] }) {
  if (!bars.length) return null;
  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.v)), 1);
  return (
    <div className="flex h-[140px] flex-col" aria-hidden>
      <div className="relative flex min-h-0 flex-1 items-stretch gap-px">
        <span
          className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-border/80"
          aria-hidden
        />
        {bars.map((b) => {
          const pct = Math.max(3, (Math.abs(b.v) / maxAbs) * 50);
          const positive = b.v >= 0;
          return (
            <div
              key={b.key}
              title={b.title}
              className="relative flex min-w-0 flex-1 flex-col"
            >
              <div className="flex h-1/2 items-end justify-center px-px">
                {positive ? (
                  <span
                    className="w-full rounded-t-[2px]"
                    style={{ height: `${pct * 2}%`, background: flowColor(b.v) }}
                  />
                ) : null}
              </div>
              <div className="flex h-1/2 items-start justify-center px-px">
                {!positive ? (
                  <span
                    className="w-full rounded-b-[2px]"
                    style={{ height: `${pct * 2}%`, background: flowColor(b.v) }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-px">
        {bars.map((b) => (
          <span
            key={`l-${b.key}`}
            className="min-w-0 flex-1 truncate text-center text-[8px] uppercase text-muted"
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartTile({
  def,
  live,
}: {
  def: TileDef;
  live: TileLive | undefined;
}) {
  const status = live?.status ?? "loading";
  const headline =
    status === "loading"
      ? "…"
      : status === "error" || !live
        ? "—"
        : live.headline;
  const secondary =
    status === "loading"
      ? "Loading…"
      : status === "error" || !live
        ? "Unavailable"
        : live.secondary;

  return (
    <Link
      href={def.href}
      className="group relative flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition duration-200 hover:border-accent hover:bg-accent/5 hover:shadow-md hover:shadow-accent/20 sm:min-h-[300px] sm:p-5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-accent/70 transition group-hover:bg-accent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/0 via-transparent to-accent/0 opacity-0 transition duration-200 group-hover:from-accent/10 group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground group-hover:text-accent sm:text-lg">
          {def.title}
          {def.subtitle ? (
            <span className="mt-0.5 block text-xs font-normal text-muted">
              {def.subtitle}
            </span>
          ) : null}
        </h3>
        {status === "ok" && live?.isLive !== false ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
              aria-hidden
            />
            Live
          </span>
        ) : null}
      </div>
      <p
        className="relative mt-1.5 font-mono text-[1.75rem] font-bold leading-none tracking-tight text-foreground sm:text-3xl"
        style={
          live?.headlineColor && status === "ok"
            ? { color: live.headlineColor }
            : undefined
        }
      >
        {headline}
      </p>
      {live?.chip && status === "ok" ? (
        <span
          className="relative mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
          style={{
            color: live.chip.color,
            borderColor: `${live.chip.color}66`,
            background: `${live.chip.color}1a`,
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: live.chip.color }}
            aria-hidden
          />
          {live.chip.label}
        </span>
      ) : null}
      {live?.chip && live.chipSubtitle && status === "ok" ? (
        <p className="relative mt-1 text-xs text-muted">{live.chipSubtitle}</p>
      ) : null}
      {live?.chip && status === "ok" ? null : (
        <p
          className="relative mt-1 text-xs text-muted sm:text-sm"
          style={
            live?.secondaryColor && status === "ok"
              ? { color: live.secondaryColor }
              : undefined
          }
        >
          {secondary}
        </p>
      )}
      {live?.multi && status === "ok" ? (
        <div className="relative mt-3 flex-1">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {live.multi.caption}
          </p>
          <MultiLineChart lines={live.multi.lines} />
        </div>
      ) : live?.miniBars && status === "ok" ? (
        <div className="relative mt-3 flex-1">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {live.miniBars.caption}
          </p>
          <MiniBarsChart bars={live.miniBars.bars} />
        </div>
      ) : live?.mini && status === "ok" ? (
        <div className="relative mt-3 flex-1">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {live.mini.caption}
          </p>
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `2.25rem repeat(${live.mini.cols.length}, minmax(0, 1fr))` }}
          >
            <span aria-hidden />
            {live.mini.cols.map((c) => (
              <span key={c} className="text-center text-[9px] uppercase text-muted">
                {c.slice(0, 1)}
              </span>
            ))}
            {live.mini.rows.map((row) => (
              <MiniRow key={row.year} row={row} />
            ))}
          </div>
        </div>
      ) : live?.spark && live.spark.length >= 2 && status === "ok" ? (
        <div className="relative mt-3 flex-1">
          <Sparkline
            points={live.spark}
            color={live.sparkColor ?? live.headlineColor ?? "#3b82c4"}
          />
          {live.tooltip ? (
            <span
              role="tooltip"
              className="pointer-events-none absolute inset-x-2 bottom-2 hidden rounded-md border border-border/80 bg-black/90 px-2.5 py-1.5 font-mono text-[11px] text-[#e8eef7] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 md:block"
            >
              {live.tooltip}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="relative mt-3 flex-1" aria-hidden />
      )}
      <span className="relative mt-auto inline-flex pt-3 text-xs font-medium text-accent group-hover:underline sm:text-sm">
        Open chart →
      </span>
    </Link>
  );
}

export function ChartsHub() {
  const [lives, setLives] = useState<Record<string, TileLive>>(() => {
    const init: Record<string, TileLive> = {};
    for (const t of ALL_TILES) {
      init[t.id] = {
        status: "loading",
        headline: "…",
        secondary: "Loading…",
      };
    }
    return init;
  });

  useEffect(() => {
    let cancelled = false;

    async function loadTile(def: TileDef) {
      const ac = new AbortController();
      // Wilshire/M2 and other cold feeds must not leave the tile on Loading forever.
      const ms = def.id === "wilshire-m2" ? 20_000 : 35_000;
      const timer = setTimeout(() => ac.abort(), ms);
      try {
        const res = await fetch(def.endpoint, { cache: "no-store", signal: ac.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: unknown = await res.json();
        const parsed = def.parse(json);
        if (cancelled) return;
        if (!parsed) {
          setLives((prev) => ({
            ...prev,
            [def.id]: {
              status: "error",
              headline: "—",
              secondary: "Unavailable",
            },
          }));
          return;
        }
        setLives((prev) => ({
          ...prev,
          [def.id]: { status: "ok", ...parsed },
        }));
      } catch {
        if (cancelled) return;
        setLives((prev) => ({
          ...prev,
          [def.id]: {
            status: "error",
            headline: "—",
            secondary: "Unavailable",
          },
        }));
      } finally {
        clearTimeout(timer);
      }
    }

    void Promise.all(ALL_TILES.map((t) => loadTile(t)));

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-8 space-y-10">
      {CATEGORIES.map((cat) => (
        <section key={cat.id} aria-labelledby={`charts-cat-${cat.id}`}>
          <h2
            id={`charts-cat-${cat.id}`}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/80"
          >
            {cat.label}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {cat.tiles.map((tile) => (
              <ChartTile key={tile.id} def={tile} live={lives[tile.id]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
