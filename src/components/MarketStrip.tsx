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

/** Stable UTC month+year — avoids Node vs browser `toLocaleDateString` hydration mismatch (#418). */
function fmtNextHalvingHint(): string {
  const d = new Date(NEXT_HALVING);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const NEXT_HALVING_HINT = fmtNextHalvingHint();

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
  // Defer Date.now()-based day counts until after mount so SSR HTML matches
  // the first client render (React error #418 hydration mismatch).
  const [state, setState] = useState<StripState>({
    status: "loading",
    btcPrice: null,
    drawdownPct: null,
    ath: null,
    daysSinceHalving: null,
    daysUntilNextHalving: null,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setState((s) => ({
      ...s,
      daysSinceHalving: daysSinceHalving(),
      daysUntilNextHalving: daysUntilNextHalving(),
    }));
  }, []);

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

  const daySince =
    mounted && state.daysSinceHalving != null
      ? String(state.daysSinceHalving)
      : "—";
  const dayUntil =
    mounted && state.daysUntilNextHalving != null
      ? String(state.daysUntilNextHalving)
      : "—";

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
      value: daySince,
      hint: "Last halving 20 Apr 2024",
    },
    {
      label: "Days to halving",
      value: dayUntil,
      hint: `Estimated ~${NEXT_HALVING_HINT}`,
    },
  ];

  return (
    <section className="mt-4" aria-label="BTC snapshot">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-4 py-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{c.label}</dt>
            <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">{c.value}</dd>
            <dd className="truncate text-[11px] text-muted" title={c.hint}>{c.hint}</dd>
          </div>
        ))}
      </dl>
      {state.status === "error" && (
        <p className="mt-2 text-xs text-muted">
          Could not refresh live feed ({state.error}). Halving day counts still shown.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        BTC price: Coinbase (Yahoo Finance backup). Drawdown uses recent daily closes. Halving dates are estimates.
      </p>
    </section>
  );
}
