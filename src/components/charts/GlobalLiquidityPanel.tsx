"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { DeskTag } from "@/components/home/DeskTag";
import { StoredCopyTag, fmtStoredDate } from "@/components/ui/StoredCopyTag";
import { lastRocTurn, type LiqPayload, type LiqRow, type LineKey } from "@/lib/globalLiquidity";

type Tf = "5Y" | "10Y" | "20Y" | "ALL";
type Roc = "g12" | "g6";

const LINES: Array<{ key: LineKey; label: string; short: string; color: string }> = [
  { key: "cbUsd", label: "Fed+ECB (US$)", short: "Fed+ECB US$", color: "#60a5fa" },
  { key: "netliq", label: "US net liquidity", short: "US net liq.", color: "#f59e0b" },
  { key: "m2", label: "US M2", short: "US M2", color: "#94a3b8" },
  { key: "cbFx", label: "Fed+ECB (fixed FX)", short: "Fed+ECB fixed FX", color: "#a78bfa" },
];
const TFS: Tf[] = ["5Y", "10Y", "20Y", "ALL"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonth = (d: string) => `${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const fmtPct = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`);
const fmtTn = (v: number | null | undefined) => (v == null ? "—" : `US$${v >= 10 ? v.toFixed(1) : v.toFixed(2)}tn`);

function niceTicks(lo: number, hi: number, n = 5): number[] {
  const span = hi - lo || 1;
  const mag = 10 ** Math.floor(Math.log10(span / n));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 1) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}
function logTicks(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)) - 1; e <= Math.ceil(Math.log10(hi)); e++)
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= lo * 0.999 && v <= hi * 1.001) out.push(Number(v.toPrecision(3)));
    }
  return out;
}

function useWidth(dep: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(900);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(300, Math.round(el.clientWidth)));
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => ro.disconnect();
  }, [dep]);
  return [ref, w] as const;
}

