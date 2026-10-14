"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  DEFAULT_SMOOTH,
  INPUTS,
  SMOOTH_OPTIONS,
  SUB_OFFSET,
  ZONES,
  cell,
  seasonTag,
  zoneFor,
  zoneLine,
  zonesWithHysteresis,
  type MsPayload,
  type SmoothKey,
} from "@/lib/marketSentiment";
import { SentimentDial } from "@/components/tools/SentimentDial";

const SMOOTH_KEY = "adirindin.marketSentiment.smoothing";
const BASE_KEY = "adirindin.marketSentiment.baseChart";
const TFS = [
  { key: "1y", label: "1Y", years: 1 },
  { key: "3y", label: "3Y", years: 3 },
  { key: "5y", label: "5Y", years: 5 },
  { key: "10y", label: "10Y", years: 10 },
  { key: "max", label: "Max", years: null },
] as const;
type TfKey = (typeof TFS)[number]["key"];
type BaseKey = "spx" | "ixic" | "urth" | "off";
const BASES: Array<{ key: BaseKey; label: string }> = [
  { key: "spx", label: "S&P 500" },
  { key: "ixic", label: "Nasdaq" },
  { key: "urth", label: "URTH" },
  { key: "off", label: "Off" },
];
const SCORE_COL: Record<SmoothKey, number> = { raw: 1, ema10: 2, ema42: 3 };

const fmtDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtMonthYear = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-AU", { month: "short", year: "numeric", timeZone: "UTC" });

const DESK = { W: 920, H: 360, PAD: { top: 16, right: 96, bottom: 30, left: 40 } };
const PHONE = { W: 420, H: 340, PAD: { top: 14, right: 54, bottom: 28, left: 30 } };

