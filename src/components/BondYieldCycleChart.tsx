/**
 * US 10 Year Bond Yield Cycle theory schematic (educational diagram).
 * Mountain silhouette: trough zone (left) → ~40y rising-rate regime → peak
 * zone in the MIDDLE → ~40y falling-rate regime → trough zone (right).
 * Stacked year columns at the three key points (future above older); the
 * active lap renders bold yellow and auto-switches to the next lap at 1 Jan
 * 2100 (then 2180, …), computed from the live date — not build time.
 * Green Live marker is calendar-dated (Melbourne day) and maps time linearly
 * along each half: Jan 2020 trough → Jan 2060 peak → Jan 2100 trough, then
 * resets onto the same loop (dashed wrap). Live is computed client-side after
 * mount and re-ticks hourly / on tab focus (no dot in SSR HTML).
 * No yield numbers on the diagram · future dates theoretical · research only · NFA.
 */

"use client";

import { useState } from "react";
import {
  BOND_CAPTION,
  BOND_HISTORY_NOTE,
  BOND_PEAK_HISTORY,
  BOND_PROJECTED_NOTE,
  BOND_SOURCE_LINE,
  BOND_TROUGH_HISTORY,
  bondLap,
  bondLapIndexAt,
  isTheoreticalYear,
  janMs,
  projectedBondRows,
} from "@/lib/bondCycle";
import { useLiveNow } from "@/lib/useLiveNow";

type Pt = { x: number; y: number };

const SVG_W = 820;
const TROUGH: Pt = { x: 88, y: 300 };
const PEAK: Pt = { x: 424, y: 64 };
const NEXT_TROUGH: Pt = { x: 760, y: 300 };
const HALF_W = PEAK.x - TROUGH.x;

/** Band / guide extents (chart-local). */
const BAND_TOP = 18;
const BAND_BOTTOM = 322;
const WRAP_Y = 348;

const RISE_GREEN = "#3dcc9a";
const FALL_RED = "#ef6b6b";
const GOLD = "#d4a017";

/**
 * Ridgeline knots (fraction across each half → y). Organic shoulders: slow
 * early climb, a mid-slope shoulder, steeper final run into a rounded summit;
 * the descent mirrors it loosely with its own shoulder. Shape only — not data.
 */
const LEFT_KNOTS: [number, number][] = [
  [0, 300],
  [0.14, 295],
  [0.28, 282],
  [0.42, 256],
  [0.53, 230],
  [0.63, 218],
  [0.75, 172],
  [0.87, 112],
  [0.95, 76],
  [1, 64],
];
const RIGHT_KNOTS: [number, number][] = [
  [0.05, 76],
  [0.13, 106],
  [0.25, 150],
  [0.37, 182],
  [0.47, 194],
  [0.56, 206],
  [0.68, 238],
  [0.8, 270],
  [0.91, 291],
  [1, 300],
];

const KNOTS: Pt[] = [
  ...LEFT_KNOTS.map(([u, y]) => ({ x: TROUGH.x + u * HALF_W, y })),
  ...RIGHT_KNOTS.map(([v, y]) => ({ x: PEAK.x + v * HALF_W, y })),
];

/** Monotone cubic (Fritsch–Carlson) tangents → y(x) with no overshoot. */
const TANGENTS: number[] = (() => {
  const n = KNOTS.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((KNOTS[i + 1].y - KNOTS[i].y) / (KNOTS[i + 1].x - KNOTS[i].x));
  }
  const m: number[] = new Array(n).fill(0);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
})();

function ridgeY(x: number): number {
  const cx = Math.min(NEXT_TROUGH.x, Math.max(TROUGH.x, x));
  let i = 0;
  while (i < KNOTS.length - 2 && cx > KNOTS[i + 1].x) i++;
  const p0 = KNOTS[i];
  const p1 = KNOTS[i + 1];
  const h = p1.x - p0.x;
  const t = (cx - p0.x) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * p0.y +
    (t3 - 2 * t2 + t) * h * TANGENTS[i] +
    (-2 * t3 + 3 * t2) * p1.y +
    (t3 - t2) * h * TANGENTS[i + 1]
  );
}

const RIDGE_PATH = (() => {
  const parts: string[] = [];
  for (let x = TROUGH.x; x <= NEXT_TROUGH.x; x += 2) {
    parts.push(`${parts.length === 0 ? "M" : "L"} ${x} ${ridgeY(x).toFixed(2)}`);
  }
  return parts.join(" ");
})();

