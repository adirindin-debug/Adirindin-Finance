"use client";

import { useEffect, useMemo, useState } from "react";

type Point = { t: number; volumeUsd: number };
type Payload = {
  ok: boolean;
  currency?: string;
  currentVolumeUsd?: number | null;
  currentMarketCapUsd?: number | null;
  currentSource?: string | null;
  points?: Point[];
  historySource?: string | null;
  historyIsProxy?: boolean;
  theBlockUrl?: string;
  disclaimer?: string;
  error?: string;
  errors?: string[];
};

const W = 720;
const H = 240;
const PAD = { top: 20, right: 16, bottom: 32, left: 56 };

function fmtUsdCompact(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtDate(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
  });
}

export function MarketVolumePanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/market-volume?days=365");
        const json = (await res.json()) as Payload;
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

  const chart = useMemo(() => {
    const points = data?.points ?? [];
    if (points.length < 2) return null;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    let vmin = Infinity;
    let vmax = -Infinity;
    for (const p of points) {
      vmin = Math.min(vmin, p.volumeUsd);
      vmax = Math.max(vmax, p.volumeUsd);
    }
    const pad = (vmax - vmin) * 0.08 || vmax * 0.05;
    vmin = Math.max(0, vmin - pad);
    vmax = vmax + pad;
    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
    const yOf = (v: number) =>
      PAD.top + ((vmax - v) / Math.max(vmax - vmin, 1)) * (H - PAD.top - PAD.bottom);
    const path = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.volumeUsd).toFixed(1)}`,
      )
      .join(" ");
    const ticks = [vmin, (vmin + vmax) / 2, vmax];
    return { path, xOf, yOf, t0, t1, ticks };
  }, [data]);

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Total crypto market volume
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Public-feed total market volume (USD). Proxy when global history is
            unavailable — not The Block’s spot exchange desk.
          </p>
        </div>
        {data?.currentVolumeUsd != null && (
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {fmtUsdCompact(data.currentVolumeUsd)}
            </p>
            <p className="mt-0.5 text-xs text-muted">24h total volume · USD</p>
            {data.currentSource && (
              <p className="mt-1 max-w-[220px] text-right font-mono text-[10px] text-muted">
                {data.currentSource}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <a
          href={
            data?.theBlockUrl ??
            "https://www.theblock.co/data/crypto-markets/spot/total-exchange-volume-daily"
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-md border border-border bg-navy/60 px-3 py-2 text-sm text-accent hover:border-accent hover:bg-accent-soft"
        >
          Full spot exchange volume desk on The Block →
        </a>
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading && (
          <p className="py-16 text-center text-sm text-muted">Loading market volume…</p>
        )}
        {!loading && data && !data.ok && (
          <p className="py-12 text-center text-sm text-red-400">
            {data.error ?? "Could not load volume"}
          </p>
        )}
        {!loading && chart && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]" role="img">
            <title>Total crypto market volume USD</title>
            {chart.ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={chart.yOf(v)}
                  y2={chart.yOf(v)}
                  stroke="#243041"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={chart.yOf(v) + 3}
                  textAnchor="end"
                  className="fill-muted"
                  fontSize={10}
                >
                  {fmtUsdCompact(v)}
                </text>
              </g>
            ))}
            <path d={chart.path} fill="none" stroke="#3dcc9a" strokeWidth={2} />
            <text x={PAD.left} y={H - 8} className="fill-muted" fontSize={10}>
              {fmtDate(chart.t0)}
            </text>
            <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted" fontSize={10}>
              {fmtDate(chart.t1)}
            </text>
          </svg>
        )}
      </div>

      <div className="mt-4 space-y-1 text-xs text-muted">
        {data?.historySource && (
          <p>
            Chart series: {data.historySource}
            {data.historyIsProxy ? " (proxy)." : "."}
          </p>
        )}
        <p>
          {data?.disclaimer ??
            "Public total market volume feed / proxy — educational only (NFA)."}
        </p>
      </div>
    </section>
  );
}
