"use client";

import { useEffect, useState } from "react";
import {
  daysSinceHalving,
  daysUntilNextHalving,
  NEXT_HALVING,
} from "@/lib/bitcoinHalving";

type StripState = {
  status: "loading" | "ready" | "error";
  btcPrice: number | null;
  drawdownPct: number | null;
  ath: number | null;
  daysSinceHalving: number | null;
  daysUntilNextHalving: number | null;
  source?: string;
  error?: string;
};

function fmtUsd(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtPct(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

type ApiPayload = {
  ok: boolean;
  btcPrice: number | null;
  drawdownPct: number | null;
  ath: number | null;
  daysSinceHalving: number | null;
  daysUntilNextHalving: number | null;
  source?: string;
  error?: string;
  note?: string;
};

async function loadStrip(signal: AbortSignal): Promise<ApiPayload> {
  const r = await fetch("/api/btc-info", { signal, cache: "no-store" });
  const data = (await r.json()) as ApiPayload;
  if (!r.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${r.status}`);
  }
  return data;
}

export function MarketStrip() {
  const [state, setState] = useState<StripState>({
    status: "loading",
    btcPrice: null,
    drawdownPct: null,
    ath: null,
    daysSinceHalving: daysSinceHalving(),
    daysUntilNextHalving: daysUntilNextHalving(),
  });

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const hardStop = setTimeout(() => ac.abort(), 20_000);

    (async () => {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 400 * 2 ** (attempt - 1)));
          }
          const data = await loadStrip(ac.signal);
          if (cancelled) return;
          setState({
            status: "ready",
            btcPrice: data.btcPrice,
            drawdownPct: data.drawdownPct,
            ath: data.ath,
            daysSinceHalving: data.daysSinceHalving ?? daysSinceHalving(),
            daysUntilNextHalving:
              data.daysUntilNextHalving ?? daysUntilNextHalving(),
            source: data.source,
          });
          return;
        } catch (e) {
          lastErr = e;
          if (ac.signal.aborted) break;
        }
      }
      if (cancelled) return;
      setState((s) => ({
        ...s,
        status: "error",
        error:
          lastErr instanceof Error
            ? lastErr.name === "AbortError"
              ? "Timed out"
              : lastErr.message
            : "Feed unavailable",
        daysSinceHalving: daysSinceHalving(),
        daysUntilNextHalving: daysUntilNextHalving(),
      }));
    })();

    return () => {
      cancelled = true;
      clearTimeout(hardStop);
      ac.abort();
    };
  }, []);

  const sourceHint =
    state.status === "ready"
      ? state.source === "yahoo"
        ? "Yahoo chart (Coinbase unavailable)"
        : "Live Coinbase ticker"
      : state.status === "error"
        ? "Unavailable"
        : "Loading";

  const cards = [
    {
      label: "BTC-USD",
      value:
        state.status === "loading"
          ? "…"
          : state.btcPrice != null
            ? fmtUsd(state.btcPrice)
            : "—",
      hint: sourceHint,
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
    {
      label: "Days to halving",
      value:
        state.daysUntilNextHalving != null ? String(state.daysUntilNextHalving) : "—",
      hint: `Estimated ~${new Date(NEXT_HALVING).toLocaleDateString("en-AU", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })}`,
    },
  ];

  return (
    <section className="mt-12" aria-label="BTC info">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          BTC info
        </p>
        <p className="text-xs text-muted">Educational / live market data · not advice</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              {c.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
              {c.value}
            </p>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
          </div>
        ))}
      </div>
      {state.status === "error" && (
        <p className="mt-2 text-xs text-muted">
          Could not refresh live feed ({state.error}). Halving day counts still shown.
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        Source: Coinbase Exchange BTC-USD (spot ticker and daily candles), with Yahoo
        Finance chart as a fallback when Coinbase is rate-limited. Drawdown uses recent
        daily closes from that feed, not an all-time exchange ATH. Halving date is fixed
        (19 Apr 2024). Next halving estimate uses 210,000 blocks at Bitcoin's 10-minute
        target block time. Educational only — NFA.
      </p>
    </section>
  );
}
