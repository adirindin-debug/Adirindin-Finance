"use client";

import Link from "next/link";
import { useLiveNow } from "@/lib/useLiveNow";
import {
  BTC_SILHOUETTE,
  btcLiveSilhouette,
} from "@/lib/cycles/btcSilhouette";
import {
  BOND_SILHOUETTE,
  bondLiveSilhouette,
} from "@/lib/cycles/bondSilhouette";
import {
  RE_SILHOUETTE,
  reLiveSilhouette,
} from "@/lib/cycles/reSilhouette";
import {
  GOLD_SILHOUETTE,
  goldLiveSilhouette,
} from "@/lib/cycles/goldSilhouette";

type CycleTile = {
  id: string;
  href: string;
  title: string;
  blurb: string;
  path: string;
  viewBox: string;
  color: string;
  live: (nowMs: number) => { pt: { x: number; y: number }; phaseLine: string };
};

const TILES: CycleTile[] = [
  {
    id: "btc",
    href: "/dashboard/btc-cycle",
    title: "Bitcoin",
    blurb: "4-year cycle theory · Nike-tick silhouette",
    path: BTC_SILHOUETTE.path,
    viewBox: BTC_SILHOUETTE.viewBox,
    color: BTC_SILHOUETTE.color,
    live: btcLiveSilhouette,
  },
  {
    id: "re",
    href: "/tools/real-estate-cycle",
    title: "Real estate",
    blurb: "Anderson ~18-year cycle theory",
    path: RE_SILHOUETTE.path,
    viewBox: RE_SILHOUETTE.viewBox,
    color: RE_SILHOUETTE.color,
    live: reLiveSilhouette,
  },
  {
    id: "bond",
    href: "/tools/bond-cycle",
    title: "Bond yields",
    blurb: "US 10y secular regime sketch · ~40y halves",
    path: BOND_SILHOUETTE.path,
    viewBox: BOND_SILHOUETTE.viewBox,
    color: BOND_SILHOUETTE.color,
    live: bondLiveSilhouette,
  },
  {
    id: "gold",
    href: "/tools/gold-cycle",
    title: "Gold · commodities",
    blurb: "Anthony ~46y gold-led sketch · observational",
    path: GOLD_SILHOUETTE.path,
    viewBox: GOLD_SILHOUETTE.viewBox,
    color: GOLD_SILHOUETTE.color,
    live: goldLiveSilhouette,
  },
];

function CycleSilhouette({
  path,
  viewBox,
  color,
  marker,
}: {
  path: string;
  viewBox: string;
  color: string;
  marker: { x: number; y: number } | null;
}) {
  /* Soft fill under the theory curve — same visual language as Charts hub sparklines. */
  const [, , , vbH] = viewBox.split(" ").map(Number);
  const bottom = (vbH ?? 300) + 40;
  const fillD = `${path} L 760 ${bottom} L 88 ${bottom} Z`;
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="h-[180px] w-full sm:h-[220px] lg:h-[240px]"
      aria-hidden
    >
      <path d={fillD} fill={color} fillOpacity="0.10" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {marker ? (
        <g>
          {/*
            Live marker: cream fill + dark rim so it stays high-contrast on every
            tile stroke (RE green, BTC blue, Bond gold) — never match the line.
          */}
          <circle
            cx={marker.x}
            cy={marker.y}
            r="10"
            fill="#0a0a0a"
            fillOpacity="0.45"
          />
          <circle
            cx={marker.x}
            cy={marker.y}
            r="5.75"
            fill="#f5f0e6"
            stroke="#1a1a1a"
            strokeWidth="2"
          />
          <circle
            cx={marker.x}
            cy={marker.y}
            r="2"
            fill="#1a1a1a"
          />
        </g>
      ) : null}
    </svg>
  );
}

function CycleTileCard({ tile }: { tile: CycleTile }) {
  const nowMs = useLiveNow();
  const live = nowMs === null ? null : tile.live(nowMs);
  const phase =
    nowMs === null ? "Locating Live…" : (live?.phaseLine ?? "—");

  return (
    <Link
      href={tile.href}
      className="group relative flex min-h-[340px] flex-col overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition duration-200 hover:border-accent hover:bg-accent/5 hover:shadow-md hover:shadow-accent/20 sm:min-h-[380px] sm:p-6"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-accent/70 transition group-hover:bg-accent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/0 via-transparent to-accent/0 opacity-0 transition duration-200 group-hover:from-accent/10 group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground group-hover:text-accent sm:text-2xl">
            {tile.title}
          </h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">{tile.blurb}</p>
        </div>
        {nowMs !== null ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
              aria-hidden
            />
            Live
          </span>
        ) : null}
      </div>
      <p className="relative mt-3 text-sm font-medium text-foreground/90 sm:text-base">
        {phase}
      </p>
      <div className="relative mt-4 flex-1">
        <CycleSilhouette
          path={tile.path}
          viewBox={tile.viewBox}
          color={tile.color}
          marker={live?.pt ?? null}
        />
      </div>
      <span className="relative mt-auto inline-flex pt-4 text-sm font-medium text-accent group-hover:underline">
        Open cycle →
      </span>
    </Link>
  );
}

export function CyclesHub() {
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
      {TILES.map((tile) => (
        <CycleTileCard key={tile.id} tile={tile} />
      ))}
    </div>
  );
}
