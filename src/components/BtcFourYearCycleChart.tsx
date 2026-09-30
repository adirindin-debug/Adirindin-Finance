/**
 * BTC 4 year cycle theory schematic (educational diagram).
 * Nike-tick silhouette: simple ~3-year rise, then ~1-year drop onto the
 * next trough. Green Live marker is calendar-dated (Melbourne) along the
 * path and wraps onto the same loop after ~1 year down from the theory peak.
 * Live is computed client-side from the real current date after mount and
 * re-ticks hourly (not frozen at build / static prerender).
 * No stacked calendar years on the diagram — phase labels only.
 * Research only — not prices, not predictive, NFA.
 */

"use client";

import { useState } from "react";
import { halvingHoverRows, halvingProjectedRows } from "@/lib/bitcoinHalving";
import {
  CYCLE_EXTREMES_DISCLAIMER,
  PROJECTED_ANCHOR_NOTE,
  PROJECTED_DATES_NOTE,
  THEORY_CYCLE_YEARS,
  approxFullDate,
  cycleBottomHoverRows,
  cycleTopHoverRows,
  projectedLowHoverRows,
  projectedPeakHoverRows,
  theoryPeakMs,
  theoryTroughMs,
} from "@/lib/btcCycleExtremes";
import { useLiveNow } from "@/lib/useLiveNow";
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

/**
 * Live timing (internal only — not drawn as year labels).
 * Equal ~4y laps anchored on the desk/theory peak Mon 6 Oct 2025
 * (see `btcCycleExtremes.ts`): lap k runs
 *   theory trough (k−1) → theory peak k: ~3y ascent along TROUGH → MID_UP → PEAK
 *   theory peak k → theory trough k:     ~1y descent along PEAK → NEXT_TROUGH
 * Current lap: ~Oct 2022 → ~Oct 2025 peak → ~Oct 2026 theory trough, then the
 * dot wraps onto the same loop (~Oct 2029 peak, ~Oct 2030 trough, …) with no
 * end date. Schematic timing theory — NFA.
 */
type TheoryLap = { lowMs: number; peakMs: number; nextLowMs: number };

function theoryLapAt(nowMs: number): TheoryLap {
  const approxYears =
    (nowMs - theoryPeakMs(0)) / (365.25 * 86_400_000) / THEORY_CYCLE_YEARS;
  let lap = Math.floor(approxYears) - 1;
  /* Step forward until now falls inside (trough k−1, trough k]. */
  while (theoryTroughMs(lap) < nowMs) lap += 1;
  while (theoryTroughMs(lap - 1) >= nowMs) lap -= 1;
  return {
    lowMs: theoryTroughMs(lap - 1),
    peakMs: theoryPeakMs(lap),
    nextLowMs: theoryTroughMs(lap),
  };
}

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

type LiveInfo = {
  pt: Pt;
  daysToTrough: number;
  descending: boolean;
  peakMs: number;
  nextLowMs: number;
};

function liveFromNow(nowMs: number): LiveInfo {
  const now = melbourneDayMs(nowMs);
  const { lowMs, peakMs, nextLowMs } = theoryLapAt(now);
  const descending = now > peakMs;
  const pt = descending
    ? pointAlong([PEAK, NEXT_TROUGH], (now - peakMs) / (nextLowMs - peakMs))
    : pointAlong([TROUGH, MID_UP, PEAK], (now - lowMs) / (peakMs - lowMs));
  return {
    pt,
    daysToTrough: Math.max(0, Math.round((nextLowMs - now) / 86_400_000)),
    descending,
    peakMs,
    nextLowMs,
  };
}

const liveDayLabel = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Melbourne",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

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
  const nowMs = useLiveNow();
  const halvingRows = halvingHoverRows(nowMs ?? undefined);
  const halvingProjected = halvingProjectedRows();
  const peakRows = cycleTopHoverRows();
  const lowRows = cycleBottomHoverRows();
  const peakProjected = projectedPeakHoverRows();
  const lowProjected = projectedLowHoverRows();

  /* null until mounted — SSR/prerender renders no dot rather than a stale one */
  const liveInfo = nowMs === null ? null : liveFromNow(nowMs);
  const live = liveInfo?.pt ?? null;
  const liveLabelDx = -42;
  /* Near a trough the pill sits level-left so it clears the Cycle low / Next low labels */
  const liveLabelDy = live && live.y > TROUGH.y - 30 ? 4 : 20;

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
      aria-label="Bitcoin 4-year cycle theory schematic — Nike-tick silhouette of roughly three years up and one year down with a Live marker that wraps onto the next lap. Hover the blue halving tip or gold cycle low/peak dots for desk dates and projected (theoretical) dates. Educational rough guide only — not a predictive model or financial advice"
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

        {/* Live pulse — client-computed from today's Melbourne date (hidden until mounted) */}
        {live && liveInfo ? (
          <g filter="url(#btc-live-glow)" aria-label="Live position on cycle path">
            <title>
              {`Live · ${liveDayLabel.format(new Date(nowMs as number))} (Melbourne) · ${
                liveInfo.descending
                  ? `~${liveInfo.daysToTrough} days to the ${approxFullDate(
                      liveInfo.nextLowMs,
                    )} theory trough`
                  : `~3y ascent toward the ${approxFullDate(liveInfo.peakMs)} theory peak`
              } (equal ~${THEORY_CYCLE_YEARS}y timing · NFA)`}
            </title>
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
          className={`pointer-events-none absolute z-20 w-[min(18rem,90%)] rounded-lg border px-3 py-2.5 shadow-lg shadow-black/50 backdrop-blur-sm ${
            tip === "halving"
              ? "border-[#3a6aa8] bg-[#0d1520]/95"
              : "border-[#8a6a20] bg-[#14100a]/95"
          } ${
            /* Keep cards on-screen: peak card opens below the crest; edge lows hug inward */
            tip === "peaks" ? "translate-y-4" : "-translate-y-[108%]"
          } ${
            tip === "lows" && lowsAt === "next"
              ? "-translate-x-[88%]"
              : tip === "lows"
                ? "-translate-x-[12%]"
                : "-translate-x-1/2"
          }`}
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
          {/* Projected (theoretical) — dashed divider, italic, muted, ~ prefix */}
          <div className="mt-2.5 border-t border-dashed border-[#3a4558] pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b9bb4]">
              Projected (theoretical)
            </p>
            {tip !== "halving" ? (
              <p className="mt-0.5 text-[10px] italic text-[#7a8aa0]">
                {PROJECTED_ANCHOR_NOTE}
              </p>
            ) : null}
            <ul className="mt-1.5 space-y-1">
              {(tip === "halving"
                ? halvingProjected
                : tip === "peaks"
                  ? peakProjected
                  : lowProjected
              ).map((row) => (
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
                  <span className="shrink-0 font-mono text-[11px] text-[#a8b4c6]">
                    {row.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-2 text-[10px] leading-snug text-[#6b7a90]">
            {tip === "halving"
              ? "Next date is the desk estimate (210,000 blocks × ~10 min) until that epoch lands; the 6th adds another ~210,000 blocks. Educational only · NFA."
              : CYCLE_EXTREMES_DISCLAIMER}
          </p>
          {tip === "lows" ? (
            <p className="mt-1 text-[10px] leading-snug text-[#6b7a90]">
              “Current bottom” is the desk-logged low so far; the Live dot follows the equal ~4y
              theory trough.
            </p>
          ) : null}
          <p className="mt-1 text-[10px] italic leading-snug text-[#8b9bb4]">
            {PROJECTED_DATES_NOTE}
          </p>
        </div>
      ) : null}
    </div>
  );
}
