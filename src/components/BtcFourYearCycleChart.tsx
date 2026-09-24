/**
 * BTC 4 year cycle theory schematic (educational diagram).
 * Nike-tick silhouette: simple ~3-year rise, then ~1-year drop onto the
 * next trough. Green Live marker is calendar-dated (Melbourne) along the
 * path and wraps onto the same loop after ~1 year down from the theory peak.
 * No stacked calendar years on the diagram — phase labels only.
 * Research only — not prices, not predictive, NFA.
 */

"use client";

import { useState } from "react";
import { halvingHoverRows } from "@/lib/bitcoinHalving";
import {
  CYCLE_EXTREMES_DISCLAIMER,
  cycleBottomHoverRows,
  cycleTopHoverRows,
} from "@/lib/btcCycleExtremes";
type Pt = { x: number; y: number };

/** Nike-tick vertices (not price data). ~75% width ascending, ~25% descending. */
const TROUGH: Pt = { x: 88, y: 300 };
/** Mid bend — slightly left/up for a cleaner slow-then-steep Nike geometry */
const MID_UP: Pt = { x: 470, y: 215 };
const PEAK: Pt = { x: 620, y: 48 };
const NEXT_TROUGH: Pt = { x: 760, y: 300 };

/** Soft phase-band x-spans (schematic placement on the ~3y ascent). */
const HALVING_X0 = TROUGH.x + (PEAK.x - TROUGH.x) * 0.4;
const HALVING_X1 = TROUGH.x + (PEAK.x - TROUGH.x) * 0.62;
const HALVING_BLUE = "#4c9fff";
/** Late bull — after halving epoch, before the red drawdown (schematic). */
const LATE_BULL_X0 = HALVING_X1;
const LATE_BULL_X1 = PEAK.x;
const LATE_BULL_ORANGE = "#e8873a";

/** Mid of blue halving wash — hover tip sits on the Nike-tick ascent. */
const HALVING_DOT_X = (HALVING_X0 + HALVING_X1) / 2;
const HALVING_ON_ASCENT_T =
  (HALVING_DOT_X - TROUGH.x) / (MID_UP.x - TROUGH.x);
const HALVING_DOT_Y =
  TROUGH.y + HALVING_ON_ASCENT_T * (MID_UP.y - TROUGH.y);

const PATH_VERTS: Pt[] = [TROUGH, MID_UP, PEAK, NEXT_TROUGH];
const LINE_PATH = PATH_VERTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

const SVG_W = 820;

type DatedWaypoint = { at: number; points: Pt[] };

function dateUtcMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

function endOfYearMs(year: number): number {
  return dateUtcMs(year, 12, 31);
}

/**
 * Classic lap (internal Live timing only — not drawn as year labels).
 * Equal 4y timing from theory peak ~Oct 6 2025: ~3y up / ~1y down.
 * Next low = peak + 1y (~Oct 6 2026). Schematic timing theory — NFA.
 */
const THEORY_PEAK_MS = dateUtcMs(2025, 10, 6);
const THEORY_LOW_MS = dateUtcMs(2022, 10, 6); /* peak − 3y */
const THEORY_NEXT_LOW_MS = dateUtcMs(2026, 10, 6); /* peak + 1y */

const YEAR_WAYPOINTS: DatedWaypoint[] = [
  { at: THEORY_LOW_MS, points: [TROUGH] },
  {
    at: THEORY_PEAK_MS,
    points: [TROUGH, MID_UP, PEAK],
  },
  {
    at: THEORY_NEXT_LOW_MS,
    points: [PEAK, NEXT_TROUGH],
  },
];

/** Next lap on the same Nike-tick loop after peak + 1y. */
const NEXT_LAP_WAYPOINTS: DatedWaypoint[] = [
  { at: THEORY_NEXT_LOW_MS, points: [TROUGH] },
  {
    at: dateUtcMs(2029, 10, 6), /* +3y ascent */
    points: [TROUGH, MID_UP, PEAK],
  },
  {
    at: dateUtcMs(2030, 10, 6), /* +1y descent */
    points: [PEAK, NEXT_TROUGH],
  },
];

