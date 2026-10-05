"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  COMPONENTS,
  ZONES,
  arcFraction,
  arcHeight,
  arcStage,
  blend,
  subScores,
  zoneFor,
  type ComponentKey,
  type RsPayload,
  type RsRow,
} from "@/lib/riskSentiment";

type TfKey = "1Y" | "3Y" | "5Y" | "10Y" | "MAX";
const TIMEFRAMES: { key: TfKey; label: string; years: number | null }[] = [
  { key: "1Y", label: "1Y", years: 1 },
  { key: "3Y", label: "3Y", years: 3 },
  { key: "5Y", label: "5Y", years: 5 },
  { key: "10Y", label: "10Y", years: 10 },
  { key: "MAX", label: "Max", years: null },
];
const DEFAULT_TF: TfKey = "3Y";

/* History chart geometry (viewBox units). */
const W = 920;
const H = 300;
const PAD = { top: 14, right: 16, bottom: 28, left: 40 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

/* Mood arc geometry. */
const AW = 400;
const AH = 182;
const ARC = { x0: 92, x1: 308, base: 148, top: 30 };

const SPX_COLOR = "#5b6b80";

function dayNum(d: string): number {
  return Date.parse(`${d}T00:00:00Z`) / 86_400_000;
}

function cutoff(last: string, years: number): string {
  return `${String(Number(last.slice(0, 4)) - years).padStart(4, "0")}${last.slice(4)}`;
}

const auDay = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const auMonth = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "short", year: "numeric" });

function fmtDay(d: string) {
  return auDay.format(new Date(`${d}T00:00:00Z`));
}
function fmtMonthYear(d: string) {
  return auMonth.format(new Date(`${d}T00:00:00Z`));
}
function prevMonthLabel(d: string) {
  const y = Number(d.slice(0, 4));
  const m = Number(d.slice(5, 7));
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return auMonth.format(new Date(Date.UTC(py, pm - 1, 1)));
}
function ordinal(n: number) {
  const r = Math.round(n);
  const s = r % 100 >= 11 && r % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][r % 10] ?? "th";
  return `${r}${s}`;
}

/** Last index with date ≤ d (rows sorted). */
function indexAtOrBefore(rows: RsRow[], d: string): number {
  let lo = 0;
  let hi = rows.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid]![0] <= d) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function minusDays(d: string, n: number): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);
}

/** Score ~3 months (91 calendar days) earlier, for the arc's rising/falling side. */
function scoreThreeMonthsAgo(rows: RsRow[], d: string): number | null {
  const j = indexAtOrBefore(rows, minusDays(d, 91));
  return j >= 0 ? rows[j]![1] : null;
}

