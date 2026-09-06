"use client";

import { useEffect, useState } from "react";

type StripState = {
  status: "loading" | "ready" | "error";
  btcPrice: number | null;
  drawdownPct: number | null;
  ath: number | null;
  daysSinceHalving: number | null;
  error?: string;
};

const LAST_HALVING = new Date("2024-04-19T00:00:00Z");
const CB = "https://api.exchange.coinbase.com";

async function fetchJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Coinbase candles: [time, low, high, open, close, volume]; max ~300 per call. */
async function fetchDailyCloses(daysBack: number): Promise<{ t: number; c: number }[]> {
  const end = Math.floor(Date.now() / 1000);
  const start = end - daysBack * 86400;
  const chunk = 280;
  const out: { t: number; c: number }[] = [];
  for (let s = start; s < end; s += chunk * 86400) {
    const e = Math.min(s + chunk * 86400, end);
    const url = `${CB}/products/BTC-USD/candles?granularity=86400&start=${new Date(s * 1000).toISOString()}&end=${new Date(e * 1000).toISOString()}`;
    const rows: number[][] = await fetchJson(url);
    for (const row of rows) {
      out.push({ t: row[0], c: row[4] });
    }
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function MarketStrip() {
  const [state, setState] = useState<StripState>({
    status: "loading",
    btcPrice: null,
    drawdownPct: null,
    ath: null,
    daysSinceHalving: daysBetween(LAST_HALVING, new Date()),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ticker, closes] = await Promise.all([
          fetchJson(`${CB}/products/BTC-USD/ticker`),
          fetchDailyCloses(400),
        ]);
        if (cancelled) return;
        const spot = Number(ticker.price);
        const lastClose = closes.length ? closes[closes.length - 1].c : NaN;
        const price = Number.isFinite(spot) ? spot : lastClose;
        const ath = closes.reduce((m, d) => Math.max(m, d.c), price);
        const dd = ath > 0 ? ((price - ath) / ath) * 100 : null;
        setState({
          status: "ready",
          btcPrice: Number.isFinite(price) ? price : null,
          drawdownPct: dd,
          ath: Number.isFinite(ath) ? ath : null,
          daysSinceHalving: daysBetween(LAST_HALVING, new Date()),
        });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          status: "error",
          error: e instanceof Error ? e.message : "Feed unavailable",
          daysSinceHalving: daysBetween(LAST_HALVING, new Date()),
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      label: "BTC-USD",
      value:
        state.status === "loading"
          ? "…"
          : state.btcPrice != null
            ? fmtUsd(state.btcPrice)
            : "—",
      hint: state.status === "ready" ? "Live Coinbase ticker" : state.status === "error" ? "Unavailable" : "Loading",
    },
    {
      label: "Drawdown from ATH",
      value:
        state.status === "loading"
          ? "…"
          : state.drawdownPct != null
            ? fmtPct(state.drawdownPct)
            : "—",
      hint:
        state.ath != null
          ? `vs ~1y+ daily ATH ${fmtUsd(state.ath)}`
          : "From available daily history",
    },
    {
      label: "Days since halving",
      value: state.daysSinceHalving != null ? String(state.daysSinceHalving) : "—",
      hint: "Last halving 19 Apr 2024",
    },
  ];

  return (
    <section className="mt-12" aria-label="Live market strip">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Market strip</p>
        <p className="text-xs text-muted">Educational / live market data · not advice</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{c.label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">{c.value}</p>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
          </div>
        ))}
      </div>
      {state.status === "error" && (
        <p className="mt-2 text-xs text-muted">Could not refresh live feed ({state.error}). Halving day count still shown.</p>
      )}
    </section>
  );
}
