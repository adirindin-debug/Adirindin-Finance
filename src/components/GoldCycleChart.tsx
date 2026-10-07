/**
 * Gold-led ~46-year commodity cycle theory schematic (educational diagram).
 * The cycle shape is the Market cycles hub gold tile silhouette (goldSilhouette.ts:
 * flat start → steep run-up → sharp correction → spike to the peak → sharp drop →
 * long down-sideways drift). Two views (toggle on the chart):
 *  - "Repeating cycle" (default): ONE lap of the exact tile silhouette, laid out like
 *    the RE / bond detail charts — regime bands, key points with stacked lap years
 *    (active lap bold yellow), dashed "next lap resets onto the same loop" wrap,
 *    orange duration spans, 15 Aug 1971 at its phase in the 1954–2000 lap, Live dot
 *    on the tile's own date mapping and a current-phase callout.
 *  - "Secular uptrend": each lap starts where the last one ended (~58% up) — the
 *    stepped version as first built.
 * Yellow labels mark the peak / trough zones and the 15 Aug 1971 Nixon Shock.
 * Green Live marker is calendar-dated (computed client-side after mount, re-ticks
 * hourly / on tab focus). No price data on this chart — shape only · NFA.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GOLD_ANCHOR_NOTES,
  GOLD_CYCLE_YEARS,
  GOLD_FINAL_RUN_FRAC,
  GOLD_LAST_OBSERVED_YEAR,
  GOLD_HISTORICAL_POINTS,
  GOLD_PEAK_ANCHORS,
  GOLD_TROUGH_FRAC,
  GOLD_TROUGH_NOTES,
  GOLD_TROUGH_OFFSET_YEARS,
  goldCycleProgress,
  goldLivePhaseLine,
  goldPhaseName,
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

/** Alternate view: the stepped "secular uptrend" laps (kept exactly as first built). */
function UptrendView({ nowMs, narrow }: { nowMs: number | null; narrow: boolean }) {
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
  );
}

/* -------------------------------------------------------------------------- */
/* Default view: ONE lap of the tile silhouette (RE / bond detail-chart style) */
/* -------------------------------------------------------------------------- */

/** Same canvas geometry as the bond detail chart and the hub tile (trough x 88 → next trough x 760). */
const S_X0 = 88;
const S_X1 = 760;
const S_Y_PEAK = 78;
const S_Y_BASE = 300;
const S_TOP_PAD = 64;
const S_CHART_H = 524;
const S_SVG_H = S_CHART_H + S_TOP_PAD;
const S_BAND_TOP = 18;
const S_BAND_BOTTOM = 322;
const S_WRAP_Y = 348;

const RISE_GREEN = "#3dcc9a";
const FINAL_GOLD = "#d4a017";
const FALL_RED = "#ef6b6b";
const ACTIVE_YEAR_FILL = "#ffe14a";
const MUTED_YEAR_FILL = "#c8d0dc";
const OLD_YEAR_FILL = "#8b9bb4";

/** Final-run phase starts at GOLD_FINAL_RUN_FRAC of the peak→peak lap (same rule as goldPhaseName). */
const FINAL_RUN_U = (GOLD_FINAL_RUN_FRAC * GOLD_CYCLE_YEARS - GOLD_TROUGH_OFFSET_YEARS) / GOLD_CYCLE_YEARS;
const FINAL_RUN_S = goldTileX(FINAL_RUN_U);
/** Trough → peak and peak → trough durations (years), from the existing anchors. */
const RUN_UP_YEARS = GOLD_CYCLE_YEARS - GOLD_TROUGH_OFFSET_YEARS;
const DECLINE_YEARS = GOLD_TROUGH_OFFSET_YEARS;

function sX(s: number): number {
  return S_X0 + s * (S_X1 - S_X0);
}
function sY(unit: number): number {
  return S_Y_BASE - unit * (S_Y_BASE - S_Y_PEAK);
}
function sPt(s: number): Pt {
  return { x: sX(s), y: sY(goldTileUnit(s)) };
}

