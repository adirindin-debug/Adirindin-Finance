"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveNow } from "@/lib/useLiveNow";
import { fetchBtcTipAnchor, type BtcTipAnchor } from "@/lib/cycles/btcHalvingEstimate";
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
  live: (
    nowMs: number,
    halvingAnchor?: BtcTipAnchor,
  ) => { pt: { x: number; y: number }; phaseLine: string };
};

const TILES: CycleTile[] = [
  {
    id: "btc",
    href: "/dashboard/btc-cycle",
    title: "Bitcoin",
    blurb: "4-year cycle theory",
    path: BTC_SILHOUETTE.path,
    viewBox: BTC_SILHOUETTE.viewBox,
    color: BTC_SILHOUETTE.color,
    live: btcLiveSilhouette,
  },
  {
    id: "re",
    href: "/tools/real-estate-cycle",
    title: "Real estate",
    blurb: "18.6-year real estate cycle theory",
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
    title: "Gold",
    blurb: "~46y gold-led commodity cycle · observational study",
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
  className = "h-[180px] w-full overflow-visible sm:h-[220px] lg:h-[240px]",
}: {
  path: string;
  viewBox: string;
  color: string;
  marker: { x: number; y: number } | null;
  className?: string;
}) {
  /* Soft fill under the theory curve — same visual language as Charts hub sparklines. */
  const [, , , vbH] = viewBox.split(" ").map(Number);
  const bottom = (vbH ?? 300) + 40;
  const fillD = `${path} L 760 ${bottom} L 88 ${bottom} Z`;
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={className}
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
        <g data-live-dot="" transform={`translate(${marker.x} ${marker.y})`}>
          {/*
            Live marker: cream fill + dark rim so it stays high-contrast on every
            tile stroke (RE green, BTC blue, Bond gold, Gold amber) — never match
            the line. A cream ring expands + fades on a 2s loop (same idea as the
            gold detail chart’s Live ring). Under prefers-reduced-motion the ring
            is a static halo instead. Drawn around (0,0) so the CSS scale-up on
            narrow screens stays centred — see .cycle-live-* in globals.css.
          */}
          <g className="cycle-live-marker">
            <circle
              className="cycle-live-ring"
              r="20"
              fill="none"
              stroke="#f5f0e6"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle r="30" fill="#f5f0e6" fillOpacity="0.14" />
            <circle
              r="20"
              fill="#f5f0e6"
              stroke="#0a0a0a"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
            <circle r="6" fill="#1a1a1a" />
          </g>
        </g>
      ) : null}
    </svg>
  );
}

/**
 * Tile status text: "\n" starts a new line; " · " separates parts that never
 * break internally, so narrow tiles wrap only between parts.
 */
function PhaseText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const parts = line.split(" · ");
        return (
          <span key={i} className="block">
            {parts.map((part, j) => (
              <span key={j}>
                <span className="whitespace-nowrap">
                  {part}
                  {j < parts.length - 1 ? " ·" : ""}
                </span>
                {j < parts.length - 1 ? " " : ""}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

function CycleTileCard({
  tile,
  halvingAnchor,
}: {
  tile: CycleTile;
  halvingAnchor?: BtcTipAnchor;
}) {
  const nowMs = useLiveNow();
  const live = nowMs === null ? null : tile.live(nowMs, halvingAnchor);
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
      <p className="relative mt-3 text-sm font-medium text-foreground/90 sm:text-base lg:min-h-[3rem]">
        <PhaseText text={phase} />
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

/** Live chain tip for the BTC halving estimate; cached snapshot until (or if) it loads. */
function useHalvingAnchor() {
  const [halvingAnchor, setHalvingAnchor] = useState<BtcTipAnchor | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetchBtcTipAnchor().then((a) => {
      if (!cancelled && a) setHalvingAnchor(a);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return halvingAnchor;
}

/** Homepage order: Bitcoin, gold, bonds, real estate. */
const STRIP_ORDER = ["btc", "gold", "bond", "re"];

function CycleStripCard({ tile, halvingAnchor }: { tile: CycleTile; halvingAnchor?: BtcTipAnchor }) {
  const nowMs = useLiveNow();
  const live = nowMs === null ? null : tile.live(nowMs, halvingAnchor);
  const [phase, detail] = nowMs === null ? ["Locating Live…", ""] : (live?.phaseLine ?? "—").split("\n");
  return (
    <Link
      href={tile.href}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition hover:border-accent hover:bg-accent/5"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground group-hover:text-accent">{tile.title}</h3>
        <span className="inline-flex shrink-0 items-center rounded-full border border-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Theory
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{tile.blurb}</p>
      <div className="mt-2">
        <CycleSilhouette
          path={tile.path}
          viewBox={tile.viewBox}
          color={tile.color}
          marker={live?.pt ?? null}
          className="h-[72px] w-full overflow-visible"
        />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground/90">
        <PhaseText text={phase ?? "—"} />
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-muted">
          <PhaseText text={detail} />
        </p>
      ) : null}
    </Link>
  );
}

/** Compact "where are we in the cycle" strip — same silhouettes and Live logic as the hub tiles. */
export function CycleStrip() {
  const halvingAnchor = useHalvingAnchor();
  const tiles = STRIP_ORDER.map((id) => TILES.find((t) => t.id === id)!);
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <CycleStripCard
          key={tile.id}
          tile={tile}
          halvingAnchor={tile.id === "btc" ? halvingAnchor : undefined}
        />
      ))}
    </div>
  );
}

export function CyclesHub() {
  const halvingAnchor = useHalvingAnchor();

  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
      {TILES.map((tile) => (
        <CycleTileCard
          key={tile.id}
          tile={tile}
          halvingAnchor={tile.id === "btc" ? halvingAnchor : undefined}
        />
      ))}
    </div>
  );
}
