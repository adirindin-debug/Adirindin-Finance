"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TileStatus = "loading" | "ok" | "error";

type SparkPoint = { t: number; v: number };

type TileLive = {
  status: TileStatus;
  headline: string;
  headlineColor?: string;
  secondary: string;
  secondaryColor?: string;
  spark?: SparkPoint[];
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
  max = 48,
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
  const w = 120;
  const h = 28;
  const padY = 2;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = padY + (1 - (p.v - min) / span) * (h - padY * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="mt-3 opacity-80"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition hover:border-accent/50 sm:p-5"
    >
      <h3 className="text-sm font-medium text-muted group-hover:text-accent">
        {def.title}
      </h3>
      <p
        className="mt-3 font-mono text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
        style={
          live?.headlineColor && status === "ok"
            ? { color: live.headlineColor }
            : undefined
        }
      >
        {headline}
      </p>
      <p
        className="mt-1 text-xs text-muted"
        style={
          live?.secondaryColor && status === "ok"
            ? { color: live.secondaryColor }
            : undefined
        }
      >
        {secondary}
      </p>
      {live?.spark && live.spark.length >= 2 && status === "ok" ? (
        <Sparkline
          points={live.spark}
          color={live.headlineColor ?? "#3b82c4"}
        />
      ) : null}
      <span className="mt-auto pt-4 inline-flex text-sm font-medium text-accent">
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
    <div className="mt-8 space-y-8">
      {CATEGORIES.map((cat) => (
        <section key={cat.id} aria-labelledby={`charts-cat-${cat.id}`}>
          <h2
            id={`charts-cat-${cat.id}`}
            className="text-xs font-semibold uppercase tracking-[0.16em] text-muted"
          >
            {cat.label}
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cat.tiles.map((tile) => (
              <ChartTile key={tile.id} def={tile} live={lives[tile.id]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
