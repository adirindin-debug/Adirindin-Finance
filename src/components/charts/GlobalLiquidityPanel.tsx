"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SentimentDial } from "@/components/tools/SentimentDial";
import { DeskTag } from "@/components/home/DeskTag";
import { StoredCopyTag, fmtStoredDate } from "@/components/ui/StoredCopyTag";
import { LIQ_ZONES, LIQ_HYSTERESIS, type LiqPayload, type LiqRow, type LineKey } from "@/lib/globalLiquidity";

type Key = "comp" | LineKey;
type View = "level" | "g6" | "g12";
type Tf = "5Y" | "10Y" | "ALL";

const LINES: Array<{ key: Key; label: string; short: string; color: string }> = [
  { key: "comp", label: "Composite", short: "Composite", color: "#e8eef7" },
  { key: "netliq", label: "US net liquidity", short: "US net liq.", color: "#f59e0b" },
  { key: "cbFx", label: "Fed+ECB fixed FX", short: "Fed+ECB fixed FX", color: "#a78bfa" },
  { key: "cbUsd", label: "Fed+ECB US$", short: "Fed+ECB US$", color: "#60a5fa" },
  { key: "m2", label: "US M2", short: "US M2", color: "#94a3b8" },
];
const VIEWS: Array<{ key: View; label: string }> = [
  { key: "level", label: "Level (US$tn)" },
  { key: "g6", label: "6m growth" },
  { key: "g12", label: "12m growth" },
];
const TFS: Tf[] = ["5Y", "10Y", "ALL"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonth = (d: string) => `${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);
const fmtTn = (v: number | null | undefined) => (v == null ? "—" : `US$${v.toFixed(2)}tn`);
const fmtSig = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}σ`);

function niceTicks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 1) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

