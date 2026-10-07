/**
 * Gold-led ~46-year commodity cycle theory schematic (educational diagram).
 * The lap shape is the Market cycles hub gold tile silhouette (goldSilhouette.ts:
 * flat start → steep run-up → sharp correction → spike to the peak → sharp drop →
 * long down-sideways drift), repeated lap after lap. Each lap ends ~58% of the way
 * up, so the next lap starts from there — the same secular uptrend the tile shows.
 * Calendar timing is the tile's: trough zone → peak zone (~26y) → next trough
 * zone (~20y), peaks at Jan 1934 / 1980 / 2026 / 2072*, troughs 20y after each peak.
 * Yellow labels mark the peak / trough zones and the 15 Aug 1971 Nixon Shock.
 * Green Live marker is calendar-dated (computed client-side after mount, re-ticks
 * hourly / on tab focus). No price data on this chart — shape only · NFA.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GOLD_ANCHOR_NOTES,
  GOLD_CYCLE_YEARS,
  GOLD_HISTORICAL_POINTS,
  GOLD_PEAK_ANCHORS,
  GOLD_TROUGH_FRAC,
  GOLD_TROUGH_NOTES,
  GOLD_TROUGH_OFFSET_YEARS,
  goldCycleProgress,
  goldLivePhaseLine,
  isTheoreticalGoldYear,
  janMs,
} from "@/lib/goldCommodityCycle";
import {
  GOLD_TILE_END_LOW,
  GOLD_TILE_START_LOW,
  goldTileUnit,
  goldTileX,
} from "@/lib/cycles/goldSilhouette";
import { useLiveNow } from "@/lib/useLiveNow";

type Pt = { x: number; y: number };

const SVG_W = 820;
const SVG_H = 500;

/** Plot extents (SVG units). */
const X_LEFT = 52;
const X_RIGHT = 792;
const Y_TOP = 96;
const Y_BOTTOM = 338;

/** Trough → peak share of the lap (calendar), and the peak's place across the tile shape. */
const PEAK_U = 1 - GOLD_TROUGH_FRAC;
const PEAK_S = goldTileX(PEAK_U);

/**
 * Lap 0 starts at the trough zone before the first locked peak (1934 − 26y).
 * It is only used for geometry — no label is drawn for it.
 */
const LAP0_TROUGH_YEAR =
  GOLD_PEAK_ANCHORS[0] - (GOLD_CYCLE_YEARS - GOLD_TROUGH_OFFSET_YEARS);

/** Visible window in lap units (lap index + s across the tile shape). */
const G_START = 0.27;
const G_END = GOLD_PEAK_ANCHORS.length - 1 + 0.62;

/** Each lap starts where the previous one ended (tile end level). */
const LAP_STEP = GOLD_TILE_END_LOW - GOLD_TILE_START_LOW;

const LINE = "#e8eef7";
const YELLOW = "#ffe14a";
const YELLOW_THEO = "#d9c35a";
const LIVE_GREEN = "#3dcc9a";

function valueAt(g: number): number {
  const k = Math.floor(g);
  const s = g - k;
  return k * LAP_STEP + goldTileUnit(s);
}

