"use client";

import { useEffect, useRef, useState } from "react";

const CB = "https://api.exchange.coinbase.com";
const PLOTLY_CDN = "https://cdn.plot.ly/plotly-2.35.2.min.js";

type Point = { t: number; c: number };

declare global {
  interface Window {
    Plotly?: {
      newPlot: (
        el: HTMLElement,
        data: unknown[],
        layout: Record<string, unknown>,
        config?: Record<string, unknown>,
      ) => Promise<unknown>;
      purge?: (el: HTMLElement) => void;
    };
  }
}

let plotlyLoading: Promise<void> | null = null;

function loadPlotly(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Plotly) return Promise.resolve();
  if (plotlyLoading) return plotlyLoading;
  plotlyLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLOTLY_CDN}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Plotly script failed")));
      if (window.Plotly) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = PLOTLY_CDN;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Plotly CDN blocked"));
    document.head.appendChild(s);
  });
  return plotlyLoading;
}

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
  // de-dupe by timestamp
  const seen = new Set<number>();
  return out.filter((p) => {
    if (seen.has(p.t)) return false;
    seen.add(p.t);
    return true;
  });
}

export function BtcFourYearChart() {
  const elRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = elRef.current;
    if (!el) return;

    (async () => {
      try {
        setStatus("loading");
        const [, points] = await Promise.all([loadPlotly(), fetchDailyCloses(365 * 4 + 30)]);
        if (cancelled) return;
        if (!window.Plotly) throw new Error("Plotly unavailable");
        if (!points.length) throw new Error("No candle data");

        const x = points.map((p) => new Date(p.t * 1000).toISOString().slice(0, 10));
        const y = points.map((p) => p.c);

        await window.Plotly.newPlot(
          el,
          [
            {
              x,
              y,
              type: "scatter",
              mode: "lines",
              line: { color: "#4c9fff", width: 1.6 },
              hovertemplate: "%{x}<br>$%{y:,.0f}<extra></extra>",
            },
          ],
          {
            title: {
              text: "BTC 4-year view",
              font: { color: "#e8eef7", size: 16, family: "system-ui, sans-serif" },
              x: 0,
              xanchor: "left",
            },
            paper_bgcolor: "#000000",
            plot_bgcolor: "#000000",
            margin: { l: 56, r: 20, t: 48, b: 40 },
            font: { color: "#8b9bb4", family: "system-ui, sans-serif", size: 11 },
            xaxis: {
              gridcolor: "#1a1a1a",
              zeroline: false,
              showline: false,
            },
            yaxis: {
              gridcolor: "#1a1a1a",
              zeroline: false,
              tickprefix: "$",
              separatethousands: true,
            },
            showlegend: false,
          },
          { responsive: true, displayModeBar: false },
        );
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Chart unavailable");
      }
    })();

    return () => {
      cancelled = true;
      if (el && window.Plotly?.purge) {
        try {
          window.Plotly.purge(el);
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return (
    <section className="mt-12" aria-label="BTC 4-year running chart">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          4-year running chart
        </h2>
        <p className="text-xs text-muted">Educational overview · not financial advice (NFA)</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        {status === "error" ? (
          <div className="flex min-h-[320px] items-center justify-center px-4 py-10 text-center">
            <p className="max-w-md text-sm text-muted">
              Could not load the 4-year BTC chart ({error}). Live feed may be blocked — try again later, or open the{" "}
              <a href="/dashboard/btc-cycle" className="text-accent hover:underline">
                detailed cycle map
              </a>
              .
            </p>
          </div>
        ) : (
          <div ref={elRef} className="w-full" style={{ height: 380, background: "#000" }} />
        )}
        {status === "loading" && (
          <p className="border-t border-border/40 px-4 py-2 text-xs text-muted">Loading Coinbase daily history…</p>
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