/** Soft fill under the ridge so it reads as a mountain. */
const RIDGE_FILL = `${RIDGE_PATH} L ${NEXT_TROUGH.x} ${BAND_BOTTOM} L ${TROUGH.x} ${BAND_BOTTOM} Z`;

/* -------------------------------------------------------------------------- */
/* Live timing                                                                */
/* -------------------------------------------------------------------------- */

function melbourneYmd(nowMs: number): { y: number; m: number; d: number } {
  const melParts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowMs));
  return {
    y: Number(melParts.find((p) => p.type === "year")!.value),
    m: Number(melParts.find((p) => p.type === "month")!.value),
    d: Number(melParts.find((p) => p.type === "day")!.value),
  };
}

/** Melbourne calendar day → noon UTC ms (Live moves once per Melbourne day). */
function melbourneDayMs(nowMs: number): number {
  const { y, m, d } = melbourneYmd(nowMs);
  return Date.UTC(y, m - 1, d, 12, 0, 0, 0);
}

const YEAR_MS = 365.2425 * 86_400_000;

type LiveInfo = {
  pt: Pt;
  lap: number;
  rising: boolean;
  /** Fraction along the active half (0 at its start zone, 1 at its end zone). */
  frac: number;
  yearsToNext: number;
  nextZoneYear: number;
};

function liveFromNow(nowMs: number): LiveInfo {
  const day = melbourneDayMs(nowMs);
  const lap = bondLapIndexAt(day);
  const { startYear, peakYear, endYear } = bondLap(lap);
  const startMs = janMs(startYear);
  const peakMs = janMs(peakYear);
  const endMs = janMs(endYear);
  const rising = day < peakMs;
  const frac = rising
    ? Math.max(0, (day - startMs) / (peakMs - startMs))
    : Math.min(1, (day - peakMs) / (endMs - peakMs));
  const x = rising ? TROUGH.x + frac * HALF_W : PEAK.x + frac * HALF_W;
  const nextMs = rising ? peakMs : endMs;
  return {
    pt: { x, y: ridgeY(x) },
    lap,
    rising,
    frac,
    yearsToNext: Math.max(0, Math.round((nextMs - day) / YEAR_MS)),
    nextZoneYear: rising ? peakYear : endYear,
  };
}

const liveDayLabel = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/* -------------------------------------------------------------------------- */
/* Year stacks                                                                */
/* -------------------------------------------------------------------------- */

const ACTIVE_YEAR_FILL = "#ffe14a";
const MUTED_YEAR_FILL = "#c8d0dc";
const OLD_YEAR_FILL = "#8b9bb4";

type ColumnId = "left" | "peak" | "right";

/**
 * Years shown on each column for the active lap L (future above older):
 * next lap (L+1, muted) · active lap (L, bold yellow) · previous lap (L−1, muted).
 * Lap 0 → left 2100 / 2020 / 1940 · peak 2140 / 2060 / 1980 · right 2180 / 2100 / 2020.
 * After 1 Jan 2100 the yellow row becomes 2100 / 2140 / 2180 automatically.
 */
function columnYears(col: ColumnId, lap: number): { year: number; active: boolean }[] {
  const pick = (l: number) => {
    const b = bondLap(l);
    return col === "left" ? b.startYear : col === "peak" ? b.peakYear : b.endYear;
  };
  return [
    { year: pick(lap + 1), active: false },
    { year: pick(lap), active: true },
    { year: pick(lap - 1), active: false },
  ];
}

