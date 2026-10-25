"use client";

import { useEffect, useMemo, useState } from "react";

import { StoredCopyTag } from "@/components/ui/StoredCopyTag";
import {
  ETF_AGGS,
  ETF_ASSET_META,
  ETF_VIEWS,
  SEC_SOURCE_URL,
  bucketsForView,
  flowColor,
  fmtFlowUsd,
  fundsForView,
  quarterLabel,
  type EtfAgg,
  type EtfBucket,
  type EtfFlowsPayload,
  type EtfViewId,
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

function allQuarters(first: string, last: string): string[] {
  const out: string[] = [];
  let y = Number(first.slice(0, 4));
  let q = Number(first.slice(5));
  while (`${y}Q${q}` <= last) {
    out.push(`${y}Q${q}`);
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
  }
  return out;
}

export function EtfFlowsPanel() {
  const [data, setData] = useState<EtfFlowsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<EtfViewId>("total");
  const [agg, setAgg] = useState<EtfAgg>("quarterly");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/etf-flows");
        const json = (await res.json()) as EtfFlowsPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const buckets = useMemo(() => (data?.ok ? bucketsForView(data, view, agg) : []), [data, view, agg]);
  const funds = useMemo(() => (data?.ok ? fundsForView(data, view) : []), [data, view]);
  const omitted = (data?.omitted ?? []).filter((o) => view === "total" || o.asset === view);
  const latestQ = useMemo(() => {
    let m = "";
    for (const f of data?.funds ?? []) for (const q of f.quarters) if (q.q > m) m = q.q;
    return m;
  }, [data]);
  const meta = ETF_ASSET_META[view];
  const latest = buckets[buckets.length - 1];
  const totalCum = latest?.cumulativeUsd;
  const partialYear = agg === "yearly" && latest && latestQ && !latestQ.endsWith("Q4") && latestQ.startsWith(latest.key);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Asset
          <select
            value={view}
            onChange={(e) => setView(e.target.value as EtfViewId)}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
          >
            {ETF_VIEWS.map((v) => (
              <option key={v} value={v}>
                {ETF_ASSET_META[v].label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex rounded-md border border-border bg-card p-0.5 text-xs">
          {ETF_AGGS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setAgg(a.key)}
              className={`rounded px-2.5 py-1 font-medium ${
                agg === a.key ? "bg-accent/20 text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          Quarterly filings data
        </span>
        {data?.snapshot ? <StoredCopyTag to={data.asOf} /> : null}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading ETF flows…</p>
      ) : !data?.ok ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted">
          SEC EDGAR data is unavailable right now. We don&apos;t invent flow figures.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Latest {agg === "yearly" ? "year" : "quarter"} net{partialYear ? " (year to date)" : ""}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold" style={{ color: latest ? flowColor(latest.netFlowUsd) : undefined }}>
                {latest ? fmtFlowUsd(latest.netFlowUsd) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {latest ? `${latest.label} · ${latest.funds} funds reporting` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Total net (created − redeemed)</p>
              <p className="mt-1 font-mono text-2xl font-bold" style={{ color: totalCum != null ? flowColor(totalCum) : undefined }}>
                {totalCum != null ? fmtFlowUsd(totalCum) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {buckets.length ? `${buckets[0]!.label} → ${latest!.label}` : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Coverage</p>
              <p className="mt-1 font-mono text-2xl font-bold text-foreground">{funds.length} funds</p>
              <p className="mt-1 text-xs text-muted">
                {omitted.length ? `${omitted.length} omitted (see below)` : "none omitted"} · latest filed {latestQ ? quarterLabel(latestQ) : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs text-muted">
              <span style={{ color: meta.color }}>{meta.label}</span> · {agg} net creations minus redemptions (US$)
            </p>
            <BarChart buckets={buckets} accent={meta.color} />
          </div>

          <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted">
            <p className="mb-2 font-semibold text-foreground">Funds covered</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {funds.map((f) => {
                const qs = f.quarters.map((q) => q.q);
                const missing = allQuarters(qs[0]!, latestQ).filter((q) => !qs.includes(q));
                return (
                  <li key={f.ticker}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-mono text-foreground hover:text-accent">
                      {f.ticker}
                    </a>{" "}
                    {f.name} · {quarterLabel(qs[0]!)}–{quarterLabel(qs[qs.length - 1]!)}
                    {missing.length ? (
                      <span className="text-[#f4b942]"> · not derivable: {missing.map(quarterLabel).join(", ")}</span>
                    ) : null}
                    {f.snapshot ? " · stored copy" : ""}
                  </li>
                );
              })}
            </ul>
            {omitted.length ? (
              <>
                <p className="mb-1 mt-4 font-semibold text-foreground">Omitted (can&apos;t be derived from filings)</p>
                <ul className="space-y-1">
                  {omitted.map((o) => (
                    <li key={o.ticker}>
                      <span className="font-mono text-foreground">{o.ticker}</span> {o.name} — {o.reason}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Quarterly figures. Net = US$ value of shares created minus shares redeemed, as reported in each
            trust&apos;s statement of changes in net assets (10-Q / 10-K XBRL). Q4 is the annual figure less the
            first nine months. Each fund starts in the quarter it began trading as a US spot ETF; seed capital
            and pre-conversion trust history are excluded. A filing lands roughly 5–6 weeks after quarter end.
            Educational only, not advice.{" "}
            <a href={SEC_SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Source: SEC EDGAR
            </a>
            {data.asOf ? ` · fetched ${data.asOf}` : ""}
          </p>
        </>
      )}
    </div>
  );
}