function rawText(key: ComponentKey, r: RsRow): string | null {
  const [d, , px, ddPct, rsiD, rsiW, vix, vixPct, usFng, cryptoFng, trRaw, trPct, btc, re] = r;
  switch (key) {
    case "dd":
      return `${ddPct > -0.005 ? "At high" : `${ddPct.toFixed(1)}% from high`} · SPX ${px.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
    case "rsiW":
      return rsiW == null ? null : `RSI ${rsiW.toFixed(1)}`;
    case "rsiD":
      return rsiD == null ? null : `RSI ${rsiD.toFixed(1)}`;
    case "vix":
      return vix == null || vixPct == null ? null : `VIX ${vix.toFixed(2)} · ${ordinal(vixPct)} pct (5y)`;
    case "usFng":
      return usFng == null ? null : `Score ${usFng}`;
    case "cryptoFng":
      return cryptoFng == null ? null : `Score ${cryptoFng}`;
    case "trends":
      return trRaw == null || trPct == null
        ? null
        : `Interest ${trRaw} (${prevMonthLabel(d)}) · ${ordinal(trPct)} pct (5y)`;
    case "btcCycle":
      return btc == null ? null : `Calendar height ${btc.toFixed(0)}/100`;
    case "reCycle":
      return re == null ? null : `Calendar height ${re.toFixed(0)}/100`;
  }
}

function bellPath(): string {
  const pts: string[] = [];
  for (let i = 0; i <= 80; i++) {
    const f = i / 80;
    const x = ARC.x0 + f * (ARC.x1 - ARC.x0);
    const y = ARC.base - (arcHeight(f) / 100) * (ARC.base - ARC.top);
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}
const BELL_D = bellPath();

function arcPoint(score: number, rising: boolean) {
  const f = arcFraction(score, rising);
  return {
    x: ARC.x0 + f * (ARC.x1 - ARC.x0),
    y: ARC.base - (arcHeight(f) / 100) * (ARC.base - ARC.top),
  };
}

/** Own Adirindin stage labels placed around the bell (not a reproduction of any chart). */
const ARC_LABELS: { text: string; score: number; rising: boolean; anchor: "start" | "middle" | "end"; dx: number; dy: number }[] = [
  { text: "Repair", score: 30, rising: true, anchor: "end", dx: -10, dy: 4 },
  { text: "Grind higher", score: 52, rising: true, anchor: "end", dx: -10, dy: 4 },
  { text: "Hot market", score: 74, rising: true, anchor: "end", dx: -10, dy: 2 },
  { text: "Euphoria-leaning", score: 100, rising: true, anchor: "middle", dx: 0, dy: -12 },
  { text: "Cracks show", score: 74, rising: false, anchor: "start", dx: 10, dy: 2 },
  { text: "Cooling", score: 52, rising: false, anchor: "start", dx: 10, dy: 4 },
  { text: "Unwind", score: 30, rising: false, anchor: "start", dx: 10, dy: 4 },
];

type Picked = { idx: number; row: RsRow };

export function RiskSentimentPanel() {
  const [data, setData] = useState<RsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tf, setTf] = useState<TfKey>(DEFAULT_TF);
  const [showSpx, setShowSpx] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/risk-sentiment");
        const json = (await res.json()) as RsPayload;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) {
          setData({
            ok: false,
            rows: [],
            asOf: null,
            sources: [],
            error: e instanceof Error ? e.message : "Fetch failed",
            generated: new Date().toISOString(),
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

  useEffect(() => setHoverIdx(null), [tf]);

  const allRows = useMemo(() => data?.rows ?? [], [data]);

  const view = useMemo(() => {
    if (allRows.length < 2) return null;
    const last = allRows[allRows.length - 1]![0];
    const meta = TIMEFRAMES.find((t) => t.key === tf)!;
    const from = meta.years == null ? allRows[0]![0] : cutoff(last, meta.years);
    const rows = allRows.filter((r) => r[0] >= from);
    if (rows.length < 2) return null;
    const d0 = dayNum(rows[0]![0]);
    const d1 = dayNum(rows[rows.length - 1]![0]);
    const xs = rows.map((r) => PAD.left + ((dayNum(r[0]) - d0) / Math.max(d1 - d0, 1)) * IW);
    const yOf = (v: number) => PAD.top + ((100 - v) / 100) * IH;

    let score = "";
    let pen = false;
    rows.forEach((r, i) => {
      if (r[1] == null) {
        pen = false;
        return;
      }
      score += `${pen ? "L" : "M"}${xs[i]!.toFixed(1)} ${yOf(r[1]).toFixed(1)}`;
      pen = true;
    });

    // S&P 500 context line on its own log scale (no axis; level shown in the tooltip).
    const logs = rows.map((r) => Math.log(r[2]));
    const lo = Math.min(...logs);
    const hi = Math.max(...logs);
    const spxY = (lv: number) => PAD.top + 6 + (1 - (lv - lo) / Math.max(hi - lo, 1e-9)) * (IH - 12);
    const spx = rows.map((r, i) => `${i ? "L" : "M"}${xs[i]!.toFixed(1)} ${spxY(logs[i]!).toFixed(1)}`).join("");

    // ~5 date ticks
    const ticks: { x: number; label: string }[] = [];
    const n = 5;
    for (let k = 0; k < n; k++) {
      // Evenly spaced in time (older Max rows are weekly, so index spacing would drift).
      const d = new Date((d0 + (k / (n - 1)) * (d1 - d0)) * 86_400_000).toISOString().slice(0, 10);
      ticks.push({ x: PAD.left + (k / (n - 1)) * IW, label: (meta.years ?? 99) <= 1 ? fmtDay(d) : fmtMonthYear(d) });
    }
    return { rows, xs, yOf, score, spx, ticks, d0, d1 };
  }, [allRows, tf]);

  const latest: Picked | null = useMemo(() => {
    if (!allRows.length) return null;
    for (let i = allRows.length - 1; i >= 0; i--) if (allRows[i]![1] != null) return { idx: i, row: allRows[i]! };
    return null;
  }, [allRows]);

  const picked: Picked | null = useMemo(
    () => (view && hoverIdx != null && view.rows[hoverIdx] ? { idx: hoverIdx, row: view.rows[hoverIdx]! } : latest),
    [view, hoverIdx, latest],
  );
  const isScrub = view != null && hoverIdx != null;

  const pickedScore = picked?.row[1] ?? null;
  const pickedZone = pickedScore != null ? zoneFor(pickedScore) : null;
  const prevScore = picked ? scoreThreeMonthsAgo(allRows, picked.row[0]) : null;
  const rising = pickedScore != null && prevScore != null ? pickedScore >= prevScore : true;
  const stage = pickedScore != null ? arcStage(pickedScore, rising) : null;

  const latestScore = latest?.row[1] ?? null;
  const latestPrev = latest ? scoreThreeMonthsAgo(allRows, latest.row[0]) : null;
  const latestRising = latestScore != null && latestPrev != null ? latestScore >= latestPrev : true;

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg || !view) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const local = pt.matrixTransform(ctm.inverse());
      if (local.x < PAD.left - 4 || local.x > W - PAD.right + 4) {
        setHoverIdx(null);
        return;
      }
      // Nearest row by x (xs ascending).
      const xs = view.xs;
      let lo = 0;
      let hi = xs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (xs[mid]! < local.x) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && Math.abs(xs[lo - 1]! - local.x) <= Math.abs(xs[lo]! - local.x)) lo -= 1;
      setHoverIdx(lo);
    },
    [view],
  );

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => pickAt(e.clientX, e.clientY);
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "mouse") e.currentTarget.setPointerCapture(e.pointerId);
    pickAt(e.clientX, e.clientY);
  };
  const onPointerLeave = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse") setHoverIdx(null);
  };
  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (!view) return;
    const last = view.rows.length - 1;
    const step = e.shiftKey ? 20 : 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, (i ?? last) - step));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setHoverIdx((i) => Math.min(last, (i ?? last) + step));
    } else if (e.key === "Escape") {
      setHoverIdx(null);
    }
  };

  // Tooltip anchor in CSS px (CTM-based so it tracks the line under any scaling).
  const tipLeft = useMemo(() => {
    if (!isScrub || !view || hoverIdx == null) return null;
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !wrap || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = view.xs[hoverIdx]!;
    pt.y = 0;
    return pt.matrixTransform(ctm).x - wrap.getBoundingClientRect().left;
  }, [isScrub, view, hoverIdx]);

  const breakdown = useMemo(() => {
    if (!picked) return null;
    const subs = subScores(picked.row);
    const { weight } = blend(subs);
    return COMPONENTS.map((c) => {
      const v = subs[c.key];
      const eff = v == null || weight <= 0 ? 0 : (c.weight / weight) * 100;
      return {
        ...c,
        sub: v,
        eff,
        contrib: v == null ? null : (eff * v) / 100,
        raw: rawText(c.key, picked.row),
      };
    });
  }, [picked]);

  const toggleBtn = "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors";
  const toggleOn = "bg-accent text-white shadow-sm";
  const toggleOff = "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground";

  const curPt = latestScore != null ? arcPoint(latestScore, latestRising) : null;
  const scrubPt = isScrub && pickedScore != null ? arcPoint(pickedScore, rising) : null;

  return (
    <section className="rounded-xl border border-border bg-black p-4 sm:p-6">
      {loading && <p className="py-20 text-center text-sm text-muted">Loading risk &amp; sentiment inputs…</p>}
      {!loading && data && !data.ok && (
        <p className="py-16 text-center text-sm text-red-400">
          {data.error ?? "Could not load the gauge"} — nothing shown rather than guessing.
        </p>
      )}

      {!loading && data?.ok && picked && (
        <>
          {/* Reading + mood arc */}
          <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {isScrub ? "Reading on" : "Latest reading"} · {fmtDay(picked.row[0])}
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <p
                  className="font-mono text-7xl font-semibold leading-none tabular-nums sm:text-8xl"
                  style={{ color: pickedZone?.color ?? "#e8eef4" }}
                >
                  {pickedScore == null ? "—" : Math.round(pickedScore)}
                </p>
                <div className="pb-2">
                  {pickedZone && (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"
                      style={{ color: pickedZone.color, borderColor: `${pickedZone.color}88`, background: `${pickedZone.color}1a` }}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: pickedZone.color }} aria-hidden />
                      {pickedZone.label}
                    </span>
                  )}
                  <p className="mt-2 text-xs text-muted">out of 100 · higher = hotter</p>
                </div>
              </div>
              {pickedZone && <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">{pickedZone.blurb}</p>}
              {stage && (
                <p className="mt-3 text-sm text-foreground">
                  Mood arc: <strong className="font-semibold">{stage.label}</strong>
                  <span className="text-muted">
                    {" "}
                    · {prevScore == null ? "no 3-month comparison" : `${rising ? "up" : "down"} from ${Math.round(prevScore)} three months earlier`}
                  </span>
                </p>
              )}
              {isScrub && (
                <button
                  type="button"
                  onClick={() => setHoverIdx(null)}
                  className="mt-3 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-accent hover:border-accent"
                >
                  Back to latest
                </button>
              )}
            </div>

            <div className="rounded-lg border border-[#1d2633] bg-[#05080c] p-2">
              <svg viewBox={`0 0 ${AW} ${AH}`} className="block w-full" role="img" aria-label="Mood arc: where the score sits by level and three-month direction">
                <title>Mood arc</title>
                <defs>
                  <linearGradient id="rs-arc" x1="0" y1={ARC.base} x2="0" y2={ARC.top} gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={ZONES[0]!.color} />
                    <stop offset="0.3" stopColor={ZONES[1]!.color} />
                    <stop offset="0.5" stopColor={ZONES[2]!.color} />
                    <stop offset="0.7" stopColor={ZONES[3]!.color} />
                    <stop offset="1" stopColor={ZONES[4]!.color} />
                  </linearGradient>
                  <linearGradient id="rs-arc-fill" x1="0" y1={ARC.top} x2="0" y2={ARC.base} gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#ffffff" stopOpacity="0.07" />
                    <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[20, 40, 60, 80].map((v) => {
                  const y = ARC.base - (v / 100) * (ARC.base - ARC.top);
                  return <line key={v} x1={ARC.x0 - 60} x2={ARC.x1 + 60} y1={y} y2={y} stroke="#111a24" strokeDasharray="2 4" />;
                })}
                <line x1={ARC.x0 - 60} x2={ARC.x1 + 60} y1={ARC.base} y2={ARC.base} stroke="#1d2633" />
                <path d={`${BELL_D} L${ARC.x1} ${ARC.base} L${ARC.x0} ${ARC.base} Z`} fill="url(#rs-arc-fill)" />
                <path d={BELL_D} fill="none" stroke="url(#rs-arc)" strokeWidth={3.5} strokeLinecap="round" />
                {/* direction chevrons */}
                <text x={ARC.x0 + 30} y={ARC.base - 2} fill="#3a4558" fontSize={9}>
                  rising ↗
                </text>
                <text x={ARC.x1 - 30} y={ARC.base - 2} fill="#3a4558" fontSize={9} textAnchor="end">
                  ↘ falling
                </text>
                {ARC_LABELS.map((l) => {
                  const p = arcPoint(l.score, l.rising);
                  const active = stage?.label === l.text;
                  return (
                    <text
                      key={`${l.text}-${l.rising}`}
                      x={p.x + l.dx}
                      y={p.y + l.dy}
                      textAnchor={l.anchor}
                      fontSize={10.5}
                      fontWeight={active ? 700 : 500}
                      fill={active ? "#e8eef4" : "#6b7a8f"}
                    >
                      {l.text}
                    </text>
                  );
                })}
                <text
                  x={(ARC.x0 + ARC.x1) / 2}
                  y={ARC.base + 20}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={stage?.label === "Washout" ? 700 : 500}
                  fill={stage?.label === "Washout" ? "#e8eef4" : "#6b7a8f"}
                >
                  Washout ← floor → Washout
                </text>
                {curPt && (
                  <g opacity={scrubPt ? 0.45 : 1}>
                    <circle cx={curPt.x} cy={curPt.y} r={9} fill={zoneFor(latestScore!).color} opacity={0.25} />
                    <circle cx={curPt.x} cy={curPt.y} r={5.5} fill={zoneFor(latestScore!).color} stroke="#000" strokeWidth={2} />
                    {!scrubPt && (
                      <text
                        x={curPt.x + (latestRising ? 13 : -13)}
                        y={curPt.y + 4}
                        textAnchor={latestRising ? "start" : "end"}
                        fontSize={9.5}
                        fontWeight={700}
                        fill="#e8eef4"
                      >
                        Now
                      </text>
                    )}
                  </g>
                )}
                {scrubPt && pickedZone && (
                  <g>
                    <circle cx={scrubPt.x} cy={scrubPt.y} r={6} fill={pickedZone.color} stroke="#fff" strokeWidth={1.5} />
                    <text
                      x={scrubPt.x + (rising ? 13 : -13)}
                      y={scrubPt.y + 4}
                      textAnchor={rising ? "start" : "end"}
                      fontSize={9.5}
                      fontWeight={700}
                      fill="#e8eef4"
                    >
                      {fmtMonthYear(picked.row[0])}
                    </text>
                  </g>
                )}
              </svg>
              <p className="px-2 pb-1 text-[10px] leading-snug text-muted">
                Height = score. Left limb if the score is at or above its level ~3 months earlier, right limb if below.
                Illustrative placement only — the arc does not predict the next stage.
              </p>
            </div>
          </div>

          {/* Zone scale */}
          <div className="mt-6">
            <div className="relative flex h-3 w-full overflow-hidden rounded-full">
              {ZONES.map((z) => (
                <div key={z.key} style={{ width: `${z.max - z.min}%`, background: `${z.color}66` }} title={`${z.label} ${z.min}–${z.max}`} />
              ))}
              {pickedScore != null && (
                <span
                  className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white shadow"
                  style={{ left: `${pickedScore}%` }}
                  aria-hidden
                />
              )}
            </div>
            <div className="mt-1.5 grid grid-cols-5 text-[10px] sm:text-[11px]">
              {ZONES.map((z) => (
                <span key={z.key} className="truncate text-center font-medium" style={{ color: z.color }}>
                  {z.label} <span className="text-muted">{z.min}–{z.max}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Score through time</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm" role="group" aria-label="Timeframe">
                {TIMEFRAMES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`${toggleBtn} ${tf === t.key ? toggleOn : toggleOff}`}
                    aria-pressed={tf === t.key}
                    onClick={() => setTf(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-pressed={showSpx}
                onClick={() => setShowSpx((s) => !s)}
                className={`${toggleBtn} border border-border/90 ${showSpx ? "bg-white/10 text-foreground" : "text-muted hover:text-foreground"}`}
              >
                S&amp;P 500 overlay
              </button>
            </div>
          </div>

          {/* History chart */}
          {view && (
            <div ref={wrapRef} className="relative mt-3">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="block w-full cursor-crosshair touch-none select-none outline-none focus-visible:ring-1 focus-visible:ring-accent"
                role="img"
                tabIndex={0}
                aria-label="Risk and sentiment score history. Hover, drag or use arrow keys to scrub."
                onPointerMove={onPointerMove}
                onPointerDown={onPointerDown}
                onPointerLeave={onPointerLeave}
                onKeyDown={onKeyDown}
              >
                <title>Risk &amp; sentiment score history</title>
                <defs>
                  <linearGradient id="rs-line" x1="0" y1={view.yOf(0)} x2="0" y2={view.yOf(100)} gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor={ZONES[0]!.color} />
                    <stop offset="0.2" stopColor={ZONES[0]!.color} />
                    <stop offset="0.3" stopColor={ZONES[1]!.color} />
                    <stop offset="0.5" stopColor={ZONES[2]!.color} />
                    <stop offset="0.7" stopColor={ZONES[3]!.color} />
                    <stop offset="0.85" stopColor={ZONES[4]!.color} />
                    <stop offset="1" stopColor={ZONES[4]!.color} />
                  </linearGradient>
                </defs>
                {ZONES.map((z) => (
                  <rect
                    key={z.key}
                    x={PAD.left}
                    y={view.yOf(z.max)}
                    width={IW}
                    height={view.yOf(z.min) - view.yOf(z.max)}
                    fill={z.color}
                    opacity={0.07}
                  />
                ))}
                {[0, 20, 40, 60, 80, 100].map((v) => (
                  <g key={v}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={view.yOf(v)} y2={view.yOf(v)} stroke="#1a2230" />
                    <text x={PAD.left - 8} y={view.yOf(v) + 3} textAnchor="end" fontSize={10} fill="#8b9bb4">
                      {v}
                    </text>
                  </g>
                ))}
                {showSpx && <path d={view.spx} fill="none" stroke={SPX_COLOR} strokeWidth={1.2} opacity={0.8} />}
                <path d={view.score} fill="none" stroke="url(#rs-line)" strokeWidth={2} strokeLinejoin="round" />
                {view.ticks.map((t, i) => (
                  <text
                    key={i}
                    x={t.x}
                    y={H - 9}
                    fontSize={10}
                    fill="#8b9bb4"
                    textAnchor={i === 0 ? "start" : i === view.ticks.length - 1 ? "end" : "middle"}
                  >
                    {t.label}
                  </text>
                ))}
                {isScrub && hoverIdx != null && view.rows[hoverIdx] && (
                  <g pointerEvents="none">
                    <line
                      x1={view.xs[hoverIdx]}
                      x2={view.xs[hoverIdx]}
                      y1={PAD.top}
                      y2={H - PAD.bottom}
                      stroke="#c8d0dc"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    {view.rows[hoverIdx]![1] != null && (
                      <circle
                        cx={view.xs[hoverIdx]}
                        cy={view.yOf(view.rows[hoverIdx]![1]!)}
                        r={4.5}
                        fill={zoneFor(view.rows[hoverIdx]![1]!).color}
                        stroke="#000"
                        strokeWidth={1.5}
                      />
                    )}
                  </g>
                )}
              </svg>
              {isScrub && tipLeft != null && picked && (
                <div
                  className="pointer-events-none absolute top-3 z-10 min-w-[150px] rounded-md border border-border/80 bg-[#121820]/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
                  style={{ left: `clamp(8px, ${tipLeft + 12}px, calc(100% - 178px))` }}
                >
                  <p className="text-[11px] font-semibold text-[#e8eef7]">{fmtDay(picked.row[0])}</p>
                  <p className="mt-1 flex justify-between gap-3 text-[11px] tabular-nums">
                    <span className="text-muted">Score</span>
                    <span className="font-mono font-semibold" style={{ color: pickedZone?.color }}>
                      {pickedScore == null ? "—" : pickedScore.toFixed(1)}
                    </span>
                  </p>
                  <p className="text-[11px]" style={{ color: pickedZone?.color }}>
                    {pickedZone?.label}
                  </p>
                  {showSpx && (
                    <p className="mt-1 flex justify-between gap-3 text-[11px] tabular-nums">
                      <span className="text-muted">S&amp;P 500</span>
                      <span className="font-mono text-[#c8d0dc]">
                        {picked.row[2].toLocaleString("en-AU", { maximumFractionDigits: 2 })}
                      </span>
                    </p>
                  )}
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted">
                Hover, drag (touch) or focus and use ← → to scrub — the big number, mood arc and breakdown follow.
                {showSpx ? " Grey line: S&P 500 close on its own log scale, for context only." : ""}
                {tf === "MAX" ? " Before 2016 the blend has fewer inputs (see coverage); rows older than 10 years are weekly." : ""}
              </p>
            </div>
          )}

          {/* Breakdown */}
          {breakdown && (
            <div className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
                  What&apos;s inside · {fmtDay(picked.row[0])}
                </h2>
                <span className="text-[11px] text-muted">Weights re-scale over inputs that have data that day</span>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-[#1d2633]">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-[#0b1017] text-[10px] uppercase tracking-[0.12em] text-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Input</th>
                      <th className="px-3 py-2 font-semibold">Reading</th>
                      <th className="px-3 py-2 font-semibold">Sub-score (0–100)</th>
                      <th className="px-3 py-2 text-right font-semibold">Weight</th>
                      <th className="px-3 py-2 text-right font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((b) => (
                      <tr key={b.key} className="border-t border-[#141c27]">
                        <td className="px-3 py-2">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.sub == null ? "#3a4558" : b.color }} aria-hidden />
                            <span className={b.sub == null ? "text-muted" : "text-foreground"}>{b.short}</span>
                            <span className="text-[10px] text-muted/70">{b.group}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted">{b.raw ?? <span className="italic text-muted/60">pending · no data for this date</span>}</td>
                        <td className="px-3 py-2">
                          {b.sub == null ? (
                            <span className="text-muted/60">—</span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <span className="relative h-1.5 w-28 overflow-hidden rounded-full bg-[#141c27]">
                                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${b.sub}%`, background: b.color }} />
                              </span>
                              <span className="font-mono tabular-nums text-foreground">{b.sub.toFixed(0)}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-muted">
                          {b.weight}%{b.sub != null && Math.abs(b.eff - b.weight) > 0.05 ? <span className="text-muted/70"> → {b.eff.toFixed(1)}%</span> : null}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                          {b.contrib == null ? "—" : b.contrib.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-[#243041] bg-[#0b1017]">
                      <td className="px-3 py-2 font-semibold text-foreground" colSpan={4}>
                        Composite score
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums" style={{ color: pickedZone?.color }}>
                        {pickedScore == null ? "—" : pickedScore.toFixed(1)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Source status */}
          <div className="mt-6 flex flex-wrap gap-2">
            {data.sources.map((s) => (
              <span
                key={s.key}
                title={s.note}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                  s.origin === "live"
                    ? "border-[#2b6b4f] text-[#3dcc9a]"
                    : s.origin === "snapshot"
                      ? "border-[#6b5a2b] text-[#fbbf24]"
                      : "border-[#3a4558] text-muted"
                }`}
              >
                {s.label} · {s.origin === "missing" ? "pending" : `${s.origin} · ${s.from ?? "?"} → ${s.asOf ?? "?"}`}
              </span>
            ))}
          </div>
          {data.warnings?.length ? (
            <p className="mt-2 text-[11px] text-muted/80">Feed notes: {data.warnings.join("; ")}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
