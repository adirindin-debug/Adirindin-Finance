"use client";

import { useEffect, useMemo, useState } from "react";

const CB = "https://api.exchange.coinbase.com";

type Point = { t: number; c: number };

async function fetchJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Coinbase candles: [time, low, high, open, close, volume]; max ~300 per call. */
async function fetchDailyCloses(daysBack: number): Promise<Point[]> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - daysBack * 86400;
  const chunk = 280;
  const out: Point[] = [];
  for (let s = start; s < end; s += chunk * 86400) {
    const e = Math.min(s + chunk * 86400, end);
    const url = `${CB}/products/BTC-USD/candles?granularity=86400&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    const rows: number[][] = await fetchJson(url);
    for (const row of rows) {
      out.push({ t: row[0], c: row[4] });
    }
  }
  out.sort((a, b) => a.t - b.t);
  const seen = new Set<number>();
  return out.filter((p) => {
    if (seen.has(p.t)) return false;
    seen.add(p.t);
    return true;
  });
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

const W = 920;
const H = 380;
const PAD = { top: 28, right: 24, bottom: 40, left: 64 };

function buildPath(points: Point[]): { d: string; minC: number; maxC: number; minT: number; maxT: number } {
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  let minC = points[0].c;
  let maxC = points[0].c;
  for (const p of points) {
    if (p.c < minC) minC = p.c;
    if (p.c > maxC) maxC = p.c;
  }
  const padY = (maxC - minC) * 0.06 || maxC * 0.02;
  const y0 = minC - padY;
  const y1 = maxC + padY;
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const xScale = (t: number) => PAD.left + ((t - minT) / (maxT - minT || 1)) * iw;
  const yScale = (c: number) => PAD.top + (1 - (c - y0) / (y1 - y0 || 1)) * ih;

  let d = "";
  points.forEach((p, i) => {
    const x = xScale(p.t);
    const y = yScale(p.c);
    d += i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return { d, minC: y0, maxC: y1, minT, maxT };
}

export function BtcFourYearChart() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        setError(null);
        const data = await fetchDailyCloses(365 * 4 + 30);
        if (cancelled) return;
        if (!data.length) throw new Error("No candle data");
        setPoints(data);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Chart unavailable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chart = useMemo(() => (points.length ? buildPath(points) : null), [points]);

  const yTicks = useMemo(() => {
    if (!chart) return [];
    const n = 4;
    const ticks: number[] = [];
    for (let i = 0; i <= n; i++) {
      ticks.push(chart.minC + ((chart.maxC - chart.minC) * i) / n);
    }
    return ticks;
  }, [chart]);

  const xTicks = useMemo(() => {
    if (!chart || !points.length) return [];
    const idxs = [0, Math.floor(points.length / 3), Math.floor((2 * points.length) / 3), points.length - 1];
    return idxs.map((i) => points[i]);
  }, [chart, points]);

  return (
    <section className="mt-12" aria-label="BTC 4-year running chart">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          4-year running chart
        </h2>
        <p className="text-xs text-muted">Educational overview · not financial advice (NFA)</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {status === "loading" && (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-muted">Loading Coinbase daily history…</p>
            <p className="text-xs text-muted/70">Fetching ~4 years of BTC-USD closes</p>
          </div>
        )}
        {status === "error" && (
          <div className="flex min-h-[320px] items-center justify-center px-4 py-10 text-center">
            <p className="max-w-md text-sm text-muted">
              Could not load the 4-year BTC chart ({error}). Live feed may be blocked — try again later, or open the{" "}
              <a href="/dashboard/btc-cycle" className="text-accent hover:underline">
                detailed cycle map
              </a>
              .
            </p>
          </div>
        )}
        {status === "ready" && chart && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block w-full"
            role="img"
            aria-label="BTC-USD daily close over approximately four years"
            style={{ background: "#000", height: 380 }}
          >
            <title>BTC 4-year view</title>
            <text x={PAD.left} y={18} fill="#e8eef7" fontSize="14" fontFamily="system-ui, sans-serif" fontWeight="600">
              BTC 4-year view
            </text>
            {yTicks.map((v) => {
              const ih = H - PAD.top - PAD.bottom;
              const y =
                PAD.top + (1 - (v - chart.minC) / (chart.maxC - chart.minC || 1)) * ih;
              return (
                <g key={v}>
                  <line
                    x1={PAD.left}
                    x2={W - PAD.right}
                    y1={y}
                    y2={y}
                    stroke="#1a1a1a"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD.left - 8}
                    y={y + 3}
                    fill="#8b9bb4"
                    fontSize="10"
                    fontFamily="system-ui, sans-serif"
                    textAnchor="end"
                  >
                    {fmtUsd(v)}
                  </text>
                </g>
              );
            })}
            {xTicks.map((p) => {
              const iw = W - PAD.left - PAD.right;
              const x =
                PAD.left +
                ((p.t - chart.minT) / (chart.maxT - chart.minT || 1)) * iw;
              return (
                <text
                  key={p.t}
                  x={x}
                  y={H - 14}
                  fill="#8b9bb4"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {fmtDate(p.t)}
                </text>
              );
            })}
            <path d={chart.d} fill="none" stroke="#4c9fff" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            {points.length > 0 && (
              <text
                x={W - PAD.right}
                y={18}
                fill="#8b9bb4"
                fontSize="11"
                fontFamily="system-ui, sans-serif"
                textAnchor="end"
              >
                Last {fmtUsd(points[points.length - 1].c)}
              </text>
            )}
          </svg>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Simple ~4-year BTC-USD daily close from Coinbase. For the full BTC+MSTR cycle desk, open{" "}
        <a href="/dashboard" className="text-accent hover:underline">
          Cycle desk
        </a>
        . Educational only — not investment advice.
      </p>
    </section>
  );
}