/** Visible value range (sampled once). */
const V_RANGE = (() => {
  let lo = Infinity;
  let hi = -Infinity;
  const n = 1200;
  for (let i = 0; i <= n; i++) {
    const g = G_START + (i / n) * (G_END - G_START);
    const v = valueAt(Math.min(g, G_END - 1e-9));
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return { lo, hi };
})();

function xOf(g: number): number {
  return X_LEFT + ((g - G_START) / (G_END - G_START)) * (X_RIGHT - X_LEFT);
}

function yOf(v: number): number {
  return Y_BOTTOM - ((v - V_RANGE.lo) / Math.max(V_RANGE.hi - V_RANGE.lo, 1e-9)) * (Y_BOTTOM - Y_TOP);
}

function ptAt(g: number): Pt {
  // Lap boundaries belong to the next lap's start (same height by construction).
  return { x: xOf(g), y: yOf(valueAt(g)) };
}

const LINE_PATH = (() => {
  const parts: string[] = [];
  const n = 1400;
  for (let i = 0; i <= n; i++) {
    const g = G_START + (i / n) * (G_END - G_START);
    const p = ptAt(Math.min(g, G_END - 1e-9));
    parts.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  return parts.join(" ");
})();

const FILL_PATH = `${LINE_PATH} L ${X_RIGHT} ${Y_BOTTOM + 8} L ${X_LEFT} ${Y_BOTTOM + 8} Z`;

/** Fractional calendar year (UTC), same convention as goldCommodityCycle.ts. */
function fracYear(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  const start = janMs(year);
  return year + (ms - start) / Math.max(janMs(year + 1) - start, 1);
}

/** Calendar year → lap units (lap index + s across the tile shape). */
function gOfYear(y: number): number {
  const lapsFromStart = (y - LAP0_TROUGH_YEAR) / GOLD_CYCLE_YEARS;
  const k = Math.floor(lapsFromStart);
  const u = lapsFromStart - k;
  return k + goldTileX(u);
}

type PeakMarker = { year: number; g: number; theo: boolean; note: string };
type TroughMarker = { year: number; g: number; theo: boolean; note: string };

const PEAKS: PeakMarker[] = GOLD_PEAK_ANCHORS.map((year, k) => ({
  year,
  g: k + PEAK_S,
  theo: isTheoreticalGoldYear(year),
  note: GOLD_ANCHOR_NOTES[year] ?? "",
})).filter((m) => m.g >= G_START && m.g <= G_END);

const TROUGHS: TroughMarker[] = Object.keys(GOLD_TROUGH_NOTES)
  .map(Number)
  .sort((a, b) => a - b)
  .map((year) => ({
    year,
    g: (year - LAP0_TROUGH_YEAR) / GOLD_CYCLE_YEARS,
    theo: isTheoreticalGoldYear(year),
    note: GOLD_TROUGH_NOTES[year] ?? "",
  }))
  .filter((m) => m.g >= G_START && m.g <= G_END);

const HISTORICAL = GOLD_HISTORICAL_POINTS.map((h) => ({
  ...h,
  g: gOfYear(fracYear(h.t)),
})).filter((h) => h.g >= G_START && h.g <= G_END);

const liveDayLabel = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Australia/Melbourne",
});

function SpanArrow({ x1, x2, y, label, fs }: { x1: number; x2: number; y: number; label: string; fs: number }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#5a6a80" strokeWidth="1.25" />
      <path d={`M ${x1 + 6} ${y - 4} L ${x1} ${y} L ${x1 + 6} ${y + 4}`} fill="none" stroke="#5a6a80" strokeWidth="1.25" />
      <path d={`M ${x2 - 6} ${y - 4} L ${x2} ${y} L ${x2 - 6} ${y + 4}`} fill="none" stroke="#5a6a80" strokeWidth="1.25" />
      <text
        x={(x1 + x2) / 2}
        y={y - 6}
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize={9 * fs}
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
}

