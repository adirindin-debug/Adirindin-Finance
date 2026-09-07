"use client";

import { useEffect, useMemo, useState } from "react";

type Point = { t: number; value: number; classification: string };
type Payload = {
  ok: boolean;
  current?: { value: number; classification: string; color: string; t: number };
  points?: Point[];
  source?: string;
  sourceUrl?: string;
  error?: string;
  note?: string;
};

const W = 720;
const H = 220;
const PAD = { top: 20, right: 16, bottom: 32, left: 40 };

function fmtDate(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
  });
}

export function FearGreedPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/fear-greed");
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
    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
    const yOf = (v: number) =>
      PAD.top + ((100 - v) / 100) * (H - PAD.top - PAD.bottom);
    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.value).toFixed(1)}`)
      .join(" ");
    const zones = [
      { y0: 75, y1: 100, fill: "rgba(34,197,94,0.12)" },
      { y0: 50, y1: 75, fill: "rgba(132,204,22,0.10)" },
      { y0: 25, y1: 50, fill: "rgba(249,115,22,0.10)" },
      { y0: 0, y1: 25, fill: "rgba(239,68,68,0.12)" },
    ];
    return { path, xOf, yOf, t0, t1, zones, points };
  }, [data]);

  const current = data?.current;

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Crypto Fear &amp; Greed Index
          </h2>
          <p className="mt-1 text-sm text-muted">
            Sentiment gauge from Alternative.me — educational only (NFA).
          </p>
        </div>
        {current && (
          <div className="text-right">
            <p
              className="font-mono text-4xl font-semibold tabular-nums"
              style={{ color: current.color }}
            >
              {current.value}
            </p>
            <p className="mt-0.5 text-sm font-medium" style={{ color: current.color }}>
              {current.classification}
            </p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {fmtDate(current.t)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading && (
          <p className="py-16 text-center text-sm text-muted">Loading Fear &amp; Greed…</p>
        )}
        {!loading && data && !data.ok && (
          <p className="py-12 text-center text-sm text-red-400">
            {data.error ?? "Could not load Fear & Greed"}
          </p>
        )}
        {!loading && chart && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]" role="img">
            <title>Crypto Fear and Greed Index history</title>
            {chart.zones.map((z) => (
              <rect
                key={z.y0}
                x={PAD.left}
                y={chart.yOf(z.y1)}
                width={W - PAD.left - PAD.right}
                height={chart.yOf(z.y0) - chart.yOf(z.y1)}
                fill={z.fill}
              />
            ))}
            {[0, 25, 50, 75, 100].map((v) => (
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
                  {v}
                </text>
              </g>
            ))}
            <path d={chart.path} fill="none" stroke="#3b82c4" strokeWidth={2} />
            <text x={PAD.left} y={H - 8} className="fill-muted" fontSize={10}>
              {fmtDate(chart.t0)}
            </text>
            <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted" fontSize={10}>
              {fmtDate(chart.t1)}
            </text>
          </svg>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Source:{" "}
        <a
          href={data?.sourceUrl ?? "https://alternative.me/crypto/fear-and-greed-index/"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          {data?.source ?? "Alternative.me Crypto Fear & Greed Index"}
        </a>
        . {data?.note ?? "Educational only — NFA."}
      </p>
    </section>
  );
}
