"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ETF_AGGS,
  ETF_ASSETS,
  ETF_ASSET_META,
  aggregateFlows,
  flowColor,
  fmtFlowUsd,
  type EtfAgg,
  type EtfAssetId,
  type EtfBucket,
  type EtfFlowsPayload,
} from "@/lib/etfFlows";

const W = 720;
const H = 280;
const PAD = { top: 24, right: 16, bottom: 44, left: 64 };

function BarChart({
  buckets,
  accent,
}: {
  buckets: EtfBucket[];
  accent: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!buckets.length) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-border bg-black/40 text-sm text-muted">
        No flow data for this window
      </div>
    );
  }

  const vals = buckets.map((b) => b.netFlowUsd);
  const maxAbs = Math.max(...vals.map((v) => Math.abs(v)), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const zeroY = PAD.top + innerH / 2;
  const barGap = buckets.length > 60 ? 1 : buckets.length > 30 ? 2 : 3;
  const barW = Math.max(2, (innerW - barGap * (buckets.length - 1)) / buckets.length);

  const ticks = [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs];

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="ETF net flows bar chart"
      >
        <rect x={0} y={0} width={W} height={H} fill="transparent" />
        {/* zero line */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={zeroY}
          y2={zeroY}
          stroke="#3a4254"
          strokeWidth={1}
        />
        {ticks.map((t, i) => {
          const y = zeroY - (t / maxAbs) * (innerH / 2);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#1e2430"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y + 3}
                textAnchor="end"
                fill="#8b95a8"
                fontSize={10}
                fontFamily="ui-monospace, monospace"
              >
                {fmtFlowUsd(t, 1).replace("+", "")}
              </text>
            </g>
          );
        })}
        {buckets.map((b, i) => {
          const x = PAD.left + i * (barW + barGap);
          const h = (Math.abs(b.netFlowUsd) / maxAbs) * (innerH / 2);
          const y = b.netFlowUsd >= 0 ? zeroY - h : zeroY;
          const fill = flowColor(b.netFlowUsd);
          const active = hover === i;
          return (
            <rect
              key={b.key}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, b.netFlowUsd === 0 ? 1 : 0)}
              fill={fill}
              opacity={active ? 1 : 0.85}
              stroke={active ? accent : "none"}
              strokeWidth={active ? 1 : 0}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className="cursor-crosshair"
            />
          );
        })}
        {/* sparse x labels */}
        {buckets.map((b, i) => {
          const step = Math.max(1, Math.ceil(buckets.length / 8));
          if (i % step !== 0 && i !== buckets.length - 1) return null;
          const x = PAD.left + i * (barW + barGap) + barW / 2;
          return (
            <text
              key={`lbl-${b.key}`}
              x={x}
              y={H - 12}
              textAnchor="middle"
              fill="#8b95a8"
              fontSize={9}
              fontFamily="ui-monospace, monospace"
            >
              {b.label.length > 12 ? b.label.slice(0, 11) + "…" : b.label}
            </text>
          );
        })}
      </svg>
      {hover != null && buckets[hover] ? (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-md border border-border bg-black/95 px-3 py-1.5 font-mono text-xs text-[#e8eef7] shadow-lg">
          <span className="text-muted">{buckets[hover]!.label}</span>
          <span className="mx-2 text-border">·</span>
          <span style={{ color: flowColor(buckets[hover]!.netFlowUsd) }}>
            {fmtFlowUsd(buckets[hover]!.netFlowUsd)}
          </span>
          <span className="mx-2 text-border">·</span>
          <span className="text-muted">
            cum {fmtFlowUsd(buckets[hover]!.cumulativeUsd)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function EtfFlowsPanel() {
  const [data, setData] = useState<EtfFlowsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState<EtfAssetId>("btc");
  const [agg, setAgg] = useState<EtfAgg>("monthly");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/etf-flows", { cache: "no-store" });
        const json = (await res.json()) as EtfFlowsPayload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData({
            ok: false,
            asOf: "",
            unit: "USD",
            assets: {
              btc: {
                label: "Bitcoin",
                source: "",
                sourceUrl: "",
                status: "error",
                firstDate: null,
                lastDate: null,
                days: [],
              },
              eth: {
                label: "Ethereum",
                source: "",
                sourceUrl: "",
                status: "error",
                firstDate: null,
                lastDate: null,
                days: [],
              },
              sol: {
                label: "Solana",
                source: "",
                sourceUrl: "",
                status: "error",
                firstDate: null,
                lastDate: null,
                days: [],
              },
              zcsh: {
                label: "Zcash (ZCSH)",
                source: "",
                sourceUrl: "",
                status: "pending",
                pendingReason: "Fetch failed",
                firstDate: null,
                lastDate: null,
                days: [],
              },
            },
            errors: [e instanceof Error ? e.message : "Fetch failed"],
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

  const series = data?.assets?.[asset];
  const pending = series?.status === "pending" || (series?.days.length === 0 && series?.status !== "ok");
  const buckets = useMemo(
    () => (series?.days?.length ? aggregateFlows(series.days, agg) : []),
    [series, agg],
  );

  const latestBucket = buckets[buckets.length - 1];
  const totalCum = buckets.length ? buckets[buckets.length - 1]!.cumulativeUsd : null;
  const meta = ETF_ASSET_META[asset];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="etf-asset">
          Asset
        </label>
        <select
          id="etf-asset"
          value={asset}
          onChange={(e) => setAsset(e.target.value as EtfAssetId)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {ETF_ASSETS.map((id) => {
            const a = data?.assets?.[id];
            const tag =
              a?.status === "pending"
                ? " (source pending)"
                : a?.status === "error"
                  ? " (unavailable)"
                  : "";
            return (
              <option key={id} value={id}>
                {ETF_ASSET_META[id].label}
                {tag}
              </option>
            );
          })}
        </select>
        <div
          className="inline-flex rounded-lg border border-border bg-card p-0.5"
          role="group"
          aria-label="Aggregation"
        >
          {ETF_AGGS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAgg(a.key)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition sm:text-sm ${
                agg === a.key
                  ? "bg-accent/20 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading ETF flows…</p>
      ) : pending ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center">
          <p className="text-lg font-semibold text-muted">
            {meta.label} — source pending
          </p>
          <p className="mt-2 text-sm text-muted">
            {series?.pendingReason ??
              "No public figures available yet. We do not invent flow data."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Latest {agg} net
              </p>
              <p
                className="mt-1 font-mono text-2xl font-bold"
                style={{
                  color: latestBucket
                    ? flowColor(latestBucket.netFlowUsd)
                    : undefined,
                }}
              >
                {latestBucket ? fmtFlowUsd(latestBucket.netFlowUsd) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {latestBucket?.label ?? "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Cumulative (shown window)
              </p>
              <p
                className="mt-1 font-mono text-2xl font-bold"
                style={{
                  color: totalCum != null ? flowColor(totalCum) : undefined,
                }}
              >
                {totalCum != null ? fmtFlowUsd(totalCum) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                Sum of {agg} buckets from first available day
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Coverage
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                {series?.firstDate ?? "—"} → {series?.lastDate ?? "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {series?.days.length ?? 0} daily prints
                {series?.snapshot ? " · snapshot fallback" : ""}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card p-3 sm:p-4">
            <BarChart buckets={buckets} accent={meta.color} />
          </div>
        </>
      )}

      <div className="space-y-2 text-xs leading-relaxed text-muted">
        <p>
          <span className="font-semibold text-foreground/80">Source: </span>
          {series?.sourceUrl ? (
            <a
              href={series.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {series.source || series.sourceUrl}
            </a>
          ) : (
            series?.source || "—"
          )}
          . Figures are public table totals (Farside US$m converted to USD;
          ZCSH from ZecZcash’s SoSoValue-backed settled CSV). Not an official
          issuer feed.
        </p>
        <p>
          Aggregation sums the same daily series into{" "}
          {ETF_AGGS.map((a) => a.label.toLowerCase()).join(" / ")} buckets.
          Australian English labels · educational only — not financial advice
          (NFA).
        </p>
        {data?.errors?.length ? (
          <p className="text-amber-400/90">
            Live fetch notes: {data.errors.join("; ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