export default function GoldCycleChart() {
  const nowMs = useLiveNow();
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** Phones: bigger on-chart labels so the yellow dates stay readable. */
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setNarrow(w > 0 && w < 560);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fs = narrow ? 1.6 : 1;

  const live = useMemo(() => {
    if (nowMs == null) return null;
    const { priorPeak, frac } = goldCycleProgress(nowMs);
    // Same lap mapping as the hub tile: trough-lap position u → tile s.
    const u = (frac - GOLD_TROUGH_FRAC + 1) % 1;
    const troughYear =
      frac < GOLD_TROUGH_FRAC
        ? priorPeak - (GOLD_CYCLE_YEARS - GOLD_TROUGH_OFFSET_YEARS)
        : priorPeak + GOLD_TROUGH_OFFSET_YEARS;
    const k = Math.round((troughYear - LAP0_TROUGH_YEAR) / GOLD_CYCLE_YEARS);
    const g = k + goldTileX(u);
    if (g < G_START || g > G_END) return null;
    return { ...ptAt(g), phaseLine: goldLivePhaseLine(nowMs) };
  }, [nowMs]);

  // Lap span arrow: the observed 2000 trough → theoretical 2046 trough.
  const spanFrom = TROUGHS.find((t) => !t.theo && t.year >= 2000) ?? TROUGHS[0];
  const spanTo = spanFrom ? TROUGHS.find((t) => t.year === spanFrom.year + GOLD_CYCLE_YEARS) : undefined;
  const spanPeak = spanFrom ? PEAKS.find((p) => p.year === spanFrom.year + (GOLD_CYCLE_YEARS - GOLD_TROUGH_OFFSET_YEARS)) : undefined;

  const labelFs = 10.5 * fs;

  return (
    <div ref={boxRef} className="relative mt-6 w-full">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Gold-led ~${GOLD_CYCLE_YEARS}-year commodity cycle theory schematic — the hub tile's lap shape (flat start, steep run-up, sharp correction, spike to the peak, sharp drop, down-sideways drift) repeated across laps. Yellow labels: peak zones Jan ${GOLD_PEAK_ANCHORS.join(", ")} (2072 theoretical); trough zones about ${TROUGHS.map((t) => t.year).join(", ")} (2046 theoretical); 15 Aug 1971 Nixon Shock. Live marker positioned by today's date. Shape only — no price data, not a predictive model or financial advice`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id="gold-cycle-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gold-cycle-live-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="gold-cycle-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8eef7" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#e8eef7" stopOpacity="0" />
          </linearGradient>
          <style>{`
            @keyframes gold-cycle-live-pulse {
              0% { opacity: 0.55; r: 7; }
              70% { opacity: 0; r: 22; }
              100% { opacity: 0; r: 22; }
            }
            .gold-cycle-live-ring {
              animation: gold-cycle-live-pulse 2.4s ease-out infinite;
              transform-origin: center;
              transform-box: fill-box;
            }
            @media (prefers-reduced-motion: reduce) {
              .gold-cycle-live-ring { animation: none; opacity: 0.35; r: 12; }
            }
          `}</style>
        </defs>

        <rect width={SVG_W} height={SVG_H} fill="#0a0a0a" rx="8" />

        <text
          x={SVG_W / 2}
          y="26"
          textAnchor="middle"
          fill="#e8eef4"
          fontSize={16 * (narrow ? 1.25 : 1)}
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          Gold-led ~{GOLD_CYCLE_YEARS}-year commodity cycle theory
        </text>
        <text
          x={SVG_W / 2}
          y={narrow ? 50 : 44}
          textAnchor="middle"
          fill="#8b9bb4"
          fontSize={10 * (narrow ? 1.35 : 1)}
          fontFamily="system-ui, sans-serif"
        >
          {narrow
            ? "Repeating lap shape · yellow = key dates · * = theoretical · NFA"
            : "Stylised sketch · one lap shape repeating every ~46y · yellow = key dates · * = theoretical · no price data · NFA"}
        </text>

        {/* Faint horizontal guides */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = Y_TOP - 10 + (i * (Y_BOTTOM - Y_TOP + 20)) / 5;
          return (
            <line key={i} x1={X_LEFT - 12} y1={y} x2={X_RIGHT + 8} y2={y} stroke="#1a1a1a" strokeWidth="1" />
          );
        })}

        {/* Peak / trough verticals (dashed, faint) */}
        {PEAKS.map((m) => {
          const p = ptAt(m.g);
          return (
            <line
              key={`pv-${m.year}`}
              x1={p.x}
              y1={p.y + 8}
              x2={p.x}
              y2={Y_BOTTOM + 8}
              stroke="#ef6b6b"
              strokeWidth="1.25"
              strokeDasharray="4 4"
              opacity={m.theo ? 0.35 : 0.55}
            />
          );
        })}
        {TROUGHS.map((m) => {
          const p = ptAt(m.g);
          return (
            <line
              key={`tv-${m.year}`}
              x1={p.x}
              y1={Y_TOP - 10}
              x2={p.x}
              y2={p.y - 6}
              stroke={LIVE_GREEN}
              strokeWidth="1.25"
              strokeDasharray="4 4"
              opacity={m.theo ? 0.3 : 0.5}
            />
          );
        })}

        {/* Historical marker — 15 Aug 1971 (Nixon Shock) */}
        {HISTORICAL.map((h) => {
          const p = ptAt(h.g);
          return (
            <g key={`h-${h.t}`} data-marker="historical">
              <title>{`${h.label} — ${h.note}`}</title>
              <line
                x1={p.x}
                y1={Y_TOP - 18}
                x2={p.x}
                y2={p.y - 6}
                stroke={YELLOW}
                strokeWidth="1.25"
                strokeDasharray="2 3"
                opacity="0.8"
              />
              <text
                x={p.x}
                y={Y_TOP - 34 - (narrow ? 8 : 0)}
                textAnchor="middle"
                fill={YELLOW}
                fontSize={labelFs}
                fontFamily="system-ui, sans-serif"
                fontWeight="700"
              >
                {h.label}
              </text>
              <text
                x={p.x}
                y={Y_TOP - 22}
                textAnchor="middle"
                fill={YELLOW}
                fontSize={8.5 * fs}
                fontFamily="system-ui, sans-serif"
                fontWeight="600"
                opacity="0.85"
              >
                Nixon Shock
              </text>
              <circle cx={p.x} cy={p.y} r={3.5} fill="#0a0a0a" stroke={YELLOW} strokeWidth={1.75} />
            </g>
          );
        })}

        {/* Repeating lap line — soft fill, glowing white line */}
        <path d={FILL_PATH} fill="url(#gold-cycle-fill)" stroke="none" />
        <path
          d={LINE_PATH}
          fill="none"
          stroke={LINE}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#gold-cycle-glow)"
        />

        {/* Peak zones — yellow labels left of each peak (Live sits just right of the 2026 peak) */}
        {PEAKS.map((m) => {
          const p = ptAt(m.g);
          const fill = m.theo ? YELLOW_THEO : YELLOW;
          return (
            <g key={`peak-${m.year}`} data-marker="peak">
              <title>{`Peak zone Jan ${m.year}${m.theo ? " (theoretical)" : ""} — ${m.note}`}</title>
              <circle cx={p.x} cy={p.y} r={4.5} fill="#0a0a0a" stroke={fill} strokeWidth={2.25} />
              <text
                x={p.x - 9}
                y={p.y - 9}
                textAnchor="end"
                fill={fill}
                fontSize={labelFs}
                fontFamily="system-ui, sans-serif"
                fontWeight="700"
                fontStyle={m.theo ? "italic" : undefined}
              >
                {`Jan ${m.year}${m.theo ? "*" : ""}`}
              </text>
              {!narrow ? (
                <text
                  x={p.x - 9}
                  y={p.y + 3}
                  textAnchor="end"
                  fill="#9eb0c8"
                  fontSize="8.5"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                >
                  peak zone
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Trough zones — yellow labels under each trough */}
        {TROUGHS.map((m) => {
          const p = ptAt(m.g);
          const fill = m.theo ? YELLOW_THEO : YELLOW;
          return (
            <g key={`trough-${m.year}`} data-marker="trough">
              <title>{`Trough zone ~${m.year}${m.theo ? " (theoretical)" : ""} — ${m.note}`}</title>
              <circle cx={p.x} cy={p.y} r={4} fill="#0a0a0a" stroke={fill} strokeWidth={2} />
              <text
                x={p.x}
                y={p.y + 20 * (narrow ? 1.25 : 1)}
                textAnchor="middle"
                fill={fill}
                fontSize={labelFs}
                fontFamily="system-ui, sans-serif"
                fontWeight="700"
                fontStyle={m.theo ? "italic" : undefined}
              >
                {`~${m.year}${m.theo ? "*" : ""}`}
              </text>
              {!narrow ? (
                <text
                  x={p.x}
                  y={p.y + 31}
                  textAnchor="middle"
                  fill="#9eb0c8"
                  fontSize="8.5"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                >
                  trough zone
                </text>
              ) : null}
            </g>
          );
        })}

        {spanFrom && spanTo && spanPeak ? (
          <>
            <SpanArrow
              x1={ptAt(spanFrom.g).x + 3}
              x2={ptAt(spanPeak.g).x - 3}
              y={378}
              fs={narrow ? 1.3 : 1}
              label={`~${GOLD_CYCLE_YEARS - GOLD_TROUGH_OFFSET_YEARS}y to peak`}
            />
            <SpanArrow
              x1={ptAt(spanPeak.g).x + 3}
              x2={ptAt(spanTo.g).x - 3}
              y={378}
              fs={narrow ? 1.3 : 1}
              label={`~${GOLD_TROUGH_OFFSET_YEARS}y to trough`}
            />
          </>
        ) : null}

        <text
          x={SVG_W / 2}
          y={408}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize={10 * (narrow ? 1.25 : 1)}
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          {narrow
            ? `One lap shape, repeated every ~${GOLD_CYCLE_YEARS}y · shape only, not a price path`
            : `Same lap shape as the Market cycles tile, repeated every ~${GOLD_CYCLE_YEARS} years · each lap starts where the last one ended · shape only, not a USD price path`}
        </text>
        <text
          x={SVG_W / 2}
          y={424}
          textAnchor="middle"
          fill="#6b7a90"
          fontSize={9 * (narrow ? 1.25 : 1)}
          fontFamily="system-ui, sans-serif"
          fontStyle="italic"
        >
          Peak zones Jan 1934 / 1980 / 2026 / 2072* · trough zones ~20y after each peak · 15 Aug 1971 Nixon Shock
        </text>

        <rect x="40" y="440" width={SVG_W - 80} height="46" rx="6" fill="#121820" stroke="#3a4558" strokeWidth="1" />
        <text
          x={SVG_W / 2}
          y="458"
          textAnchor="middle"
          fill="#d0d8e4"
          fontSize={10 * (narrow ? 1.2 : 1)}
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          Future markers are theoretical: no gold price target for any date.
        </text>
        <text
          x={SVG_W / 2}
          y="474"
          textAnchor="middle"
          fill="#9eb0c8"
          fontSize={9 * (narrow ? 1.2 : 1)}
          fontFamily="system-ui, sans-serif"
        >
          Observational sketch · not a model, not a signal · research / educational only · not financial advice (NFA).
        </text>

        {/* Live pulse — client-computed from today's date (hidden until mounted) */}
        {live ? (
          <g filter="url(#gold-cycle-live-glow)" aria-label="Live position on cycle path" data-live-dot="">
            <title>{`Live · ${liveDayLabel.format(new Date(nowMs as number))} · ${live.phaseLine} · theoretical, NFA`}</title>
            <circle
              className="gold-cycle-live-ring"
              cx={live.x}
              cy={live.y}
              r={7}
              fill="none"
              stroke={LIVE_GREEN}
              strokeWidth="2"
            />
            <circle cx={live.x} cy={live.y} r={5.5} fill={LIVE_GREEN} />
            <circle cx={live.x} cy={live.y} r={2.2} fill="#e8fff4" />
            <rect
              x={live.x + 10}
              y={live.y - 30 * (narrow ? 1.3 : 1)}
              width={34 * (narrow ? 1.4 : 1)}
              height={14 * (narrow ? 1.4 : 1)}
              rx="3"
              fill="#0f2418"
              stroke={LIVE_GREEN}
              strokeWidth="1"
            />
            <text
              x={live.x + 10 + 17 * (narrow ? 1.4 : 1)}
              y={live.y - 30 * (narrow ? 1.3 : 1) + 10 * (narrow ? 1.4 : 1)}
              textAnchor="middle"
              fill="#7dffb0"
              fontSize={9 * (narrow ? 1.4 : 1)}
              fontFamily="system-ui, sans-serif"
              fontWeight="800"
            >
              Live
            </text>
          </g>
        ) : null}
      </svg>

      <p className="mt-3 min-h-[1.25rem] text-center font-mono text-xs text-[#7dffb0]" aria-live="polite">
        {live && nowMs != null
          ? `Live · ${liveDayLabel.format(new Date(nowMs))} · ${live.phaseLine}`
          : "\u00a0"}
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        {PEAKS.map((m) => (
          <div key={`dl-p-${m.year}`} className="flex gap-2">
            <dt className="w-24 shrink-0 font-mono font-semibold" style={{ color: m.theo ? YELLOW_THEO : YELLOW }}>
              Jan {m.year}
              {m.theo ? "*" : ""}
            </dt>
            <dd className="text-[#9eb0c8]">Peak zone — {m.note}</dd>
          </div>
        ))}
        {TROUGHS.map((m) => (
          <div key={`dl-t-${m.year}`} className="flex gap-2">
            <dt className="w-24 shrink-0 font-mono font-semibold" style={{ color: m.theo ? YELLOW_THEO : YELLOW }}>
              ~{m.year}
              {m.theo ? "*" : ""}
            </dt>
            <dd className="text-[#9eb0c8]">Trough zone — {m.note}</dd>
          </div>
        ))}
        {HISTORICAL.map((h) => (
          <div key={`dl-h-${h.t}`} className="flex gap-2">
            <dt className="w-24 shrink-0 font-mono font-semibold" style={{ color: YELLOW }}>
              {h.label}
            </dt>
            <dd className="text-[#9eb0c8]">{h.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