/** Exact hub-tile silhouette: goldTileUnit(s) across one lap (trough → peak → next trough). */
const S_LINE_PATH = (() => {
  const parts: string[] = [];
  const n = 480;
  for (let i = 0; i <= n; i++) {
    const p = sPt(i / n);
    parts.push(`${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
  }
  return parts.join(" ");
})();
const S_FILL_PATH = `${S_LINE_PATH} L ${S_X1} ${S_BAND_BOTTOM} L ${S_X0} ${S_BAND_BOTTOM} Z`;

const S_START = sPt(0);
const S_PEAK = sPt(PEAK_S);
const S_END = sPt(1);

/** Lap k runs trough(k) → peak(k) (+26y) → trough(k+1) (+46y). Lap 0 starts 1908 (geometry only). */
function lapStart(k: number): number {
  return LAP0_TROUGH_YEAR + k * GOLD_CYCLE_YEARS;
}
function lapPeak(k: number): number {
  return lapStart(k) + RUN_UP_YEARS;
}

/** Active lap = the lap whose [start trough, next trough) contains the date (bond / RE rule). */
function activeLapAt(ms: number): number {
  return Math.floor((fracYear(ms) - LAP0_TROUGH_YEAR) / GOLD_CYCLE_YEARS);
}
/** Pre-mount fallback: the lap containing the last observed year (2000 → 2046). */
const DEFAULT_LAP = Math.floor((GOLD_LAST_OBSERVED_YEAR - LAP0_TROUGH_YEAR) / GOLD_CYCLE_YEARS);

/** Only dates already in the code: peak anchors + trough notes. */
const KNOWN_PEAKS = new Set<number>(GOLD_PEAK_ANCHORS);
const KNOWN_TROUGHS = new Set<number>(Object.keys(GOLD_TROUGH_NOTES).map(Number));

type StackRow = { label: string; active: boolean; theo: boolean };

/** Future above older; active lap bold yellow, others muted (oldest dimmest). */
function stackRows(col: "left" | "peak" | "right", lap: number): StackRow[] {
  const laps = [lap + 1, lap, lap - 1, lap - 2];
  const rows: StackRow[] = [];
  for (const k of laps) {
    const year = col === "left" ? lapStart(k) : col === "peak" ? lapPeak(k) : lapStart(k + 1);
    const known = col === "peak" ? KNOWN_PEAKS.has(year) : KNOWN_TROUGHS.has(year);
    if (!known) continue;
    const theo = isTheoreticalGoldYear(year);
    rows.push({
      label: `${col === "peak" ? "" : "~"}${year}${theo ? "*" : ""}`,
      active: k === lap,
      theo,
    });
  }
  return rows;
}

function SingleYearColumn({
  x,
  pointY,
  dx,
  rows,
  tagActive,
}: {
  x: number;
  pointY: number;
  dx: number;
  rows: StackRow[];
  tagActive?: boolean;
}) {
  const lineH = 13;
  const gap = 1;
  const n = rows.length;
  const totalH = n * lineH + Math.max(0, n - 1) * gap;
  const startY = pointY - 14 - totalH + lineH;
  const cx = x + dx;
  return (
    <g>
      {rows.map((r, i) => {
        const y = startY + i * (lineH + gap);
        const fill = r.active ? ACTIVE_YEAR_FILL : i === n - 1 ? OLD_YEAR_FILL : MUTED_YEAR_FILL;
        return (
          <g key={`${r.label}-${i}`}>
            <text
              x={cx}
              y={y}
              textAnchor="middle"
              fill={fill}
              fontSize={r.active ? 11 : 10}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontWeight={r.active ? 700 : 500}
              textDecoration={r.active ? "underline" : undefined}
            >
              {r.label}
            </text>
            {r.active && tagActive && r.theo ? (
              <text
                x={cx + 28}
                y={y - 1}
                textAnchor="start"
                fill="#b8a060"
                fontSize="8"
                fontStyle="italic"
                fontFamily="system-ui, sans-serif"
              >
                theoretical
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/** Orange double-headed span under the chart (RE / bond framing). */
function OrangeSpan({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
  const mid = (x1 + x2) / 2;
  const color = "#e8873a";
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="2" />
      <polyline
        points={`${x1 + 8},${y - 5} ${x1},${y} ${x1 + 8},${y + 5}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <polyline
        points={`${x2 - 8},${y - 5} ${x2},${y} ${x2 - 8},${y + 5}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <text
        x={mid}
        y={y + 16}
        textAnchor="middle"
        fill={color}
        fontSize="11"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
}

/** 15 Aug 1971 sits in the 1954 → 2000 lap; place it at its phase position on the one lap. */
const NIXON = (() => {
  const h = GOLD_HISTORICAL_POINTS[0];
  if (!h) return null;
  const y = fracYear(h.t);
  const laps = (y - LAP0_TROUGH_YEAR) / GOLD_CYCLE_YEARS;
  const k = Math.floor(laps);
  const s = goldTileX(laps - k);
  return { ...h, s, lapFrom: lapStart(k), lapTo: lapStart(k + 1), pt: sPt(s) };
})();

const S_BANDS = [
  { id: "advance", from: 0, to: FINAL_RUN_S, color: RISE_GREEN, label: "Advance from trough", phase: "Advance from trough", opacity: 0.05 },
  { id: "final", from: FINAL_RUN_S, to: PEAK_S, color: FINAL_GOLD, label: "Final run", phase: "Final run to peak zone", opacity: 0.07 },
  { id: "decline", from: PEAK_S, to: 1, color: FALL_RED, label: "Post-peak decline", phase: "Post-peak decline", opacity: 0.06 },
] as const;

function SingleLapView({ nowMs, narrow }: { nowMs: number | null; narrow: boolean }) {
  const lap = nowMs != null ? activeLapAt(nowMs) : DEFAULT_LAP;

  const live = useMemo(() => {
    if (nowMs == null) return null;
    const { frac } = goldCycleProgress(nowMs);
    // Same mapping as the hub tile Live dot: trough-lap position u → tile s.
    const s = goldTileX((frac - GOLD_TROUGH_FRAC + 1) % 1);
    return { ...sPt(s), s, phase: goldPhaseName(frac) };
  }, [nowMs]);

  const activeBand = live ? S_BANDS.find((b) => b.phase === live.phase) : undefined;
  /** Current-phase callout (RE "Winner's Curse" style): left label, dotted leader to Live. */
  const callout =
    live && activeBand
      ? {
          x: Math.min(Math.max(live.x + 110, sX(activeBand.from) + 90), S_X1 - 20),
          y: Math.min(live.y + 150, S_BAND_BOTTOM - 70),
        }
      : null;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${S_SVG_H}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label={`Gold-led ~${GOLD_CYCLE_YEARS}-year commodity cycle theory schematic — one lap of the hub tile silhouette: trough zone, ~${RUN_UP_YEARS}-year run-up to the peak zone, ~${DECLINE_YEARS}-year post-peak decline to the next trough zone, then the next lap resets onto the same loop. Stacked marker years at each point (future above older), bold yellow for the active lap. 15 Aug 1971 Nixon Shock placed at its phase in the 1954–2000 lap. Live marker positioned by today's date. Educational sketch only — no price targets, not a model or financial advice`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="gold-single-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="gold-single-live-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="gold-single-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8eef7" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#e8eef7" stopOpacity="0" />
        </linearGradient>
        <style>{`
          @keyframes gold-single-live-pulse {
            0% { opacity: 0.55; r: 7; }
            70% { opacity: 0; r: 22; }
            100% { opacity: 0; r: 22; }
          }
          .gold-single-live-ring {
            animation: gold-single-live-pulse 2.4s ease-out infinite;
            transform-origin: center;
            transform-box: fill-box;
          }
          @media (prefers-reduced-motion: reduce) {
            .gold-single-live-ring { animation: none; opacity: 0.35; r: 12; }
          }
        `}</style>
      </defs>

      <rect width={SVG_W} height={S_SVG_H} fill="#0a0a0a" rx="8" />

      <text
        x={SVG_W / 2}
        y="24"
        textAnchor="middle"
        fill="#e8eef4"
        fontSize="16"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
      >
        Gold-led ~{GOLD_CYCLE_YEARS}-year commodity cycle theory
      </text>
      <text
        x={SVG_W / 2}
        y="42"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        {narrow
          ? "One lap · bold yellow = active lap · * = theoretical · NFA"
          : `Stylised sketch · ~${RUN_UP_YEARS}y up · ~${DECLINE_YEARS}y down · bold yellow = active lap · * = theoretical · yellow dot = historical marker · NFA`}
      </text>

      <g transform={`translate(0, ${S_TOP_PAD})`}>
        {/* Regime bands — advance (green), final run (gold), post-peak decline (red) */}
        {S_BANDS.map((b) => (
          <rect
            key={b.id}
            x={sX(b.from)}
            y={S_BAND_TOP}
            width={sX(b.to) - sX(b.from)}
            height={S_BAND_BOTTOM - S_BAND_TOP}
            fill={b.color}
            opacity={b.opacity}
          />
        ))}
        {S_BANDS.map((b) => (
          <text
            key={`bl-${b.id}`}
            x={(sX(b.from) + sX(b.to)) / 2 + (b.id === "decline" ? 40 : b.id === "advance" ? 22 : 0)}
            y={S_BAND_BOTTOM - 8}
            textAnchor="middle"
            fill={b.color}
            fontSize="10.5"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
            opacity={activeBand?.id === b.id ? 1 : 0.8}
          >
            {b.label}
          </text>
        ))}

        {/* Subtle horizontal grid */}
        {[58, 98, 138, 178, 218, 258, 298].map((y) => (
          <line key={y} x1="56" y1={y} x2={S_X1 + 28} y2={y} stroke="#1a1a1a" strokeWidth="1" />
        ))}

        {/* Regime verticals — green = trough zones, red = peak zone */}
        {[S_START, S_END].map((p, i) => (
          <line
            key={`tv-${i}`}
            x1={p.x}
            y1={S_BAND_TOP}
            x2={p.x}
            y2={S_BAND_BOTTOM}
            stroke={RISE_GREEN}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.7"
          />
        ))}
        <line
          x1={S_PEAK.x}
          y1={S_PEAK.y + 10}
          x2={S_PEAK.x}
          y2={S_BAND_BOTTOM}
          stroke={FALL_RED}
          strokeWidth="1.5"
          strokeDasharray="4 4"
          opacity="0.75"
        />

        {/* Dashed wrap under the plot (next lap resets onto the same loop) */}
        <path
          d={`M ${S_END.x} ${S_END.y} L ${S_END.x + 24} ${S_WRAP_Y} L ${S_START.x - 16} ${S_WRAP_Y} L ${S_START.x} ${S_START.y}`}
          fill="none"
          stroke="#5a6a80"
          strokeWidth="1.75"
          strokeDasharray="5 5"
          opacity="0.55"
          strokeLinejoin="round"
        />
        <text
          x={(S_X0 + S_X1) / 2}
          y={362}
          textAnchor="middle"
          fill="#6b7a90"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Next lap resets onto the same loop →
        </text>

        {/* Tile silhouette — soft fill, glowing white line, muted dashed echo (other laps) */}
        <path d={S_FILL_PATH} fill="url(#gold-single-fill)" stroke="none" />
        <path
          d={S_LINE_PATH}
          fill="none"
          stroke={LINE}
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#gold-single-glow)"
        />
        <path
          d={S_LINE_PATH}
          fill="none"
          stroke="#8fa0b8"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="6 5"
          opacity="0.4"
        />

        {/* Stacked lap years — future above older; active lap bold yellow + underlined */}
        <SingleYearColumn x={S_START.x} pointY={S_START.y} dx={-26} rows={stackRows("left", lap)} />
        <SingleYearColumn x={S_PEAK.x} pointY={S_PEAK.y} dx={0} rows={stackRows("peak", lap)} tagActive />
        <SingleYearColumn x={S_END.x} pointY={S_END.y} dx={28} rows={stackRows("right", lap)} />

        {/* Key points */}
        {[
          { id: "troughLeft", p: S_START, r: 4.5, title: "Trough zone (lap start)" },
          { id: "peak", p: S_PEAK, r: 5.5, title: "Peak zone" },
          { id: "troughRight", p: S_END, r: 4.5, title: "Next trough zone (lap end)" },
        ].map((m) => (
          <g key={m.id} data-marker={m.id}>
            <title>{m.title}</title>
            <circle cx={m.p.x} cy={m.p.y} r={m.r} fill="#0a0a0a" stroke={FINAL_GOLD} strokeWidth={2.25} />
          </g>
        ))}
        <text
          x={S_PEAK.x - 34}
          y={S_PEAK.y + 4}
          textAnchor="end"
          fill="#9eb0c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Peak zone
        </text>
        <text
          x={S_START.x}
          y={S_START.y + 22}
          textAnchor="middle"
          fill="#9eb0c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Trough zone
        </text>
        <text
          x={S_END.x - 8}
          y={S_END.y + 22}
          textAnchor="end"
          fill="#9eb0c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Trough zone
        </text>

        {/* Historical marker — 15 Aug 1971 at its phase in the 1954 → 2000 lap */}
        {NIXON ? (
          <g data-marker="historical">
            <title>{`${NIXON.label} — ${NIXON.note} Shown at its phase position in the ${NIXON.lapFrom}–${NIXON.lapTo} lap.`}</title>
            <line
              x1={NIXON.pt.x + 3}
              y1={NIXON.pt.y + 4}
              x2={NIXON.pt.x + 20}
              y2={NIXON.pt.y + 34}
              stroke={YELLOW}
              strokeWidth="1.25"
              strokeDasharray="2 3"
              opacity="0.85"
            />
            <circle cx={NIXON.pt.x} cy={NIXON.pt.y} r={4} fill={YELLOW} stroke="#0a0a0a" strokeWidth={1.5} />
            <text
              x={NIXON.pt.x + 22}
              y={NIXON.pt.y + 46}
              textAnchor="start"
              fill={YELLOW}
              fontSize="11"
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
            >
              {NIXON.label}
            </text>
            <text
              x={NIXON.pt.x + 22}
              y={NIXON.pt.y + 58}
              textAnchor="start"
              fill={YELLOW}
              fontSize="8.5"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
              opacity="0.85"
            >
              Nixon Shock · {NIXON.lapFrom}–{NIXON.lapTo} lap
            </text>
          </g>
        ) : null}

        {/* Current-phase callout (RE "Winner's Curse" style) */}
        {live && activeBand && callout ? (
          <g>
            <text
              x={callout.x}
              y={callout.y}
              textAnchor="start"
              fill={activeBand.color}
              fontSize="11"
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
            >
              {activeBand.phase} · current phase
            </text>
            <line
              x1={callout.x - 4}
              y1={callout.y - 6}
              x2={live.x + 4}
              y2={live.y + 6}
              stroke={activeBand.color}
              strokeWidth="1.25"
              strokeDasharray="2 3"
              opacity="0.85"
            />
          </g>
        ) : null}

        {/* Orange duration spans (existing mapping: peak + 20y = trough, 46y lap) */}
        <OrangeSpan x1={S_START.x + 4} x2={S_PEAK.x - 4} y={392} label={`~${RUN_UP_YEARS} years up (advance + final run)`} />
        <OrangeSpan x1={S_PEAK.x + 4} x2={S_END.x - 4} y={392} label={`~${DECLINE_YEARS} years down (post-peak decline)`} />

        <text
          x={SVG_W / 2}
          y={434}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          {`One ~${GOLD_CYCLE_YEARS}-year lap of the Market cycles tile silhouette · peak zones Jan 1934 / 1980 / 2026 / 2072* · trough zones ~20y after each peak`}
        </text>
        <text
          x={SVG_W / 2}
          y={450}
          textAnchor="middle"
          fill="#6b7a90"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
          fontStyle="italic"
        >
          Bold yellow years mark the active lap (it moves on automatically at each trough zone). Shape only — not a USD price path.
        </text>

        <rect x="40" y="462" width={SVG_W - 80} height="46" rx="6" fill="#121820" stroke="#3a4558" strokeWidth="1" />
        <text
          x={SVG_W / 2}
          y="480"
          textAnchor="middle"
          fill="#d0d8e4"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          Future markers are theoretical: no gold price target for any date.
        </text>
        <text
          x={SVG_W / 2}
          y="496"
          textAnchor="middle"
          fill="#9eb0c8"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Observational sketch · not a model, not a signal · research / educational only · not financial advice (NFA).
        </text>

        {/* Live pulse — client-computed from today's date (hidden until mounted) */}
        {live && nowMs != null ? (
          <g filter="url(#gold-single-live-glow)" aria-label="Live position on cycle path" data-live-dot="">
            <title>{`Live · ${liveDayLabel.format(new Date(nowMs))} · ${goldLivePhaseLine(nowMs)} · theoretical, NFA`}</title>
            <circle className="gold-single-live-ring" cx={live.x} cy={live.y} r={7} fill="none" stroke={LIVE_GREEN} strokeWidth="2" />
            <circle cx={live.x} cy={live.y} r={5.5} fill={LIVE_GREEN} />
            <circle cx={live.x} cy={live.y} r={2.2} fill="#e8fff4" />
            <rect x={live.x + 12} y={live.y - 10} width="34" height="14" rx="3" fill="#0f2418" stroke={LIVE_GREEN} strokeWidth="1" />
            <text
              x={live.x + 29}
              y={live.y}
              textAnchor="middle"
              fill="#7dffb0"
              fontSize="9"
              fontFamily="system-ui, sans-serif"
              fontWeight="800"
            >
              Live
            </text>
          </g>
        ) : null}
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Stage bar (RE "Classic cycle diagram" / bond "Secular regime diagram" strip) */
/* -------------------------------------------------------------------------- */

/** Narrow peak zone: ±½ year around the Jan peak-zone marker, so Live (Oct 2026) stays in the decline. */
const PEAK_ZONE_HALF_U = 0.5 / GOLD_CYCLE_YEARS;
const PEAK_ZONE_FROM_S = goldTileX(PEAK_U - PEAK_ZONE_HALF_U);
const PEAK_ZONE_TO_S = goldTileX(PEAK_U + PEAK_ZONE_HALF_U);

/** Stage blocks in lap s-space — same edges as the single-lap chart's regime bands. */
const STAGES = [
  { id: "advance", name: "Advance from trough", from: 0, to: FINAL_RUN_S, color: RISE_GREEN, span: `~${Math.round(FINAL_RUN_U * GOLD_CYCLE_YEARS)}y` },
  { id: "final", name: "Final run", from: FINAL_RUN_S, to: PEAK_ZONE_FROM_S, color: "#f0c14a", span: `~${Math.round((PEAK_U - FINAL_RUN_U) * GOLD_CYCLE_YEARS)}y` },
  { id: "peak", name: "Peak zone", from: PEAK_ZONE_FROM_S, to: PEAK_ZONE_TO_S, color: FALL_RED, span: "Jan marker" },
  { id: "decline", name: "Post-peak decline", from: PEAK_ZONE_TO_S, to: 1, color: "#b8333d", span: `~${DECLINE_YEARS}y` },
] as const;

/** Percent of the SVG width, so the HTML strip lines up with the chart's x-axis (viewBox 0–SVG_W). */
const pctX = (x: number) => `${((x / SVG_W) * 100).toFixed(3)}%`;

function StageBar() {
  return (
    <div className="mb-3" data-gold-stage-bar>
      <div
        className="relative flex h-14 overflow-hidden rounded-lg border border-[#222]"
        style={{ marginLeft: pctX(S_X0), marginRight: pctX(SVG_W - S_X1) }}
        role="list"
        aria-label="Stages of one gold cycle lap, widths matching the chart below"
      >
        {STAGES.map((st) => (
          <div
            key={st.id}
            role="listitem"
            title={`${st.name} (${st.span})`}
            style={{
              width: `${((st.to - st.from) * 100).toFixed(3)}%`,
              background: `linear-gradient(180deg, ${st.color}55, ${st.color}22)`,
            }}
            className="relative flex items-end border-r border-[#222] last:border-r-0"
          >
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: st.color }} aria-hidden />
            {st.id === "peak" ? (
              <span className="sr-only">{st.name}</span>
            ) : (
              <span className="w-full px-1.5 pb-1.5 text-[10px] font-medium leading-tight text-[#e8eef7] sm:truncate sm:px-2 sm:pb-2 sm:text-xs">
                {st.name}
              </span>
            )}
          </div>
        ))}
      </div>
      <div
        className="relative mt-2 h-4 font-mono text-[10px] text-muted sm:text-xs"
        style={{ marginLeft: pctX(S_X0), marginRight: pctX(SVG_W - S_X1) }}
        aria-hidden
      >
        <span className="absolute left-0">Trough zone</span>
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[#ef6b6b]"
          style={{ left: `${(((PEAK_ZONE_FROM_S + PEAK_ZONE_TO_S) / 2) * 100).toFixed(3)}%` }}
        >
          ▲ Peak zone
        </span>
        <span className="absolute right-0">Next trough zone</span>
      </div>
    </div>
  );
}

type ViewMode = "repeat" | "uptrend";

export default function GoldCycleChart() {
  const nowMs = useLiveNow();
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** Phones: bigger on-chart labels so the yellow dates stay readable. */
  const [narrow, setNarrow] = useState(false);
  const [mode, setMode] = useState<ViewMode>("repeat");

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

  const btn =
    "min-h-10 rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors sm:min-h-0 sm:py-1.5 sm:text-xs";

  return (
    <div ref={boxRef} className="relative mt-6 w-full">
      <div className="mb-2 flex justify-end">
        <div
          className="inline-flex gap-1 rounded-lg border border-border/90 bg-[#1a222d] p-1 shadow-sm"
          role="group"
          aria-label="Cycle view"
        >
          {(
            [
              { k: "repeat", l: "Repeating cycle" },
              { k: "uptrend", l: "Secular uptrend" },
            ] as const
          ).map((o) => (
            <button
              key={o.k}
              type="button"
              data-view={o.k}
              className={`${btn} ${
                mode === o.k
                  ? "bg-accent text-white shadow-sm"
                  : "bg-transparent text-foreground/70 hover:bg-white/5 hover:text-foreground"
              }`}
              aria-pressed={mode === o.k}
              onClick={() => setMode(o.k)}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {mode === "repeat" ? <StageBar /> : null}

      {mode === "repeat" ? (
        <SingleLapView nowMs={nowMs} narrow={narrow} />
      ) : (
        <UptrendView nowMs={nowMs} narrow={narrow} />
      )}

      <p className="mt-2 text-center text-[11px] text-muted">
        {mode === "repeat"
          ? "Repeating cycle: one lap of the tile silhouette — each new lap resets onto the same loop."
          : "Secular uptrend: each lap starts where the last one ended (~58% up), like the hub tile’s ending level."}
      </p>

      <p className="mt-2 min-h-[1.25rem] text-center font-mono text-xs text-[#7dffb0]" aria-live="polite">
        {nowMs != null ? `Live · ${liveDayLabel.format(new Date(nowMs))} · ${goldLivePhaseLine(nowMs)}` : "\u00a0"}
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