export function GlobalLiquidityPanel() {
  const [data, setData] = useState<LiqPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("g12");
  const [tf, setTf] = useState<Tf>("10Y");
  const [on, setOn] = useState<Record<Key, boolean>>({ comp: true, netliq: true, cbFx: true, cbUsd: false, m2: false });
  const [zoom, setZoom] = useState<{ a: string; b: string } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [sel, setSel] = useState<{ x0: number; x1: number } | null>(null);
  const dragRef = useRef<{ startX: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [W, setW] = useState(900);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/global-liquidity")
      .then((r) => r.json() as Promise<LiqPayload>)
      .then((j) => {
        if (cancelled) return;
        if (j.ok && j.rows?.length) setData(j);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(300, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, [data]);

  const narrow = W < 560;
  const H = narrow ? 300 : 380;
  const PAD_L = narrow ? 38 : 48;
  const PAD_R = narrow ? 58 : 84;
  const PAD_T = 14;
  const PAD_B = 26;

  const rows = useMemo(() => {
    const all = (data?.rows ?? []).filter((r) => r.netliq != null);
    if (!all.length) return [] as LiqRow[];
    const lastD = all[all.length - 1]!.d;
    const yrs = tf === "5Y" ? 5 : tf === "10Y" ? 10 : 99;
    const from = `${Number(lastD.slice(0, 4)) - yrs}${lastD.slice(4)}`;
    let r = all.filter((x) => x.d >= from);
    if (view !== "level") r = r.filter((x) => x.g12.netliq != null);
    if (zoom) r = r.filter((x) => x.d >= zoom.a && x.d <= zoom.b);
    return r;
  }, [data, tf, view, zoom]);

  const valOf = useCallback(
    (r: LiqRow, k: Key): number | null => {
      if (k === "comp") return view === "level" ? null : r.comp;
      return view === "level" ? r[k] : view === "g6" ? r.g6[k] : r.g12[k];
    },
    [view],
  );
  const shown = LINES.filter((l) => on[l.key] && !(l.key === "comp" && view === "level"));

  const chart = useMemo(() => {
    if (rows.length < 2) return null;
    const lineKeys = shown.filter((l) => l.key !== "comp").map((l) => l.key);
    const vals = rows.flatMap((r) => lineKeys.map((k) => valOf(r, k))).filter((v): v is number => v != null);
    const compVals = on.comp && view !== "level" ? rows.map((r) => r.comp).filter((v): v is number => v != null) : [];
    let lo: number, hi: number;
    if (view === "level") {
      lo = 0;
      hi = vals.length ? Math.max(...vals) * 1.08 : 10;
    } else {
      const m = vals.length ? Math.max(...vals.map(Math.abs)) : 10;
      lo = vals.length ? Math.min(0, ...vals) : -m;
      hi = vals.length ? Math.max(0, ...vals) : m;
      const pad = (hi - lo) * 0.06 || 1;
      lo -= pad;
      hi += pad;
    }
    // Composite (σ) shares the zero line: scale it onto the left axis.
    const cMax = compVals.length ? Math.max(...compVals.map(Math.abs)) : 1;
    const k = view === "level" ? 1 : (vals.length ? Math.max(Math.abs(lo), Math.abs(hi)) * 0.92 : 1) / cMax;
    if (!vals.length && compVals.length) {
      lo = Math.min(...compVals) * k * 1.1;
      hi = Math.max(...compVals) * k * 1.1;
      if (lo > 0) lo = -hi * 0.1;
      if (hi < 0) hi = -lo * 0.1;
    }
    const n = rows.length;
    const x = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R);
    const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);
    const paths = shown.map((l) => {
      let d = "";
      let pen = false;
      rows.forEach((r, i) => {
        const v = valOf(r, l.key);
        if (v == null) {
          pen = false;
          return;
        }
        const yy = y(l.key === "comp" ? v * k : v);
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${yy.toFixed(1)}`;
        pen = true;
      });
      return { ...l, d };
    });
    // End labels, nudged apart.
    const ends = shown
      .map((l) => {
        for (let i = n - 1; i >= 0; i--) {
          const v = valOf(rows[i]!, l.key);
          if (v != null) return { ...l, v, y: y(l.key === "comp" ? v * k : v) };
        }
        return null;
      })
      .filter((e): e is NonNullable<typeof e> => e != null)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 12) ends[i]!.y = ends[i - 1]!.y + 12;
    const yTicks = niceTicks(lo, hi, narrow ? 4 : 6);
    const cTicks = compVals.length && !narrow ? niceTicks(lo / k, hi / k, narrow ? 4 : 5) : [];
    // x ticks: years
    const years = [...new Set(rows.map((r) => r.d.slice(0, 4)))];
    const every = Math.max(1, Math.ceil(years.length / (narrow ? 4 : 9)));
    const xTicks =
      years.length > 1
        ? years
            .map((yr) => ({ yr, i: rows.findIndex((r) => r.d.slice(0, 4) === yr && r.d.slice(5) === "01") }))
            .filter((t) => t.i >= 0 && Number(t.yr) % every === 0)
            .map((t) => ({ x: x(t.i), label: t.yr }))
        : rows.filter((_, i) => i % Math.max(1, Math.ceil(n / 6)) === 0).map((r, j) => ({ x: x(rows.indexOf(r)), label: fmtMonth(r.d) + (j < 0 ? "" : "") }));
    return { x, y, k, paths, ends, yTicks, cTicks, xTicks, lo, hi, n };
  }, [rows, shown, valOf, on.comp, view, W, H, PAD_L, PAD_R, narrow]);

  const toSvgX = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      return ((clientX - r.left) / r.width) * W;
    },
    [W],
  );
  const idxAt = useCallback(
    (sx: number) => {
      if (!chart) return 0;
      const f = (sx - PAD_L) / (W - PAD_L - PAD_R);
      return Math.min(chart.n - 1, Math.max(0, Math.round(f * (chart.n - 1))));
    },
    [chart, W, PAD_L, PAD_R],
  );
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const sx = toSvgX(e.clientX);
    if (sx == null) return;
    setHoverIdx(idxAt(sx));
    if (e.pointerType !== "touch") {
      dragRef.current = { startX: Math.min(Math.max(sx, PAD_L), W - PAD_R) };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const sx = toSvgX(e.clientX);
    if (sx == null) return;
    setHoverIdx(idxAt(sx));
    const drag = dragRef.current;
    if (drag) setSel({ x0: drag.startX, x1: Math.min(Math.max(sx, PAD_L), W - PAD_R) });
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setSel(null);
    if (!drag || !chart) return;
    const end = toSvgX(e.clientX) ?? drag.startX;
    if (Math.abs(end - drag.startX) < 6) return;
    const a = idxAt(Math.min(drag.startX, end));
    const b = idxAt(Math.max(drag.startX, end));
    if (b - a >= 3) setZoom({ a: rows[a]!.d, b: rows[b]!.d });
  };
  const resetZoom = () => {
    setZoom(null);
    setHoverIdx(null);
  };
  useEffect(() => setHoverIdx(null), [zoom, tf, view]);

  const L = data?.latest;
  const zone = L?.zone ?? null;
  const hp = hoverIdx != null ? rows[hoverIdx] : null;

  const btn = "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors";
  const btnOn = "bg-accent text-white shadow-sm";
  const btnOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {data?.stored ? <StoredCopyTag to={data.storedTo} /> : data ? <DeskTag kind="live" /> : null}
        {data?.lastObs?.WALCL ? <span className="text-[11px] text-muted">Fed data to {fmtStoredDate(data.lastObs.WALCL)}</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1" role="group" aria-label="View">
              {VIEWS.map((v) => (
                <button key={v.key} type="button" className={`${btn} ${view === v.key ? btnOn : btnOff}`} aria-pressed={view === v.key} onClick={() => setView(v.key)}>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="inline-flex gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1" role="group" aria-label="Timeframe">
              {TFS.map((t) => (
                <button key={t} type="button" className={`${btn} ${tf === t ? btnOn : btnOff}`} aria-pressed={tf === t} onClick={() => { setTf(t); setZoom(null); }}>
                  {t}
                </button>
              ))}
            </div>
            {zoom && (
              <button type="button" onClick={resetZoom} className="rounded-md border border-accent/60 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20">
                Reset zoom
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Lines">
            {LINES.map((l) => {
              const disabled = l.key === "comp" && view === "level";
              const active = on[l.key] && !disabled;
              return (
                <button
                  key={l.key}
                  type="button"
                  disabled={disabled}
                  title={disabled ? "The composite is a growth score, so it shows on the growth views" : undefined}
                  aria-pressed={active}
                  onClick={() => setOn((o) => ({ ...o, [l.key]: !o[l.key] }))}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: active ? `${l.color}99` : "#2a3340", color: active ? l.color : "#8b95a5", background: active ? `${l.color}14` : "transparent" }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? l.color : "#3a4558" }} aria-hidden />
                  {l.label}
                </button>
              );
            })}
          </div>

          <div ref={wrapRef} className="relative mt-3 w-full">
            {!data && <p className="py-24 text-center text-sm text-muted">{failed ? "Live data unavailable right now." : "Loading liquidity data…"}</p>}
            {chart && (
              <>
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${W} ${H}`}
                  width={W}
                  height={H}
                  className="block w-full cursor-crosshair touch-none select-none"
                  role="img"
                  aria-label="Global liquidity chart. Hover or tap for values; drag to zoom."
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  onPointerLeave={(e) => {
                    if (!dragRef.current && e.pointerType !== "touch") setHoverIdx(null);
                  }}
                  onDoubleClick={resetZoom}
                >
                  <rect x={0} y={0} width={W} height={H} fill="#000" />
                  {chart.yTicks.map((v) => (
                    <g key={`y${v}`}>
                      <line x1={PAD_L} x2={W - PAD_R} y1={chart.y(v)} y2={chart.y(v)} stroke="#1a222c" />
                      <text x={PAD_L - 6} y={chart.y(v) + 3} textAnchor="end" fill="#6b7785" fontSize={10}>
                        {view === "level" ? `${v}` : `${v}%`}
                      </text>
                    </g>
                  ))}
                  {chart.cTicks.map((v) => (
                    <text key={`c${v}`} x={W - 4} y={chart.y(v * chart.k) + 3} textAnchor="end" fill="#8b95a5" fontSize={9}>
                      {v}σ
                    </text>
                  ))}
                  {view !== "level" && <line x1={PAD_L} x2={W - PAD_R} y1={chart.y(0)} y2={chart.y(0)} stroke="#8b95a5" strokeDasharray="4 4" strokeWidth={1} />}
                  {chart.paths.map((p) => (
                    <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth={p.key === "comp" ? 2 : 1.6} strokeLinejoin="round" />
                  ))}
                  {chart.ends.map((e) => (
                    <text key={`e${e.key}`} x={W - PAD_R + 5} y={e.y + 3} fill={e.color} fontSize={10} fontWeight={600}>
                      {e.key === "comp" ? fmtSig(e.v) : view === "level" ? `${e.v.toFixed(1)}tn` : fmtPct(e.v)}
                    </text>
                  ))}
                  {chart.xTicks.map((t) => (
                    <text key={`x${t.label}`} x={t.x} y={H - 8} textAnchor="middle" fill="#6b7785" fontSize={10}>
                      {t.label}
                    </text>
                  ))}
                  {sel && Math.abs(sel.x1 - sel.x0) > 1 && (
                    <rect x={Math.min(sel.x0, sel.x1)} y={PAD_T} width={Math.abs(sel.x1 - sel.x0)} height={H - PAD_T - PAD_B} fill="#60a5fa" opacity={0.12} stroke="#60a5fa" strokeOpacity={0.5} pointerEvents="none" />
                  )}
                  {hp && hoverIdx != null && (
                    <g pointerEvents="none">
                      <line x1={chart.x(hoverIdx)} x2={chart.x(hoverIdx)} y1={PAD_T} y2={H - PAD_B} stroke="#9eb0c8" strokeDasharray="3 3" opacity={0.8} />
                      {shown.map((l) => {
                        const v = valOf(hp, l.key);
                        return v == null ? null : (
                          <circle key={l.key} cx={chart.x(hoverIdx)} cy={chart.y(l.key === "comp" ? v * chart.k : v)} r={3.2} fill={l.color} stroke="#000" strokeWidth={1.2} />
                        );
                      })}
                    </g>
                  )}
                </svg>
                {hp && hoverIdx != null && (
                  <div
                    data-testid="liq-readout"
                    className="pointer-events-none absolute z-10 w-[190px] rounded-md border border-border/80 bg-[#0b0f14]/95 px-2.5 py-2 text-[11px] shadow-lg"
                    style={{ left: `clamp(4px, calc(${(chart.x(hoverIdx) / W) * 100}% + 12px), calc(100% - 194px))`, top: 8 }}
                  >
                    <p className="font-semibold text-[#e8eef7]">{fmtMonth(hp.d)}</p>
                    {shown.map((l) => {
                      const v = valOf(hp, l.key);
                      return (
                        <p key={l.key} className="mt-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} aria-hidden />
                            {l.short}
                          </span>
                          <span className="font-mono" style={{ color: l.color }}>
                            {l.key === "comp" ? fmtSig(v) : view === "level" ? fmtTn(v) : fmtPct(v)}
                          </span>
                        </p>
                      );
                    })}
                    {hp.pct != null ? <p className="mt-1 text-muted">Momentum p{Math.round(hp.pct)}</p> : null}
                  </div>
                )}
              </>
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {view === "level" ? "US$ trillion, month-end." : view === "g6" ? "6-month growth, annualised." : "12-month growth."} {narrow ? "Tap for values. Composite is in σ (end label)." : "Drag to zoom, double-click to reset. Composite uses the right-hand σ scale."}
          </p>
        </section>

        <aside className="flex flex-col items-center rounded-xl border border-border bg-card p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Liquidity momentum</p>
          <SentimentDial
            score={L?.pct ?? null}
            zones={LIQ_ZONES}
            zone={zone}
            className="mt-3 h-[120px] w-[210px]"
            ariaLabel={L?.pct != null && zone ? `Liquidity momentum ${Math.round(L.pct)} of 100, ${zone.label}` : "Liquidity momentum gauge"}
          />
          {L?.pct != null && zone ? (
            <>
              <p className="mt-2 text-3xl font-semibold" style={{ color: zone.color }}>{zone.label}</p>
              <p className="mt-1 text-xs text-muted">Percentile {Math.round(L.pct)} vs the last 10 years</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">{failed ? "Unavailable" : "Loading…"}</p>
          )}
          {data?.lastTurn ? (
            <p className="mt-3 text-xs text-foreground/80" data-testid="liq-last-turn">
              Last turn: {fmtMonth(data.lastTurn.d)} ({data.lastTurn.dir === "up" ? "up" : "down"}), {data.lastTurn.monthsAgo === 0 ? "this month" : `${data.lastTurn.monthsAgo} month${data.lastTurn.monthsAgo === 1 ? "" : "s"} ago`}
            </p>
          ) : null}
          <p className="mt-3 text-[11px] leading-snug text-muted">
            How fast liquidity is changing compared with the past, not how much there is. Label moves {LIQ_HYSTERESIS} points past a zone line.
          </p>
        </aside>
      </div>

      {L && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-black/40 p-3 text-xs sm:grid-cols-5">
          {[
            ["US net liquidity", `${fmtTn(L.netliq)} · ${fmtPct(L.netliq12)} 12m`],
            ["Fed+ECB fixed FX", `${fmtPct(L.cbFx12)} 12m`],
            ["Fed+ECB US$", `${fmtTn(L.cbUsd)} · ${fmtPct(L.cbUsd12)} 12m`],
            ["US M2", `${fmtPct(L.m2_12)} 12m`],
            ["Composite", fmtSig(L.comp)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="text-xs text-muted">
        <span className="font-medium text-foreground/80">How it’s drawn:</span> US net liquidity = Fed assets − Treasury
        account − reverse repo; Fed+ECB adds ECB assets in US$ (fixed FX holds the 2015 average
        {data?.fixedEurUsd ? ` of ${data.fixedEurUsd.toFixed(3)} US$/€` : ""}); composite = half each of the fixed-FX and net liquidity
        12-month growth, scored against the last 5 years. Growth rates and US$ conversion are our calculations.
      </p>
      <p className="text-xs font-medium text-foreground/80">Context, not a timing signal.</p>

      <details className="rounded-lg border border-border/70 bg-card p-3 text-xs">
        <summary className="cursor-pointer font-medium text-accent">Sources and credits</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Series</th>
                <th className="py-1 pr-3 font-medium">Source</th>
                <th className="py-1 pr-3 font-medium">Updates</th>
                <th className="py-1 font-medium">Terms</th>
              </tr>
            </thead>
            <tbody className="text-foreground/85">
              {[
                ["Fed total assets (WALCL)", "Federal Reserve H.4.1", "Weekly", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
                ["Treasury General Account (WTREGEN)", "Federal Reserve H.4.1", "Weekly", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
                ["Overnight reverse repo (RRPONTSYD)", "Federal Reserve Bank of New York", "Daily", "NY Fed terms (reuse with attribution)", "https://www.newyorkfed.org/privacy/termsofuse"],
                ["Eurosystem total assets (ECBASSETSW)", "European Central Bank", "Weekly", "ECB copyright, free reuse with source cited", "https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html"],
                ["US$ per euro (DEXUSEU)", "Federal Reserve H.10", "Daily", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
                ["US M2 (M2SL)", "Federal Reserve H.6", "Monthly", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
              ].map(([s, src, f, t, href]) => (
                <tr key={s} className="border-t border-border/50">
                  <td className="py-1.5 pr-3">{s}</td>
                  <td className="py-1.5 pr-3">{src}</td>
                  <td className="py-1.5 pr-3">{f}</td>
                  <td className="py-1.5">
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{t}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-muted">
          All series via FRED®, Federal Reserve Bank of St. Louis (
          <a href="https://fred.stlouisfed.org/legal/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">terms</a>
          ). Source: ECB for euro-area data. Bank of Japan assets are left out because its terms don’t allow commercial reuse without permission.
        </p>
      </details>
    </div>
  );
}