function YearColumn({
  x,
  pointY,
  dx,
  rows,
  tagActive,
}: {
  x: number;
  pointY: number;
  dx: number;
  rows: { year: number; active: boolean }[];
  tagActive?: boolean;
}) {
  const lineH = 13;
  const gap = 1;
  const n = rows.length;
  const totalH = n * lineH + (n - 1) * gap;
  const startY = pointY - 14 - totalH + lineH;
  const cx = x + dx;
  return (
    <g>
      {rows.map((r, i) => {
        const y = startY + i * (lineH + gap);
        const theoretical = isTheoreticalYear(r.year);
        const fill = r.active ? ACTIVE_YEAR_FILL : i === n - 1 ? OLD_YEAR_FILL : MUTED_YEAR_FILL;
        return (
          <g key={`${r.year}-${i}`}>
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
              {r.year}
              {theoretical ? "*" : ""}
            </text>
            {r.active && tagActive && theoretical ? (
              <text
                x={cx + 24}
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

function SpanArrow({ x1, x2, y, label }: { x1: number; x2: number; y: number; label: string }) {
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

type TipKind = "peak" | "troughLeft" | "troughRight" | null;

export default function BondYieldCycleChart() {
  const TOP_PAD = 64;
  const BOTTOM_PAD = 24;
  const CHART_H = 520;
  const SVG_H = CHART_H + TOP_PAD + BOTTOM_PAD;

  const [tip, setTip] = useState<TipKind>(null);

  /* null until mounted — SSR/prerender renders no dot rather than a stale one */
  const nowMs = useLiveNow();
  const liveInfo = nowMs === null ? null : liveFromNow(nowMs);
  const live = liveInfo?.pt ?? null;
  /* Pre-mount fallback = lap 0 (correct until 1 Jan 2100) */
  const lap = liveInfo?.lap ?? 0;
  const activeLap = bondLap(lap);
  const projectedRows = projectedBondRows(lap);

  /* Pill sits below-right on the rising slope, below-left on the falling slope */
  const liveLabelDx = live && liveInfo && !liveInfo.rising ? -46 : 12;
  const liveLabelDy = 22;

  const tipPoint =
    tip === "peak" ? PEAK : tip === "troughLeft" ? TROUGH : tip === "troughRight" ? NEXT_TROUGH : null;
  const tipLeftPct = tipPoint ? (tipPoint.x / SVG_W) * 100 : 0;
  const tipTopPct = tipPoint ? ((tipPoint.y + TOP_PAD) / SVG_H) * 100 : 0;

  const markers = [
    { id: "troughLeft" as const, p: TROUGH, label: "Trough zone", col: "left" as const, dx: -24 },
    { id: "peak" as const, p: PEAK, label: "Peak zone", col: "peak" as const, dx: 0 },
    { id: "troughRight" as const, p: NEXT_TROUGH, label: "Trough zone", col: "right" as const, dx: 26 },
  ];

  return (
    <div className="relative mt-6 w-full">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="US 10-year Treasury yield secular regime sketch — mountain silhouette with a trough zone on the left, peak zone in the middle and trough zone on the right, roughly 40 years each way. Stacked marker years at each column, bold yellow for the active lap. Live marker positioned by today's date. Hover the gold markers for regime dates. Educational sketch only — no yield targets, not a model or financial advice"
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id="bond-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bond-live-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="bond-ridge-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8eef7" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#e8eef7" stopOpacity="0" />
          </linearGradient>
          <style>{`
            @keyframes bond-live-pulse {
              0% { opacity: 0.55; r: 7; }
              70% { opacity: 0; r: 22; }
              100% { opacity: 0; r: 22; }
            }
            .bond-live-ring {
              animation: bond-live-pulse 2.4s ease-out infinite;
              transform-origin: center;
              transform-box: fill-box;
            }
          `}</style>
        </defs>

        <rect width={SVG_W} height={SVG_H} fill="#0a0a0a" rx="8" />

        <text
          x={SVG_W / 2}
          y="24"
          textAnchor="middle"
          fill="#e8eef4"
          fontSize="16"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          US 10 Year Bond Yield Cycle theory
        </text>
        <text
          x={SVG_W / 2}
          y="42"
          textAnchor="middle"
          fill="#8b9bb4"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
        >
          Stylised sketch · ~40y up · ~40y down · bold yellow = active lap · * = theoretical · green
          line = trough regime · red line = peak regime · NFA
        </text>

        <g transform={`translate(0, ${TOP_PAD})`}>
          {/* Phase bands — green rising-rate regime (left), red falling-rate regime (right) */}
          <rect
            x={TROUGH.x}
            y={BAND_TOP}
            width={HALF_W}
            height={BAND_BOTTOM - BAND_TOP}
            fill={RISE_GREEN}
            opacity="0.06"
          />
          <rect
            x={PEAK.x}
            y={BAND_TOP}
            width={HALF_W}
            height={BAND_BOTTOM - BAND_TOP}
            fill={FALL_RED}
            opacity="0.07"
          />
          <text
            x={TROUGH.x + HALF_W * 0.4}
            y={BAND_TOP + 20}
            textAnchor="middle"
            fill={RISE_GREEN}
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            Rising-rate regime
          </text>
          <text
            x={PEAK.x + HALF_W * 0.6}
            y={BAND_TOP + 20}
            textAnchor="middle"
            fill={FALL_RED}
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            Falling-rate regime
          </text>

          {[58, 98, 138, 178, 218, 258, 298].map((y) => (
            <line
              key={y}
              x1="56"
              y1={y}
              x2={NEXT_TROUGH.x + 28}
              y2={y}
              stroke="#1a1a1a"
              strokeWidth="1"
            />
          ))}

          {/* Regime verticals — green = trough regime, red = peak regime */}
          {[TROUGH, NEXT_TROUGH].map((p) => (
            <line
              key={`trough-v-${p.x}`}
              x1={p.x}
              y1={BAND_TOP}
              x2={p.x}
              y2={BAND_BOTTOM}
              stroke={RISE_GREEN}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.7"
            />
          ))}
          <line
            x1={PEAK.x}
            y1={PEAK.y + 10}
            x2={PEAK.x}
            y2={BAND_BOTTOM}
            stroke={FALL_RED}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.75"
          />

          {/* Dashed wrap under the plot (next lap resets onto the same loop) */}
          <path
            d={`M ${NEXT_TROUGH.x} ${NEXT_TROUGH.y} L ${NEXT_TROUGH.x + 24} ${WRAP_Y} L ${TROUGH.x - 16} ${WRAP_Y} L ${TROUGH.x} ${TROUGH.y}`}
            fill="none"
            stroke="#5a6a80"
            strokeWidth="1.75"
            strokeDasharray="5 5"
            opacity="0.55"
            strokeLinejoin="round"
          />
          <text
            x={(TROUGH.x + NEXT_TROUGH.x) / 2}
            y={362}
            textAnchor="middle"
            fill="#6b7a90"
            fontSize="8"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
          >
            Next lap resets onto the same loop →
          </text>

          {/* Mountain ridgeline — soft fill, glowing white line, muted dashed echo (other laps) */}
          <path d={RIDGE_FILL} fill="url(#bond-ridge-fill)" stroke="none" />
          <path
            d={RIDGE_PATH}
            fill="none"
            stroke="#e8eef7"
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#bond-glow)"
          />
          <path
            d={RIDGE_PATH}
            fill="none"
            stroke="#8fa0b8"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="6 5"
            opacity="0.4"
          />

          {/* Year stacks — future above older; active lap bold yellow */}
          {markers.map((m) => (
            <YearColumn
              key={`stack-${m.id}`}
              x={m.p.x}
              pointY={m.p.y}
              dx={m.dx}
              rows={columnYears(m.col, lap)}
              tagActive={m.col === "peak"}
            />
          ))}

          {/* Gold hover markers — trough / peak regime dates */}
          {markers.map((m) => (
            <g
              key={m.id}
              onMouseEnter={() => setTip(m.id)}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: "help" }}
              aria-label={`${m.label} dates — hover to view`}
              data-marker={m.id}
            >
              <circle cx={m.p.x} cy={m.p.y} r={18} fill="transparent" />
              <circle
                cx={m.p.x}
                cy={m.p.y}
                r={m.id === "peak" ? 5.5 : 4.5}
                fill="#0a0a0a"
                stroke={GOLD}
                strokeWidth={2.25}
              />
              {m.id === "peak" ? (
                <>
                  <text
                    x={m.p.x - 32}
                    y={m.p.y - 28}
                    textAnchor="end"
                    fill="#9eb0c8"
                    fontSize="10"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="600"
                  >
                    Peak zone
                  </text>
                  <text
                    x={m.p.x - 32}
                    y={m.p.y - 16}
                    textAnchor="end"
                    fill={GOLD}
                    fontSize="8"
                    fontFamily="system-ui, sans-serif"
                    fontWeight="600"
                    opacity={0.9}
                  >
                    hover dates
                  </text>
                </>
              ) : (
                <text
                  x={m.p.x}
                  y={m.p.y + 22}
                  textAnchor="middle"
                  fill="#9eb0c8"
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="600"
                >
                  {m.label}
                </text>
              )}
            </g>
          ))}

          <SpanArrow x1={TROUGH.x + 4} x2={PEAK.x - 4} y={390} label="~40 years up (rising-rate regime)" />
          <SpanArrow
            x1={PEAK.x + 4}
            x2={NEXT_TROUGH.x - 4}
            y={390}
            label="~40 years down (falling-rate regime)"
          />

          <text
            x={SVG_W / 2}
            y={432}
            textAnchor="middle"
            fill="#a8b4c8"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
          >
            {BOND_CAPTION}
          </text>
          <text
            x={SVG_W / 2}
            y={448}
            textAnchor="middle"
            fill="#6b7a90"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
          >
            Hypothesis overlay (not observed): AI / robotics could lift yields early (buildout, issuance) and
            pull them later (productivity) — g vs r (growth vs rates); sign disputed.
          </text>
          <text
            x={SVG_W / 2}
            y={464}
            textAnchor="middle"
            fill="#6b7a90"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
            fontStyle="italic"
          >
            {BOND_SOURCE_LINE}
          </text>

          <rect
            x="40"
            y="476"
            width={SVG_W - 80}
            height="44"
            rx="6"
            fill="#121820"
            stroke="#3a4558"
            strokeWidth="1"
          />
          <text
            x={SVG_W / 2}
            y="494"
            textAnchor="middle"
            fill="#d0d8e4"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            Future markers are theoretical: regime direction only — no yield target for any future date.
          </text>
          <text
            x={SVG_W / 2}
            y="509"
            textAnchor="middle"
            fill="#9eb0c8"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
          >
            Not a model, not a signal, not for market timing. Research / educational purposes only. Not financial
            advice (NFA).
          </text>

          {/* Live pulse — client-computed from today's Melbourne date (hidden until mounted) */}
          {live && liveInfo ? (
            <g filter="url(#bond-live-glow)" aria-label="Live position on cycle path" data-live-dot="">
              <title>
                {`Live · ${liveDayLabel.format(new Date(nowMs as number))} (Melbourne) · ${
                  liveInfo.yearsToNext < 1
                    ? "under a year"
                    : `~${liveInfo.yearsToNext} year${liveInfo.yearsToNext === 1 ? "" : "s"}`
                } to the ~${liveInfo.nextZoneYear} theoretical ${
                  liveInfo.rising ? "peak" : "trough"
                } zone · theoretical, NFA`}
              </title>
              <circle
                className="bond-live-ring"
                cx={live.x}
                cy={live.y}
                r={7}
                fill="none"
                stroke="#3dcc9a"
                strokeWidth="2"
              />
              <circle cx={live.x} cy={live.y} r={5.5} fill="#3dcc9a" />
              <circle cx={live.x} cy={live.y} r={2.2} fill="#e8fff4" />
              <rect
                x={live.x + liveLabelDx}
                y={live.y + liveLabelDy - 10}
                width="34"
                height="14"
                rx="3"
                fill="#0f2418"
                stroke="#3dcc9a"
                strokeWidth="1"
              />
              <text
                x={live.x + liveLabelDx + 17}
                y={live.y + liveLabelDy}
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

      {tip ? (
        <div
          className={`pointer-events-none absolute z-20 w-[min(18rem,90%)] rounded-lg border border-[#8a6a20] bg-[#14100a]/95 px-3 py-2.5 shadow-lg shadow-black/50 backdrop-blur-sm ${
            tip === "peak" ? "translate-y-4" : "-translate-y-[108%]"
          } ${
            tip === "troughRight"
              ? "-translate-x-[88%]"
              : tip === "troughLeft"
                ? "-translate-x-[12%]"
                : "-translate-x-1/2"
          }`}
          style={{ left: `${tipLeftPct}%`, top: `${tipTopPct}%` }}
          role="tooltip"
          data-tip={tip}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d4a017]">
            {tip === "peak" ? "Peak zone dates" : "Trough zone dates"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {(tip === "peak" ? BOND_PEAK_HISTORY : BOND_TROUGH_HISTORY).map((row, i) => (
              <li key={`${row.detail}-${i}`} className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-[#9eb0c8]">{row.title}</span>
                <span
                  className={`shrink-0 font-mono text-[11px] ${
                    row.print ? "text-[#e8d9a8]" : "text-[#e8eef7]"
                  }`}
                >
                  {row.detail}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 border-t border-dashed border-[#3a4558] pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b9bb4]">
              Projected (theoretical)
            </p>
            <p className="mt-0.5 text-[10px] italic text-[#7a8aa0]">
              Anchored to the {lap === 0 ? "" : "~"}Jan {activeLap.startYear} trough zone · ~40-year
              half-swings
            </p>
            <ul className="mt-1.5 space-y-1">
              {(tip === "peak" ? projectedRows : [...projectedRows].reverse()).map((row) => (
                <li
                  key={`${row.title}-${row.detail}`}
                  className="flex items-baseline justify-between gap-3 italic"
                >
                  <span className="flex items-center gap-1.5 text-[11px] text-[#7a8aa0]">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full border border-dashed border-[#8b9bb4]"
                    />
                    {row.title}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-[#a8b4c6]">{row.detail}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-[#6b7a90]">{BOND_HISTORY_NOTE}</p>
          <p className="mt-1 text-[10px] italic leading-snug text-[#8b9bb4]">{BOND_PROJECTED_NOTE}</p>
        </div>
      ) : null}
    </div>
  );
}