export function GlobalLiquidityPanel() {
  const [data, setData] = useState<LiqPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [tf, setTf] = useState<Tf>("ALL");
  const [log, setLog] = useState(false);
  const [roc, setRoc] = useState<Roc>("g12");
  const [on, setOn] = useState<Record<LineKey, boolean>>({ cbUsd: true, netliq: true, m2: false, cbFx: false });
  const [zoom, setZoom] = useState<{ a: string; b: string } | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [sel, setSel] = useState<{ x0: number; x1: number } | null>(null);
  const dragRef = useRef<{ startX: number; svg: SVGSVGElement } | null>(null);
  const [wrapRef, W] = useWidth(data);

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

  const narrow = W < 560;
  const H = narrow ? 280 : 380;
  const H2 = narrow ? 170 : 200;
  const PAD_L = narrow ? 40 : 52;
  const PAD_R = narrow ? 56 : 76;
  const PAD_T = 12;
  const PAD_B = 24;

  const shown = LINES.filter((l) => on[l.key]);

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (!all.length || !shown.length) return [] as LiqRow[];
    const first = all.findIndex((r) => shown.some((l) => r[l.key] != null));
    let r = all.slice(Math.max(0, first));
    const lastD = r[r.length - 1]!.d;
    if (tf !== "ALL") {
      const yrs = Number(tf.replace("Y", ""));
      const from = `${Number(lastD.slice(0, 4)) - yrs}${lastD.slice(4)}`;
      r = r.filter((x) => x.d >= from);
    }
    if (zoom) r = r.filter((x) => x.d >= zoom.a && x.d <= zoom.b);
    return r;
  }, [data, tf, zoom, shown]);

  const n = rows.length;
  const x = useCallback((i: number) => PAD_L + (n > 1 ? i / (n - 1) : 0) * (W - PAD_L - PAD_R), [n, W, PAD_L, PAD_R]);

  const xTicks = useMemo(() => {
    if (n < 2) return [];
    const years = [...new Set(rows.map((r) => r.d.slice(0, 4)))];
    if (years.length < 2) return rows.filter((_, i) => i % Math.max(1, Math.ceil(n / 5)) === 0).map((r) => ({ x: x(rows.indexOf(r)), label: fmtMonth(r.d) }));
    const steps = [1, 2, 5, 10, 20];
    const every = steps.find((s) => years.length / s <= (narrow ? 5 : 10)) ?? 20;
    return rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.d.slice(5) === "01" && Number(r.d.slice(0, 4)) % every === 0)
      .map(({ r, i }) => ({ x: x(i), label: r.d.slice(0, 4) }));
  }, [rows, n, x, narrow]);

  const main = useMemo(() => {
    if (n < 2) return null;
    const vals = rows.flatMap((r) => shown.map((l) => r[l.key])).filter((v): v is number => v != null && v > 0);
    if (!vals.length) return null;
    const vMin = Math.min(...vals);
    const vMax = Math.max(...vals);
    const lo = log ? vMin / 1.15 : 0;
    const hi = log ? vMax * 1.15 : vMax * 1.08;
    const f = (v: number) => (log ? Math.log(v) : v);
    const y = (v: number) => PAD_T + (1 - (f(v) - f(lo)) / (f(hi) - f(lo))) * (H - PAD_T - PAD_B);
    const ticks = log ? logTicks(lo, hi) : niceTicks(lo, hi, narrow ? 4 : 6);
    return { y, ticks };
  }, [rows, n, shown, log, H, narrow]);

  const rocChart = useMemo(() => {
    if (n < 2) return null;
    const vals = rows.flatMap((r) => shown.map((l) => r[roc][l.key])).filter((v): v is number => v != null);
    if (!vals.length) return null;
    let lo = Math.min(0, ...vals);
    let hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad;
    hi += pad;
    const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H2 - PAD_T - PAD_B);
    return { y, ticks: niceTicks(lo, hi, narrow ? 3 : 4) };
  }, [rows, n, shown, roc, H2, narrow]);

  const pathFor = (get: (r: LiqRow) => number | null, y: (v: number) => number) => {
    let d = "";
    let pen = false;
    rows.forEach((r, i) => {
      const v = get(r);
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const ends = (get: (r: LiqRow, k: LineKey) => number | null, y: (v: number) => number) => {
    const e = shown
      .map((l) => {
        for (let i = n - 1; i >= 0; i--) {
          const v = get(rows[i]!, l.key);
          if (v != null) return { ...l, v, y: y(v) };
        }
        return null;
      })
      .filter((v): v is NonNullable<typeof v> => v != null)
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < e.length; i++) if (e[i]!.y - e[i - 1]!.y < 12) e[i]!.y = e[i - 1]!.y + 12;
    return e;
  };

  const idxAt = (svg: SVGSVGElement, clientX: number) => {
    const r = svg.getBoundingClientRect();
    const sx = ((clientX - r.left) / r.width) * W;
    const f = (sx - PAD_L) / (W - PAD_L - PAD_R);
    return { sx: Math.min(Math.max(sx, PAD_L), W - PAD_R), i: Math.min(n - 1, Math.max(0, Math.round(f * (n - 1)))) };
  };
  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const { sx, i } = idxAt(e.currentTarget, e.clientX);
    setHoverIdx(i);
    if (e.pointerType !== "touch") {
      dragRef.current = { startX: sx, svg: e.currentTarget };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const { sx, i } = idxAt(e.currentTarget, e.clientX);
    setHoverIdx(i);
    if (dragRef.current) setSel({ x0: dragRef.current.startX, x1: sx });
  };
  const onUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setSel(null);
    if (!drag) return;
    const { sx } = idxAt(drag.svg, e.clientX);
    if (Math.abs(sx - drag.startX) < 6) return;
    const lo = Math.min(sx, drag.startX);
    const hi = Math.max(sx, drag.startX);
    const ia = Math.round(((lo - PAD_L) / (W - PAD_L - PAD_R)) * (n - 1));
    const ib = Math.round(((hi - PAD_L) / (W - PAD_L - PAD_R)) * (n - 1));
    if (ib - ia >= 3) setZoom({ a: rows[ia]!.d, b: rows[ib]!.d });
  };
  const resetZoom = () => {
    setZoom(null);
    setHoverIdx(null);
  };
  useEffect(() => setHoverIdx(null), [zoom, tf]);

  const svgProps = (label: string) => ({
    className: "block w-full cursor-crosshair touch-none select-none",
    role: "img" as const,
    "aria-label": label,
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
    onPointerLeave: (e: ReactPointerEvent<SVGSVGElement>) => {
      if (!dragRef.current && e.pointerType !== "touch") setHoverIdx(null);
    },
    onDoubleClick: resetZoom,
  });

  const hp = hoverIdx != null ? rows[hoverIdx] : null;
  const L = data?.latest;
  const turns = data?.rows ? shown.map((l) => ({ l, t: lastRocTurn(data.rows!, l.key, roc) })).filter((t) => t.t) : [];

  const btn = "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors";
  const btnOn = "bg-accent text-white shadow-sm";
  const btnOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";
  const group = "inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#11161d] p-1";

  const readout = (kind: "level" | "roc", y: (v: number) => number) =>
    hp && hoverIdx != null ? (
      <div
        data-testid={`liq-readout-${kind}`}
        className="pointer-events-none absolute z-10 w-[188px] rounded-md border border-border/80 bg-[#0b0f14]/95 px-2.5 py-2 text-[11px] shadow-lg"
        style={{ left: `clamp(4px, calc(${(x(hoverIdx) / W) * 100}% + 12px), calc(100% - 192px))`, top: 6 }}
      >
        <p className="font-semibold text-[#e8eef7]">{fmtMonth(hp.d)}</p>
        {shown.map((l) => {
          const v = kind === "level" ? hp[l.key] : hp[roc][l.key];
          return (
            <p key={l.key} className="mt-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} aria-hidden />
                {l.short}
              </span>
              <span className="font-mono" style={{ color: l.color }}>
                {kind === "level" ? fmtTn(v) : fmtPct(v)}
              </span>
            </p>
          );
        })}
        {void y}
      </div>
    ) : null;

  const crosshair = (h: number, y: (v: number) => number, get: (r: LiqRow, k: LineKey) => number | null) =>
    hp && hoverIdx != null ? (
      <g pointerEvents="none">
        <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD_T} y2={h - PAD_B} stroke="#9eb0c8" strokeDasharray="3 3" opacity={0.8} />
        {shown.map((l) => {
          const v = get(hp, l.key);
          return v == null ? null : <circle key={l.key} cx={x(hoverIdx)} cy={y(v)} r={3.2} fill={l.color} stroke="#000" strokeWidth={1.2} />;
        })}
      </g>
    ) : null;

  const xAxis = (h: number) =>
    xTicks.map((t) => (
      <text key={`x${t.label}`} x={t.x} y={h - 7} textAnchor="middle" fill="#6b7785" fontSize={10}>
        {t.label}
      </text>
    ));
  const selRect = (h: number) =>
    sel && Math.abs(sel.x1 - sel.x0) > 1 ? (
      <rect x={Math.min(sel.x0, sel.x1)} y={PAD_T} width={Math.abs(sel.x1 - sel.x0)} height={h - PAD_T - PAD_B} fill="#60a5fa" opacity={0.12} stroke="#60a5fa" strokeOpacity={0.5} pointerEvents="none" />
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {data?.stored ? <StoredCopyTag to={data.storedTo} /> : data ? <DeskTag kind="live" /> : null}
        {data?.lastObs?.WALCL ? <span className="text-[11px] text-muted">Fed data to {fmtStoredDate(data.lastObs.WALCL)}</span> : null}
      </div>

      {L && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-black/40 p-3 text-xs sm:grid-cols-4">
          {[
            ["Fed+ECB (US$)", `${fmtTn(L.cbUsd)} · ${fmtPct(L.cbUsd12)} 12m`],
            ["US net liquidity", `${fmtTn(L.netliq)} · ${fmtPct(L.netliq12)} 12m`],
            ["US M2", `${fmtTn(L.m2)} · ${fmtPct(L.m2_12)} 12m`],
            ["Fed+ECB (fixed FX)", `${fmtPct(L.cbFx12)} 12m`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className={group} role="group" aria-label="Timeframe">
            {TFS.map((t) => (
              <button key={t} type="button" className={`${btn} ${tf === t ? btnOn : btnOff}`} aria-pressed={tf === t} onClick={() => { setTf(t); setZoom(null); }}>
                {t}
              </button>
            ))}
          </div>
          <div className={group} role="group" aria-label="Scale">
            {(["Linear", "Log"] as const).map((s) => (
              <button key={s} type="button" className={`${btn} ${(s === "Log") === log ? btnOn : btnOff}`} aria-pressed={(s === "Log") === log} onClick={() => setLog(s === "Log")}>
                {s}
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
            const active = on[l.key];
            return (
              <button
                key={l.key}
                type="button"
                aria-pressed={active}
                onClick={() => setOn((o) => ({ ...o, [l.key]: !o[l.key] }))}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
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
          {data && !shown.length && <p className="py-24 text-center text-sm text-muted">Turn on a line above.</p>}
          {main && (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} {...svgProps("Global liquidity level chart. Hover or tap for values; drag to zoom.")}>
                <rect x={0} y={0} width={W} height={H} fill="#000" />
                {main.ticks.map((v) => (
                  <g key={`y${v}`}>
                    <line x1={PAD_L} x2={W - PAD_R} y1={main.y(v)} y2={main.y(v)} stroke="#1a222c" />
                    <text x={PAD_L - 6} y={main.y(v) + 3} textAnchor="end" fill="#6b7785" fontSize={10}>
                      {v}
                    </text>
                  </g>
                ))}
                <text x={PAD_L - 6} y={PAD_T - 2} textAnchor="end" fill="#6b7785" fontSize={9}>US$tn</text>
                {shown.map((l) => (
                  <path key={l.key} d={pathFor((r) => r[l.key], main.y)} fill="none" stroke={l.color} strokeWidth={1.7} strokeLinejoin="round" />
                ))}
                {ends((r, k) => r[k], main.y).map((e) => (
                  <text key={`e${e.key}`} x={W - PAD_R + 5} y={e.y + 3} fill={e.color} fontSize={10} fontWeight={600}>
                    {e.v.toFixed(e.v >= 10 ? 1 : 2)}tn
                  </text>
                ))}
                {xAxis(H)}
                {selRect(H)}
                {crosshair(H, main.y, (r, k) => r[k])}
              </svg>
              {readout("level", main.y)}
            </>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          US$ trillion, month-end. {narrow ? "Tap for values." : "Drag to zoom, double-click to reset."}
        </p>
      </section>

      <section className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Rate of change</h2>
          <div className={group} role="group" aria-label="Rate of change period">
            {(
              [
                ["g12", "12m"],
                ["g6", "6m"],
              ] as const
            ).map(([k, lab]) => (
              <button key={k} type="button" className={`${btn} ${roc === k ? btnOn : btnOff}`} aria-pressed={roc === k} onClick={() => setRoc(k)}>
                {lab}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">
          {roc === "g12" ? "Change over the past 12 months" : "Change over the past 6 months, annualised"}: above zero means the line above is growing, below zero means it is shrinking.
        </p>
        <div className="relative mt-3 w-full">
          {rocChart && (
            <>
              <svg viewBox={`0 0 ${W} ${H2}`} width={W} height={H2} {...svgProps("Rate of change chart. Hover or tap for values.")}>
                <rect x={0} y={0} width={W} height={H2} fill="#000" />
                {rocChart.ticks.map((v) => (
                  <g key={`r${v}`}>
                    <line x1={PAD_L} x2={W - PAD_R} y1={rocChart.y(v)} y2={rocChart.y(v)} stroke="#1a222c" />
                    <text x={PAD_L - 6} y={rocChart.y(v) + 3} textAnchor="end" fill="#6b7785" fontSize={10}>
                      {v}%
                    </text>
                  </g>
                ))}
                <line x1={PAD_L} x2={W - PAD_R} y1={rocChart.y(0)} y2={rocChart.y(0)} stroke="#8b95a5" strokeDasharray="4 4" />
                {shown.map((l) => (
                  <path key={l.key} d={pathFor((r) => r[roc][l.key], rocChart.y)} fill="none" stroke={l.color} strokeWidth={1.5} strokeLinejoin="round" />
                ))}
                {ends((r, k) => r[roc][k], rocChart.y).map((e) => (
                  <text key={`re${e.key}`} x={W - PAD_R + 5} y={e.y + 3} fill={e.color} fontSize={10} fontWeight={600}>
                    {fmtPct(e.v)}
                  </text>
                ))}
                {xAxis(H2)}
                {selRect(H2)}
                {crosshair(H2, rocChart.y, (r, k) => r[roc][k])}
              </svg>
              {readout("roc", rocChart.y)}
            </>
          )}
        </div>
        {turns.length ? (
          <ul className="mt-2 space-y-0.5 text-xs text-foreground/80" data-testid="liq-turns">
            {turns.map(({ l, t }) => (
              <li key={l.key}>
                <span style={{ color: l.color }}>{l.label}</span>: rate of change turned {t!.dir} in {fmtMonth(t!.d)}
                {t!.monthsAgo > 0 ? ` (${t!.monthsAgo} month${t!.monthsAgo === 1 ? "" : "s"} ago)` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="text-xs text-muted">
        <span className="font-medium text-foreground/80">How it’s drawn:</span> Fed+ECB = Fed total assets plus ECB total
        assets in US$ (fixed FX holds the 2015 average{data?.fixedEurUsd ? ` of ${data.fixedEurUsd.toFixed(3)} US$/€` : ""}); US net liquidity = Fed
        assets − Treasury account − reverse repo. Fed and ECB lines start Dec 2002, US M2 Jan 1959. Growth rates and US$
        conversion are our calculations.
      </p>
      <p className="text-xs font-medium text-foreground/80">Context, not a timing signal.</p>

      <details className="rounded-lg border border-border/70 bg-card p-3 text-xs">
        <summary className="cursor-pointer font-medium text-accent">Sources and credits</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-3 font-medium">Series</th>
                <th className="py-1 pr-3 font-medium">Source</th>
                <th className="py-1 pr-3 font-medium">From</th>
                <th className="py-1 pr-3 font-medium">Updates</th>
                <th className="py-1 font-medium">Terms</th>
              </tr>
            </thead>
            <tbody className="text-foreground/85">
              {[
                ["Fed total assets (WALCL)", "Federal Reserve H.4.1", "Dec 2002", "Weekly", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
                ["Treasury General Account (WTREGEN)", "Federal Reserve H.4.1", "Dec 2002", "Weekly", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
                ["Overnight reverse repo (RRPONTSYD)", "Federal Reserve Bank of New York", "Feb 2003", "Daily", "NY Fed terms (reuse with attribution)", "https://www.newyorkfed.org/privacy/termsofuse"],
                ["Eurosystem total assets (ECBASSETSW)", "European Central Bank", "Jan 1999", "Weekly", "ECB copyright, free reuse with source cited", "https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html"],
                ["US$ per euro (DEXUSEU)", "Federal Reserve H.10", "Jan 1999", "Daily", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
                ["US M2 (M2SL)", "Federal Reserve H.6", "Jan 1959", "Monthly", "Public domain", "https://www.federalreserve.gov/disclaimer.htm"],
              ].map(([s, src, from, f, t, href]) => (
                <tr key={s} className="border-t border-border/50">
                  <td className="py-1.5 pr-3">{s}</td>
                  <td className="py-1.5 pr-3">{src}</td>
                  <td className="py-1.5 pr-3">{from}</td>
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
