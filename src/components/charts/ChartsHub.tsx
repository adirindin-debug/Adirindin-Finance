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
};

type MiniHeat = {
  caption: string;
  cols: string[];
  rows: Array<{
    year: number;
    cells: Array<{ bg: string; title: string; current: boolean }>;
  }>;
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

/** Global equities · sentiment state — URTH (MSCI World proxy) drawdown phase + VIX tilt. */
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
    id: "crypto-markets",
    label: "Crypto markets",
    tiles: [
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
  {
    id: "macro",
    label: "Macro",
    tiles: [
      {
        id: "wilshire-m2",
        href: "/charts/wilshire-m2",
        title: "Wilshire 5000 / US M2",
        endpoint: "/api/wilshire-m2",
        parse: parseWilshireM2,
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
        id: "global-equities",
        href: "/charts/global-equities",
        title: "Global equities · sentiment state",
        subtitle: "MSCI World proxy (URTH) · daily · VIX tilt",
        endpoint: "/api/global-equities",
        parse: parseGlobalEquities,
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
      {live?.mini && status === "ok" ? (
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
      try {
        const res = await fetch(def.endpoint, { cache: "no-store" });
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
