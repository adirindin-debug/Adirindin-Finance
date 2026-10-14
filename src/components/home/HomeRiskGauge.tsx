"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ZONES, type MsSummary } from "@/lib/marketSentiment";
import { DeskTag } from "@/components/home/DeskTag";

/* Half-dial geometry (viewBox 0 0 240 140). */
const CX = 120;
const CY = 120;
const R = 96;
const pt = (score: number, r = R) => {
  const a = Math.PI * (1 - Math.min(100, Math.max(0, score)) / 100);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};
const arc = (a: number, b: number) => {
  const p0 = pt(a);
  const p1 = pt(b);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
};
const fmtAsOf = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Homepage hero: the live Market sentiment score, zone and stage (same reading as /tools/risk-sentiment). */
export function HomeRiskGauge() {
  const [data, setData] = useState<MsSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/risk-sentiment?summary=1")
      .then((r) => r.json() as Promise<MsSummary>)
      .then((j) => {
        if (cancelled) return;
        if (j.ok && j.score != null) setData(j);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const score = data?.score ?? null;
  const needle = score != null ? pt(score, R - 22) : null;

  return (
    <Link
      href="/tools/risk-sentiment"
      className="group mt-8 flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-6 transition hover:border-accent hover:bg-accent/5 sm:flex-row sm:gap-10 sm:p-8"
    >
      <svg viewBox="0 0 240 140" className="h-[130px] w-[220px] shrink-0" role="img" aria-label={score != null ? `Market sentiment score ${score.toFixed(0)} of 100` : "Market sentiment gauge"}>
        {ZONES.map((z) => (
          <path
            key={z.key}
            d={arc(z.min + 0.8, z.max - 0.8)}
            stroke={z.color}
            strokeOpacity={data?.zone?.key === z.key ? 1 : 0.35}
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {needle ? (
          <>
            <line x1={CX} y1={CY} x2={needle.x} y2={needle.y} stroke="#e8eef7" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx={CX} cy={CY} r="6" fill="#e8eef7" />
          </>
        ) : (
          <circle cx={CX} cy={CY} r="6" fill="#3a4558" />
        )}
      </svg>
      <div className="min-w-0 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Market sentiment</p>
          <DeskTag kind="live" />
        </div>
        {data && score != null && data.zone ? (
          <>
            <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl" style={{ color: data.zone.color }}>
              {score.toFixed(0)}
              <span className="text-2xl text-muted sm:text-3xl"> / 100</span>
              <span className="ml-3 text-2xl sm:text-3xl">{data.zone.label}</span>
            </p>
            <p className="mt-2 max-w-xl text-sm text-muted">
              {data.zone.blurb}
              {data.change3m != null ? ` ${data.change3m >= 0 ? "Up" : "Down"} ${Math.abs(data.change3m).toFixed(0)} points on three months ago.` : ""}
              {data.season ? (
                <span className="ml-2 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium" style={{ borderColor: `${data.season.color}66`, color: data.season.color }}>
                  {data.season.label}
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-xs text-muted/80">
              <span className="font-medium text-foreground/80">How it’s drawn:</span> 0–100 blend of public
              stress and conditions data — OFR Financial Stress Index (overall, volatility, equity valuation, credit),
              Chicago Fed NFCI, St. Louis Fed stress index (via FRED), Crypto Fear &amp; Greed (Alternative.me) and
              seasonality · ~2-month average · as of {fmtAsOf(data.asOf!)}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">{failed ? "Live reading unavailable right now." : "Loading the latest reading…"}</p>
        )}
        <span className="mt-3 inline-flex text-sm font-medium text-accent group-hover:underline">See the full gauge →</span>
      </div>
    </Link>
  );
}