function melbourneYmd(nowMs: number = Date.now()): { y: number; m: number; d: number } {
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

/** True once Melbourne calendar is past theory next-low (peak + 1y). */
function isPastTheoryNextLow(nowMs: number = Date.now()): boolean {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  return now > THEORY_NEXT_LOW_MS;
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pointAlong(points: Pt[], t: number): Pt {
  if (points.length === 1) return points[0];
  const clamped = Math.min(1, Math.max(0, t));
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = dist(points[i], points[i + 1]);
    segs.push(d);
    total += d;
  }
  if (total <= 0) return points[points.length - 1];
  let remain = clamped * total;
  for (let i = 0; i < segs.length; i++) {
    if (remain <= segs[i] || i === segs.length - 1) {
      const u = segs[i] <= 0 ? 1 : remain / segs[i];
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
    }
    remain -= segs[i];
  }
  return points[points.length - 1];
}

function livePositionOnWaypoints(now: number, waypoints: DatedWaypoint[]): Pt {
  const ends = waypoints.map((w) => w.at);
  if (now <= ends[0]) {
    const first = waypoints[0];
    return first.points[first.points.length - 1];
  }
  if (now >= ends[ends.length - 1]) {
    const last = waypoints[waypoints.length - 1];
    return last.points[last.points.length - 1];
  }
  for (let i = 0; i < waypoints.length - 1; i++) {
    const t0 = ends[i];
    const t1 = ends[i + 1];
    if (now > t1) continue;
    const frac = (now - t0) / (t1 - t0);
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (b.points.length > 1) {
      return pointAlong(b.points, frac);
    }
    const from = a.points[a.points.length - 1];
    const to = b.points[b.points.length - 1];
    return {
      x: from.x + (to.x - from.x) * frac,
      y: from.y + (to.y - from.y) * frac,
    };
  }
  const last = waypoints[waypoints.length - 1];
  return last.points[last.points.length - 1];
}

function livePositionFromNow(nowMs: number = Date.now()): Pt {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  if (now > THEORY_NEXT_LOW_MS) {
    return livePositionOnWaypoints(now, NEXT_LAP_WAYPOINTS);
  }
  return livePositionOnWaypoints(now, YEAR_WAYPOINTS);
}

function SpanArrow({
  x1,
  x2,
  y,
  label,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
}) {
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

export default function BtcFourYearCycleChart() {
  const TOP_PAD = 64;
  const BOTTOM_PAD = 28;
  const CHART_H = 420;
  const SVG_H = CHART_H + TOP_PAD + BOTTOM_PAD;

  type TipKind = "halving" | "peaks" | "lows" | null;
  const [tip, setTip] = useState<TipKind>(null);
  const [lowsAt, setLowsAt] = useState<"cycle" | "next">("cycle");
  const halvingRows = halvingHoverRows();
  const peakRows = cycleTopHoverRows();
  const lowRows = cycleBottomHoverRows();

  const live = livePositionFromNow();
  void isPastTheoryNextLow(); /* reserved if we re-add lap-aware accents later */
  const liveLabelDx = -36;
  const liveLabelDy = 22;

  const tipPoint =
    tip === "halving"
      ? { x: HALVING_DOT_X, y: HALVING_DOT_Y }
      : tip === "peaks"
        ? { x: PEAK.x, y: PEAK.y }
        : tip === "lows"
          ? lowsAt === "next"
            ? NEXT_TROUGH
            : TROUGH
          : null;
  const tipLeftPct = tipPoint ? (tipPoint.x / SVG_W) * 100 : 0;
  const tipTopPct = tipPoint ? ((tipPoint.y + TOP_PAD) / SVG_H) * 100 : 0;

  return (
    <div className="relative mt-6 w-full">
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Bitcoin 4-year cycle theory schematic — Nike-tick silhouette of roughly three years up and one year down with a Live marker that wraps onto the next lap. Hover the blue halving tip or gold cycle low/peak dots for desk dates. Educational rough guide only — not a predictive model or financial advice"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="btc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="btc-live-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <style>{`
          @keyframes btc-live-pulse {
            0% { opacity: 0.55; r: 7; }
            70% { opacity: 0; r: 22; }
            100% { opacity: 0; r: 22; }
          }
          .btc-live-ring {
            animation: btc-live-pulse 2.4s ease-out infinite;
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
        BTC 4 year cycle theory
      </text>
      <text
        x={SVG_W / 2}
        y="42"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        Schematic · ~3 years up · ~1 year down · Live wraps onto the next lap · not a forecast · NFA
      </text>

      <g transform={`translate(0, ${TOP_PAD})`}>
        {/* Soft phase bands — green expansion, blue halving, orange late bull, red reset */}
        <rect
          x={TROUGH.x}
          y="40"
          width={PEAK.x - TROUGH.x}
          height="280"
          fill="#3dcc9a"
          opacity="0.06"
        />
        <rect
          x={HALVING_X0}
          y="40"
          width={HALVING_X1 - HALVING_X0}
          height="280"
          fill={HALVING_BLUE}
          opacity="0.14"
        />
        <rect
          x={HALVING_X0}
          y="40"
          width={3}
          height="280"
          fill={HALVING_BLUE}
          opacity="0.45"
        />
        <rect
          x={HALVING_X1 - 3}
          y="40"
          width={3}
          height="280"
          fill={HALVING_BLUE}
          opacity="0.45"
        />
        <text
          x={(HALVING_X0 + HALVING_X1) / 2}
          y="58"
          textAnchor="middle"
          fill={HALVING_BLUE}
          fontSize="11"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          Halving epoch
        </text>

        <rect
          x={LATE_BULL_X0}
          y="40"
          width={LATE_BULL_X1 - LATE_BULL_X0}
          height="280"
          fill={LATE_BULL_ORANGE}
          opacity="0.06"
        />
        <text
          x={(LATE_BULL_X0 + LATE_BULL_X1) / 2}
          y="58"
          textAnchor="middle"
          fill={LATE_BULL_ORANGE}
          fontSize="11"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
          opacity="0.85"
        >
          Late bull
        </text>
        <rect
          x={PEAK.x}
          y="40"
          width={NEXT_TROUGH.x - PEAK.x}
          height="280"
          fill="#ef6b6b"
          opacity="0.07"
        />

        {[80, 120, 160, 200, 240, 280, 320].map((y) => (
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

        {/* Dashed wrap under the plot */}
        <path
          d={`M ${NEXT_TROUGH.x} ${NEXT_TROUGH.y} L ${NEXT_TROUGH.x + 24} ${348} L ${TROUGH.x - 16} ${348} L ${TROUGH.x} ${TROUGH.y}`}
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

        {/* Nike-tick cycle line */}
        <path
          d={LINE_PATH}
          fill="none"
          stroke="#e8eef7"
          strokeWidth="3.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="url(#btc-glow)"
        />
        <path
          d={LINE_PATH}
          fill="none"
          stroke="#8fa0b8"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray="6 5"
          opacity="0.4"
        />

        {/* Hover-only date card anchor — no click required */}
        <g
          onMouseEnter={() => setTip("halving")}
          onMouseLeave={() => setTip(null)}
          style={{ cursor: "help" }}
          aria-label="Halving dates — hover to view"
        >
          <circle
            cx={HALVING_DOT_X}
            cy={HALVING_DOT_Y}
            r={18}
            fill="transparent"
          />
          <circle
            cx={HALVING_DOT_X}
            cy={HALVING_DOT_Y}
            r={7}
            fill={HALVING_BLUE}
            stroke="#e8eef7"
            strokeWidth={1.75}
            opacity={0.95}
          />
          <circle
            cx={HALVING_DOT_X}
            cy={HALVING_DOT_Y}
            r={2.6}
            fill="#0a0a0a"
          />
          <text
            x={HALVING_DOT_X}
            y={HALVING_DOT_Y + 20}
            textAnchor="middle"
            fill={HALVING_BLUE}
            fontSize="8"
            fontFamily="system-ui, sans-serif"
            fontWeight="600"
            opacity={0.9}
          >
            hover dates
          </text>
        </g>

        {/* Key vertices — hover for desk cycle top/bottom dates */}
        {(
          [
            {
              p: TROUGH,
              label: "Cycle low",
              labelDy: 22,
              kind: "lows" as const,
              lowsWhich: "cycle" as const,
            },
            {
              p: PEAK,
              label: "Cycle peak",
              labelDy: -16,
              kind: "peaks" as const,
              lowsWhich: null,
            },
            {
              p: NEXT_TROUGH,
              label: "Next low",
              labelDy: 22,
              kind: "lows" as const,
              lowsWhich: "next" as const,
            },
          ] as const
        ).map(({ p, label, labelDy, kind, lowsWhich }) => (
          <g
            key={label}
            onMouseEnter={() => {
              if (lowsWhich) setLowsAt(lowsWhich);
              setTip(kind);
            }}
            onMouseLeave={() => setTip(null)}
            style={{ cursor: "help" }}
            aria-label={`${label} dates — hover to view`}
          >
            <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={label === "Cycle peak" ? 5.5 : 4.5}
              fill="#0a0a0a"
              stroke="#d4a017"
              strokeWidth={2.25}
            />
            <text
              x={p.x}
              y={p.y + labelDy}
              textAnchor="middle"
              fill="#9eb0c8"
              fontSize="10"
              fontFamily="system-ui, sans-serif"
              fontWeight="600"
            >
              {label}
            </text>
          </g>
        ))}

        <SpanArrow
          x1={TROUGH.x + 8}
          x2={PEAK.x - 8}
          y={390}
          label="~3 years up"
        />
        <SpanArrow
          x1={PEAK.x + 8}
          x2={NEXT_TROUGH.x - 4}
          y={390}
          label="~1 year down"
        />

        {/* Live pulse */}
        <g filter="url(#btc-live-glow)" aria-label="Live position on cycle path">
          <circle
            className="btc-live-ring"
            cx={live.x}
            cy={live.y}
            r={7}
            fill="none"
            stroke="#3dcc9a"
            strokeWidth="2"
          />
          <circle cx={live.x} cy={live.y} r={5.5} fill="#3dcc9a" />
          <circle cx={live.x} cy={live.y} r={2.2} fill="#e8fff4" />
          <text
            x={live.x + liveLabelDx}
            y={live.y + liveLabelDy}
            textAnchor="middle"
            fill="#3dcc9a"
            fontSize="11"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            Live
          </text>
        </g>
      </g>
    </svg>
      {tip ? (
        <div
          className={
            tip === "halving"
              ? "pointer-events-none absolute z-20 w-[min(18rem,90%)] -translate-x-1/2 -translate-y-[108%] rounded-lg border border-[#3a6aa8] bg-[#0d1520]/95 px-3 py-2.5 shadow-lg shadow-black/50 backdrop-blur-sm"
              : "pointer-events-none absolute z-20 w-[min(18rem,90%)] -translate-x-1/2 -translate-y-[108%] rounded-lg border border-[#8a6a20] bg-[#14100a]/95 px-3 py-2.5 shadow-lg shadow-black/50 backdrop-blur-sm"
          }
          style={{ left: `${tipLeftPct}%`, top: `${tipTopPct}%` }}
          role="tooltip"
        >
          <p
            className={
              tip === "halving"
                ? "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4c9fff]"
                : "text-[11px] font-semibold uppercase tracking-[0.12em] text-[#d4a017]"
            }
          >
            {tip === "halving"
              ? "Halving dates"
              : tip === "peaks"
                ? "Cycle top dates"
                : "Cycle bottom dates"}
          </p>
          <ul className="mt-2 space-y-1.5">
            {tip === "halving"
              ? halvingRows.map((row) => (
                  <li key={row.title} className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] text-[#9eb0c8]">{row.title}</span>
                    <span
                      className={`shrink-0 font-mono text-[11px] ${
                        row.estimated ? "text-[#7eb6ff]" : "text-[#e8eef7]"
                      }`}
                    >
                      {row.detail}
                    </span>
                  </li>
                ))
              : tip === "peaks"
                ? peakRows.map((row, i) => (
                    <li
                      key={`${row.detail}-${i}`}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-[11px] text-[#9eb0c8]">{row.title}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#e8eef7]">
                        {row.detail}
                      </span>
                    </li>
                  ))
                : lowRows.map((row, i) => (
                    <li
                      key={`${row.detail}-${i}`}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="text-[11px] text-[#9eb0c8]">{row.title}</span>
                      <span
                        className={`shrink-0 font-mono text-[11px] ${
                          row.incomplete ? "text-[#b8a060]" : "text-[#e8eef7]"
                        }`}
                      >
                        {row.detail}
                      </span>
                    </li>
                  ))}
          </ul>
          <p className="mt-2 text-[10px] leading-snug text-[#6b7a90]">
            {tip === "halving"
              ? "Next date is the desk estimate (210,000 blocks × ~10 min) until that epoch lands. Educational only · NFA."
              : CYCLE_EXTREMES_DISCLAIMER}
          </p>
        </div>
      ) : null}
    </div>
  );
}
