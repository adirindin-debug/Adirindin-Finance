"use client";

import { useEffect, useMemo, useState } from "react";

type Point = { t: number; ratio: number; wilshire: number; m2: number };
type Payload = {
  ok: boolean;
  current?: { ratio: number; wilshire: number; m2: number; t: number };
  points?: Point[];
  wilshireSource?: string;
  m2Source?: string;
  ratioDefinition?: string;
  fredCredits?: string;
  macroMicroUrl?: string;
  note?: string;
  error?: string;
};

const W = 720;
const H = 240;
const PAD = { top: 20, right: 16, bottom: 32, left: 48 };

function fmtDate(t: number) {
  return new Date(t * 1000).toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
  });
}

export function WilshireM2Panel() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wilshire-m2");
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
      vmin = Math.min(vmin, p.ratio);
      vmax = Math.max(vmax, p.ratio);
    }
    const pad = (vmax - vmin) * 0.08 || 0.1;
    vmin -= pad;
    vmax += pad;
    const xOf = (t: number) =>
      PAD.left + ((t - t0) / Math.max(t1 - t0, 1)) * (W - PAD.left - PAD.right);
    const yOf = (v: number) =>
      PAD.top + ((vmax - v) / Math.max(vmax - vmin, 1)) * (H - PAD.top - PAD.bottom);
    const path = points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"}${xOf(p.t).toFixed(1)} ${yOf(p.ratio).toFixed(1)}`,
      )
      .join(" ");
    const ticks = [vmin, (vmin + vmax) / 2, vmax];
    return { path, yOf, t0, t1, ticks };
  }, [data]);

  const current = data?.current;

  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Wilshire 5000 / US M2
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Equity market vs money supply ratio from public FRED data (monthly).
            Educational framing only (NFA).
          </p>
        </div>
        {current && (
          <div className="text-right">
            <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">
              {current.ratio.toFixed(2)}
            </p>
            <p className="mt-0.5 text-xs text-muted">Wilshire ÷ M2SL</p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              {fmtDate(current.t)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 overflow-x-auto">
        {loading && (
          <p className="py-16 text-center text-sm text-muted">Loading Wilshire / M2…</p>
        )}
        {!loading && data && !data.ok && (
          <p className="py-12 text-center text-sm text-red-400">
            {data.error ?? "Could not load Wilshire/M2"}
          </p>
        )}
        {!loading && chart && (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[320px]" role="img">
            <title>Wilshire 5000 to US M2 ratio</title>
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
                  {v.toFixed(2)}
                </text>
              </g>
            ))}
            <path d={chart.path} fill="none" stroke="#e8873a" strokeWidth={2} />
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
        {data?.ratioDefinition && <p>{data.ratioDefinition}</p>}
        {data?.wilshireSource && <p>Wilshire: {data.wilshireSource}</p>}
        {data?.m2Source && <p>M2: {data.m2Source}</p>}
        <p>
          {data?.fredCredits ?? "Data via FRED®, Federal Reserve Bank of St. Louis."}{" "}
          Concept similar to{" "}
          <a
            href={
              data?.macroMicroUrl ??
              "https://en.macromicro.me/collections/34/us-stock-relative/24033/wilshire5000-to-us-m2"
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            MacroMicro Wilshire/M2
          </a>{" "}
          (attribution only — we do not scrape their page).
        </p>
        <p>{data?.note ?? "Educational only — NFA."}</p>
      </div>
    </section>
  );
}