/** Smooth path through points (Catmull-Rom → cubic Bézier), for display only. */
function smoothPath(pts: Array<[number, number] | null>): string {
  let d = "";
  let run: Array<[number, number]> = [];
  const flush = () => {
    if (run.length === 1) d += `M${run[0]![0]},${run[0]![1]}`;
    for (let i = 0; i < run.length - 1; i++) {
      const p0 = run[i - 1] ?? run[i]!;
      const p1 = run[i]!;
      const p2 = run[i + 1]!;
      const p3 = run[i + 2] ?? p2;
      if (i === 0) d += `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}`;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    run = [];
  };
  for (const p of pts) {
    if (p) run.push(p);
    else flush();
  }
  flush();
  return d;
}

export function MarketSentimentPanel() {
  const [data, setData] = useState<MsPayload | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [smooth, setSmooth] = useState<SmoothKey>(DEFAULT_SMOOTH);
  const [tf, setTf] = useState<TfKey>("3y");
  const [base, setBase] = useState<BaseKey>("off");
  const [hover, setHover] = useState<number | null>(null);
  const [narrow, setNarrow] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/risk-sentiment")
      .then((r) => r.json() as Promise<MsPayload>)
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setData(j);
        else setFailed(j.error ?? "Feed unavailable");
      })
      .catch((e) => !cancelled && setFailed(e instanceof Error ? e.message : "Fetch failed"));
    try {
      const s = localStorage.getItem(SMOOTH_KEY);
      if (s === "raw" || s === "ema10" || s === "ema42") setSmooth(s);
      const b = localStorage.getItem(BASE_KEY);
      if (b === "spx" || b === "ixic" || b === "urth" || b === "off") setBase(b);
    } catch {
      /* storage blocked */
    }
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => {
      cancelled = true;
      mq.removeEventListener("change", sync);
    };
  }, []);

  const persist = (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  };

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const scores = useMemo(() => rows.map((r) => cell(r, SCORE_COL[smooth])), [rows, smooth]);
  const zones = useMemo(() => zonesWithHysteresis(scores), [scores]);
  const latestIdx = useMemo(() => {
    for (let i = scores.length - 1; i >= 0; i--) if (scores[i] != null) return i;
    return -1;
  }, [scores]);

  const dims = narrow ? PHONE : DESK;
  const { W, H, PAD } = dims;

  const view = useMemo(() => {
    if (!rows.length) return null;
    const meta = TFS.find((t) => t.key === tf)!;
    const lastD = rows[rows.length - 1]![0];
    const from = meta.years
      ? new Date(Date.parse(`${lastD}T00:00:00Z`) - meta.years * 365.25 * 86_400_000).toISOString().slice(0, 10)
      : rows[0]![0];
    let off = rows.findIndex((r) => r[0] >= from);
    if (off < 0) off = 0;
    const vr = rows.slice(off);
    const t0 = Date.parse(vr[0]![0]);
    const t1 = Date.parse(vr[vr.length - 1]![0]);
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const xOf = (d: string) => PAD.left + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * iw;
    const yOf = (s: number) => PAD.top + (1 - s / 100) * ih;
    const xs = vr.map((r) => xOf(r[0]));
    const sc = scores.slice(off);
    const scorePath = smoothPath(sc.map((s, i) => (s == null ? null : [xs[i]!, yOf(s)])));
    const baseVals = base === "off" ? null : data?.overlay?.[base]?.slice(off) ?? null;
    let basePath = "";
    if (baseVals) {
      const logs = baseVals.map((v) => (v != null && v > 0 ? Math.log(v) : null));
      const ok = logs.filter((v): v is number => v != null);
      if (ok.length > 1) {
        const lo = Math.min(...ok);
        const hi = Math.max(...ok);
        basePath = smoothPath(logs.map((v, i) => (v == null ? null : [xs[i]!, PAD.top + (1 - (v - lo) / (hi - lo || 1)) * ih])));
      }
    }
    const n = narrow ? 3 : 5;
    const ticks = Array.from({ length: n }, (_, k) => {
      const t = t0 + (k / (n - 1)) * (t1 - t0);
      const d = new Date(t).toISOString().slice(0, 10);
      return { x: PAD.left + (k / (n - 1)) * iw, label: meta.years === 1 ? fmtDay(d) : fmtMonthYear(d) };
    });
    return { off, vr, xs, yOf, scorePath, basePath, baseVals, ticks, iw };
  }, [rows, scores, tf, base, data, W, H, PAD, narrow]);

  const onMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || !view) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const x = pt.matrixTransform(ctm.inverse()).x;
      if (x < PAD.left || x > W - PAD.right) return setHover(null);
      let best = 0;
      let bd = Infinity;
      view.xs.forEach((xx, i) => {
        const dd = Math.abs(xx - x);
        if (dd < bd) {
          bd = dd;
          best = i;
        }
      });
      setHover(best);
    },
    [view, PAD.left, PAD.right, W],
  );

  if (failed) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-sm text-muted">
        Could not load the gauge right now ({failed}). Sources may be temporarily unavailable — please try again later.
      </section>
    );
  }
  if (!data || latestIdx < 0 || !view) {
    return (
      <section className="flex min-h-[420px] items-center justify-center rounded-xl border border-border bg-card p-6 text-sm text-muted">
        Loading the latest reading…
      </section>
    );
  }

  const pickIdx = hover != null ? view.off + hover : latestIdx;
  const row = rows[pickIdx]!;
  const score = scores[pickIdx];
  const zone = zones[pickIdx];
  const cutoff = new Date(Date.parse(`${row[0]}T00:00:00Z`) - 91 * 86_400_000).toISOString().slice(0, 10);
  let j = pickIdx;
  while (j >= 0 && rows[j]![0] > cutoff) j--;
  const prev = j >= 0 ? scores[j] : null;
  const seasonSub = cell(row, SUB_OFFSET + 7);
  const tag = seasonSub != null ? seasonTag(seasonSub) : null;
  const smoothName = SMOOTH_OPTIONS.find((o) => o.key === smooth)!.name;

  const seg = "min-h-9 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors";
  const on = "bg-accent text-white shadow-sm";
  const offc = "text-foreground/65 hover:bg-white/5 hover:text-foreground";

  const hx = hover != null ? view.xs[hover] : null;
  const hy = hover != null && score != null ? view.yOf(score) : null;
  const baseHover = hover != null && view.baseVals ? view.baseVals[hover] : null;
  const baseLabel = BASES.find((b) => b.key === base)!.label;

  return (
    <section className="rounded-xl border border-border bg-[#0f1419] p-4 sm:p-6">
      {/* Headline */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4 sm:gap-6">
        <SentimentDial score={score ?? null} className="hidden h-[112px] w-[190px] sm:block" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {hover != null ? fmtDay(row[0]) : `Latest · ${fmtDay(row[0])}`}
          </p>
          <p className="mt-1 text-5xl font-semibold tracking-tight" style={{ color: zone?.color }}>
            {score != null ? score.toFixed(0) : "—"}
            <span className="text-2xl text-muted"> / 100</span>
            <span className="ml-3 text-3xl">{zone?.label}</span>
          </p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {zone ? zoneLine(zone) : ""}
            {prev != null && score != null ? ` ${score >= prev ? "Up" : "Down"} ${Math.abs(score - prev).toFixed(0)} points on three months ago.` : ""}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{smoothName}</span>
            {tag ? (
              <span className="rounded-full border px-2 py-0.5 font-medium" style={{ borderColor: `${tag.color}55`, background: `${tag.color}14`, color: tag.color }}>
                {tag.label}
              </span>
            ) : null}
            {smooth !== "raw" && row[1] != null ? <span>· raw day {cell(row, 1)!.toFixed(1)}</span> : null}
          </p>
        </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-0.5 rounded-lg border border-border/90 bg-[#141b24] p-0.5" role="group" aria-label="Smoothing">
            {SMOOTH_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                aria-pressed={smooth === o.key}
                className={`${seg} ${smooth === o.key ? on : offc}`}
                onClick={() => {
                  setSmooth(o.key);
                  persist(SMOOTH_KEY, o.key);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-0.5 rounded-lg border border-border/90 bg-[#141b24] p-0.5" role="group" aria-label="Timeframe">
          {TFS.map((t) => (
            <button key={t.key} type="button" aria-pressed={tf === t.key} className={`${seg} ${tf === t.key ? on : offc}`} onClick={() => setTf(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">Base chart</span>
          <div className="flex gap-0.5 rounded-lg border border-border/90 bg-[#141b24] p-0.5" role="group" aria-label="Base chart">
            {BASES.map((b) => (
              <button
                key={b.key}
                type="button"
                aria-pressed={base === b.key}
                className={`${seg} px-2 ${base === b.key ? on : offc}`}
                onClick={() => {
                  setBase(b.key);
                  persist(BASE_KEY, b.key);
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative mt-3 overflow-hidden rounded-lg border border-[#1d2633] bg-[#05080c]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          style={{ aspectRatio: `${W} / ${H}` }}
          role="img"
          aria-label="Market sentiment score history with zone bands"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="ms-zone-grad" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={view.yOf(100)} y2={view.yOf(0)}>
              {ZONES.slice()
                .reverse()
                .flatMap((z) => [
                  <stop key={`${z.key}-a`} offset={`${100 - z.max + (z.max === 100 ? 0 : 1)}%`} stopColor={z.color} />,
                  <stop key={`${z.key}-b`} offset={`${100 - z.min - (z.min === 0 ? 0 : 1)}%`} stopColor={z.color} />,
                ])}
            </linearGradient>
            <filter id="ms-line-glow" x="-5%" y="-20%" width="110%" height="140%">
              <feGaussianBlur stdDeviation="2.5" />
            </filter>
          </defs>
          {ZONES.map((z) => (
            <g key={z.key}>
              <rect x={PAD.left} width={view.iw} y={view.yOf(z.max)} height={view.yOf(z.min) - view.yOf(z.max)} fill={z.color} opacity={0.055} />
              {z.min > 0 ? (
                <line x1={PAD.left} x2={PAD.left + view.iw} y1={view.yOf(z.min)} y2={view.yOf(z.min)} stroke={z.color} strokeOpacity={0.14} strokeWidth={1} />
              ) : null}
              <text x={PAD.left - 6} y={view.yOf(z.max) + 4} fill="#6b7a8f" fontSize={10} textAnchor="end">
                {z.max}
              </text>
              <text
                x={PAD.left + view.iw + 6}
                y={view.yOf((z.min + z.max) / 2) + 3.5}
                fill={z.color}
                fontSize={narrow ? 9 : 10}
                fontWeight={600}
                opacity={0.8}
              >
                {narrow ? z.label.split(/[ -]/)[0] : z.label}
              </text>
            </g>
          ))}
          {view.basePath ? <path d={view.basePath} fill="none" stroke="#c8d0dc" strokeOpacity={0.28} strokeWidth={1.2} vectorEffect="non-scaling-stroke" /> : null}
          <path d={view.scorePath} fill="none" stroke="url(#ms-zone-grad)" strokeOpacity={0.35} strokeWidth={5} filter="url(#ms-line-glow)" />
          <path d={view.scorePath} fill="none" stroke="url(#ms-zone-grad)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {view.ticks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={H - 8}
              fill="#8b9bb4"
              fontSize={11}
              textAnchor={i === 0 ? "start" : i === view.ticks.length - 1 ? "end" : "middle"}
            >
              {t.label}
            </text>
          ))}
          {hx != null ? <line x1={hx} x2={hx} y1={PAD.top} y2={H - PAD.bottom} stroke="#9eb0c8" strokeDasharray="3 3" strokeWidth={1} /> : null}
          {hx != null && hy != null ? <circle cx={hx} cy={hy} r={4.5} fill={zone?.color} stroke="#000" strokeWidth={1.5} /> : null}
          {hover == null && score != null ? (
            <g>
              <circle className="cycle-live-ring" cx={view.xs[view.xs.length - 1]} cy={view.yOf(scores[latestIdx]!)} r={5} fill="none" stroke={zone?.color} strokeWidth={1.5} />
              <circle cx={view.xs[view.xs.length - 1]} cy={view.yOf(scores[latestIdx]!)} r={4.5} fill={zone?.color} stroke="#000" strokeWidth={1.5} />
            </g>
          ) : null}
        </svg>
        {hover != null ? (
          <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-1.5 text-[11px] tabular-nums text-[#c8d0dc]">
            <span className="font-semibold text-foreground">{fmtDay(row[0])}</span> · {score?.toFixed(1)} {zone?.label}
            {baseHover != null ? ` · ${baseLabel} ${baseHover.toLocaleString("en-AU", { maximumFractionDigits: 0 })}` : ""}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Score line: {smoothName.toLowerCase()}. Zone label changes only once the score is 5 points past a zone line.
        {base !== "off" ? ` Faint line: ${baseLabel} on its own log scale for context (not part of the score).` : ""}
      </p>

      {/* Breakdown */}
      <div className="mt-5 overflow-x-auto rounded-lg border border-[#1d2633]">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="bg-[#0b1017] text-[10px] uppercase tracking-[0.12em] text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Input · {fmtDay(row[0])}</th>
              <th className="px-3 py-2 text-right font-semibold">Weight</th>
              <th className="px-3 py-2 font-semibold">Sub-score (0 cold → 100 hot)</th>
              <th className="px-3 py-2 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {INPUTS.map((m, k) => {
              const v = cell(row, SUB_OFFSET + k);
              return (
                <tr key={m.key} className="border-t border-[#141c27]">
                  <td className="px-3 py-2 text-foreground">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: m.color }} aria-hidden />
                    {m.short}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">{m.weight}%</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <span className="relative h-1.5 w-28 overflow-hidden rounded-full bg-[#141c27]">
                        {v != null ? <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: zoneFor(v).color }} /> : null}
                      </span>
                      <span className="font-mono" style={{ color: v == null ? "#6b7a8f" : zoneFor(v).color }}>{v == null ? "no data" : v.toFixed(0)}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted">
                    <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent hover:underline">
                      {m.credit}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {data.sources.map((s) => (
          <span
            key={s.key}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
              s.ok ? "border-[#2b6b4f] text-[#3dcc9a]" : "border-[#3a4558] text-muted"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${s.ok ? "bg-[#3dcc9a]" : "bg-[#3a4558]"}`} aria-hidden />
            {s.label}
            {s.asOf ? ` · to ${s.asOf}` : s.ok ? "" : " · unavailable"}
          </span>
        ))}
      </div>
    </section>
  );
}
