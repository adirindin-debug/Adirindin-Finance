/**
 * Classic “BTC 4 year cycle theory” schematic (educational diagram).
 * Jagged phase line with stacked historical/framework years. Next-lap
 * theory years sit on the classic columns (future above older) — a
 * reset/wrap onto the same loop after the framework ~Jul 2026 low, not a
 * linear runway. Green Live marker is calendar-dated (Melbourne): classic
 * lap through the 2026 low, then wraps to cycleLow and walks the same
 * geometric loop on next-lap theory years (~2026→2030), parking at nextLow
 * after end-2030. Outward pulse — not a decorative tour.
 * Active-cycle years render bold yellow (current lap before the 2026 low;
 * next-lap theory years after). Research only — not prices, not predictive, NFA.
 */

type YearStack = {
  years: string[];
  placement: "above" | "below";
  /** Horizontal offset from vertex (keeps stacks from colliding) */
  dx?: number;
  /** Extra vertical clearance from the vertex */
  dyClear?: number;
};

/**
 * Vertex coordinates for the jagged educational cycle line (not price data).
 * Classic ~4y silhouette: trough → early bull → mid dig → ascent (halving zone)
 * → late bull → major peak → bear → next low.
 */
const POINTS = [
  { id: "cycleLow", x: 88, y: 305 },
  { id: "earlyBull", x: 210, y: 168 },
  /** Mid-cycle dig — sits slightly right of dead centre of the upswing */
  { id: "midPause", x: 320, y: 222 },
  /** Halving zone on ascent — geometry kept; gold callouts mark epochs */
  { id: "halvingZone", x: 410, y: 138 },
  { id: "lateBull", x: 510, y: 88 },
  { id: "peak", x: 610, y: 40 },
  { id: "bear", x: 690, y: 228 },
  /** Framework ~Jul 2026 low / restart — schematic, not a prediction */
  { id: "nextLow", x: 760, y: 298 },
] as const;

/** Unlabeled steepening inflection late-bull → peak (same idea as RE LAND_ACCEL). */
const LATE_ACCEL = { x: 560, y: 62 };

const YEAR_STACKS: Record<(typeof POINTS)[number]["id"], YearStack> = {
  cycleLow: {
    /** Next-lap / framework lows above older troughs */
    years: ["2030", "2026", "2022", "2018", "2015", "2011"],
    placement: "above",
  },
  earlyBull: {
    years: ["2027", "2023", "2019", "2016"],
    placement: "above",
    dx: -6,
    dyClear: 6,
  },
  midPause: {
    years: ["2028", "2024", "2020"],
    placement: "below",
    dx: -4,
    dyClear: 2,
  },
  /** Geometry / Live path only — halving epochs called out separately in gold */
  halvingZone: {
    years: [],
    placement: "above",
  },
  lateBull: {
    years: [],
    placement: "above",
  },
  peak: {
    years: ["2029", "2025", "2021", "2017", "2013"],
    placement: "above",
    dx: 18,
    dyClear: -2,
  },
  bear: {
    years: ["2026", "2022", "2018"],
    placement: "below",
    dx: 4,
  },
  nextLow: {
    years: ["2030", "2026", "2022"],
    placement: "above",
    dx: 4,
  },
};

const PATH_VERTS = [
  POINTS[0], // cycleLow
  POINTS[1], // earlyBull
  POINTS[2], // midPause
  POINTS[3], // halvingZone
  POINTS[4], // lateBull
  LATE_ACCEL,
  POINTS[5], // peak
  POINTS[6], // bear
  POINTS[7], // nextLow
] as const;

const LINE_PATH = PATH_VERTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

const SVG_W = 820;

type Pt = { x: number; y: number };

/** Waypoint keyed by UTC ms (end-of-day or framework date). */
type DatedWaypoint = { at: number; points: Pt[] };

/** End of calendar day Y-M-D as UTC ms (schematic; Melbourne date used for "now"). */
function dateUtcMs(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

function endOfYearMs(year: number): number {
  return dateUtcMs(year, 12, 31);
}

/**
 * Classic-lap framework dates. Ends at the Jul 1 2026 framework low
 * (desk map marker) — schematic study date, not a prediction.
 */
const YEAR_WAYPOINTS: DatedWaypoint[] = [
  { at: endOfYearMs(2022), points: [{ x: POINTS[0].x, y: POINTS[0].y }] },
  { at: endOfYearMs(2023), points: [{ x: POINTS[1].x, y: POINTS[1].y }] },
  {
    at: endOfYearMs(2024),
    points: [
      { x: POINTS[1].x, y: POINTS[1].y },
      { x: POINTS[2].x, y: POINTS[2].y },
      { x: POINTS[3].x, y: POINTS[3].y },
    ],
  },
  {
    /** Framework BTC Top ~Oct 2025 (desk map) */
    at: dateUtcMs(2025, 10, 6),
    points: [
      { x: POINTS[3].x, y: POINTS[3].y },
      { x: POINTS[4].x, y: POINTS[4].y },
      { x: LATE_ACCEL.x, y: LATE_ACCEL.y },
      { x: POINTS[5].x, y: POINTS[5].y },
    ],
  },
  {
    /** Framework Jul 1 2026 low — end of current lap */
    at: dateUtcMs(2026, 7, 1),
    points: [
      { x: POINTS[5].x, y: POINTS[5].y },
      { x: POINTS[6].x, y: POINTS[6].y },
      { x: POINTS[7].x, y: POINTS[7].y },
    ],
  },
];

/**
 * Next-lap theory years on the same geometric loop after the ~Jul 2026 reset.
 * Live jumps from nextLow to cycleLow, then walks these waypoints;
 * parks at nextLow after end-2030 (no third lap).
 */
const NEXT_LAP_WAYPOINTS: DatedWaypoint[] = [
  /** Restart / wrap start — left trough at the framework low date */
  { at: dateUtcMs(2026, 7, 1), points: [{ x: POINTS[0].x, y: POINTS[0].y }] },
  { at: endOfYearMs(2027), points: [{ x: POINTS[1].x, y: POINTS[1].y }] },
  {
    at: endOfYearMs(2028),
    points: [
      { x: POINTS[1].x, y: POINTS[1].y },
      { x: POINTS[2].x, y: POINTS[2].y },
      { x: POINTS[3].x, y: POINTS[3].y },
      { x: POINTS[4].x, y: POINTS[4].y },
    ],
  },
  {
    at: endOfYearMs(2029),
    points: [
      { x: POINTS[4].x, y: POINTS[4].y },
      { x: LATE_ACCEL.x, y: LATE_ACCEL.y },
      { x: POINTS[5].x, y: POINTS[5].y },
    ],
  },
  {
    at: endOfYearMs(2030),
    points: [
      { x: POINTS[5].x, y: POINTS[5].y },
      { x: POINTS[6].x, y: POINTS[6].y },
      { x: POINTS[7].x, y: POINTS[7].y },
    ],
  },
];

/** Classic-lap framework years on the current cycle (bold before wrap). */
const CURRENT_CYCLE_YEARS = new Set([
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
]);

/** Next-lap theory timing years — bold yellow only after the ~Jul 2026 low. */
const NEXT_CYCLE_YEARS = new Set(["2027", "2028", "2029", "2030"]);

const ACTIVE_YEAR_FILL = "#ffe14a";
const INACTIVE_YEAR_FILL = "#e8eef7";
const MUTED_YEAR_FILL = "#c8d0dc";

/** Framework low date (Melbourne calendar comparison). */
const FRAMEWORK_LOW = { y: 2026, m: 7, d: 1 };

/**
 * Melbourne-local calendar parts (same zone as Live marker).
 */
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

/**
 * True once Melbourne calendar is past the framework Jul 1 2026 low.
 * Before that, classic current-lap years stay bold yellow; after, next-lap theory years do.
 */
function isPast2026Low(nowMs: number = Date.now()): boolean {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  const low = Date.UTC(FRAMEWORK_LOW.y, FRAMEWORK_LOW.m - 1, FRAMEWORK_LOW.d, 12, 0, 0, 0);
  return now > low;
}

function dist(a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.hypot(dx, dy);
}

/** Interpolate along a polyline by normalised distance t ∈ [0, 1]. */
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

/**
 * Walk calendar time along dated waypoints. Multi-point destination polylines
 * use path-length interpolation via pointAlong; single-point legs are straight lerps.
 */
function livePositionOnWaypoints(now: number, waypoints: DatedWaypoint[]): Pt {
  const ends = waypoints.map((w) => w.at);
  if (now <= ends[0]) {
    return waypoints[0].points[waypoints[0].points.length - 1];
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

/**
 * Melbourne-local Y-M-D → Live (cx, cy) on the cycle path.
 * Through Jul 1 2026: classic YEAR_WAYPOINTS.
 * After: intentional reset to cycleLow, then NEXT_LAP_WAYPOINTS
 * on the same geometric loop; parks at nextLow after end-2030.
 */
function livePositionFromNow(nowMs: number = Date.now()): Pt {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);

  if (isPast2026Low(nowMs)) {
    return livePositionOnWaypoints(now, NEXT_LAP_WAYPOINTS);
  }
  return livePositionOnWaypoints(now, YEAR_WAYPOINTS);
}

function YearColumn({
  x,
  pointY,
  stack,
  past2026Low,
}: {
  x: number;
  pointY: number;
  stack: YearStack;
  past2026Low: boolean;
}) {
  const lineH = 13;
  const gap = 1;
  const n = stack.years.length;
  const totalH = n * lineH + Math.max(0, n - 1) * gap;
  const clear = 14 + (stack.dyClear ?? 0);
  const cx = x + (stack.dx ?? 0);
  const startY =
    stack.placement === "above"
      ? pointY - clear - totalH + lineH
      : pointY + clear + lineH * 0.35;

  return (
    <g>
      {stack.dx != null && Math.abs(stack.dx) >= 12 && (
        <line
          x1={x}
          y1={pointY - (stack.placement === "above" ? 8 : -8)}
          x2={cx}
          y2={
            stack.placement === "above"
              ? startY + totalH - lineH * 0.2
              : startY - lineH * 0.35
          }
          stroke="#3a4558"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}
      {stack.years.map((yr, i) => {
        const y = startY + i * (lineH + gap);
        const isCurrentLap = CURRENT_CYCLE_YEARS.has(yr);
        const isNextLap = NEXT_CYCLE_YEARS.has(yr);
        let fill = MUTED_YEAR_FILL;
        let bold = false;
        if (isCurrentLap) {
          if (!past2026Low) {
            fill = ACTIVE_YEAR_FILL;
            bold = true;
          } else if (yr === "2026") {
            fill = INACTIVE_YEAR_FILL;
            bold = false;
          } else {
            fill = MUTED_YEAR_FILL;
          }
        } else if (isNextLap && past2026Low) {
          fill = ACTIVE_YEAR_FILL;
          bold = true;
        }
        return (
          <text
            key={`${yr}-${i}`}
            x={cx}
            y={y}
            textAnchor="middle"
            fill={fill}
            fontSize={bold ? 11 : 10}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontWeight={bold ? 700 : 500}
            textDecoration={bold ? "underline" : undefined}
          >
            {yr}
          </text>
        );
      })}
    </g>
  );
}

/** Orange double-headed span under the chart. */
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
  const cycleLow = POINTS[0];
  const earlyBull = POINTS[1];
  const midPause = POINTS[2];
  const halvingZone = POINTS[3];
  const peak = POINTS[5];
  const bear = POINTS[6];
  const nextLow = POINTS[7];

  const TOP_PAD = 70;
  const BOTTOM_PAD = 36;
  const SVG_H = 500 + TOP_PAD + BOTTOM_PAD;

  const live = livePositionFromNow();
  const past2026Low = isPast2026Low();
  const liveLabelDx = -42;
  const liveLabelDy = 20;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="mt-6 h-auto w-full overflow-visible"
      role="img"
      aria-label="Bitcoin 4-year cycle theory schematic with stacked historical and next-lap theory years on the same loop — educational rough guide only, not a predictive model or financial advice"
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
      </defs>

      <rect width={SVG_W} height={SVG_H} fill="#0a0a0a" rx="8" />

      <text
        x={SVG_W / 2}
        y="26"
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
        y="44"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        Schematic · ~4y framing · bold yellow = active cycle years · muted = inactive / next-lap until after Jul 2026 · not a forecast · NFA
      </text>

      <g transform={`translate(0, ${TOP_PAD})`}>
        {/* Soft ~3y bull / ~1y bear guide bands */}
        <rect
          x={cycleLow.x}
          y="58"
          width={peak.x - cycleLow.x}
          height="290"
          fill="#3dcc9a"
          opacity="0.05"
        />
        <rect
          x={peak.x}
          y="58"
          width={nextLow.x - peak.x}
          height="290"
          fill="#ef6b6b"
          opacity="0.06"
        />
        {/* Soft gold band around halving zone on the ascent */}
        <rect
          x={midPause.x}
          y="58"
          width={halvingZone.x + 40 - midPause.x}
          height="290"
          fill="#d4a017"
          opacity="0.04"
        />

        {[90, 130, 170, 210, 250, 290, 330].map((y) => (
          <line
            key={y}
            x1="56"
            y1={y}
            x2={nextLow.x + 28}
            y2={y}
            stroke="#1a1a1a"
            strokeWidth="1"
          />
        ))}

        {/* Soft wrap hint: dashed return under the plot */}
        <path
          d={`M ${nextLow.x} ${nextLow.y} L ${nextLow.x + 28} ${348} L ${cycleLow.x - 18} ${348} L ${cycleLow.x} ${cycleLow.y}`}
          fill="none"
          stroke="#5a6a80"
          strokeWidth="1.75"
          strokeDasharray="5 5"
          opacity="0.55"
          strokeLinejoin="round"
        />
        <text
          x={(cycleLow.x + nextLow.x) / 2}
          y={362}
          textAnchor="middle"
          fill="#6b7a90"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Next lap resets onto the same loop →
        </text>

        <path
          d={LINE_PATH}
          fill="none"
          stroke="#e8eef7"
          strokeWidth="3.5"
          strokeLinejoin="miter"
          strokeLinecap="square"
          filter="url(#btc-glow)"
        />

        <path
          d={LINE_PATH}
          fill="none"
          stroke="#8fa0b8"
          strokeWidth="2"
          strokeLinejoin="miter"
          strokeLinecap="square"
          strokeDasharray="6 5"
          opacity="0.45"
        />

        {/* Vertex dots — skip unlabeled geometry (halvingZone / lateBull kept for path) */}
        {POINTS.filter((p) => p.id !== "halvingZone" && p.id !== "lateBull").map(
          (p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.id === "peak" ? 5.5 : 4}
              fill="#0a0a0a"
              stroke={
                p.id === "peak" || p.id === "nextLow" || p.id === "cycleLow"
                  ? "#d4a017"
                  : "#e8eef7"
              }
              strokeWidth={
                p.id === "peak" || p.id === "nextLow" || p.id === "cycleLow"
                  ? 2.25
                  : 1.75
              }
            />
          ),
        )}

        {(
          [
            "cycleLow",
            "earlyBull",
            "midPause",
            "peak",
            "bear",
            "nextLow",
          ] as const
        ).map((id) => {
          const pt = POINTS.find((p) => p.id === id)!;
          const stack = YEAR_STACKS[id];
          if (stack.years.length === 0) return null;
          return (
            <YearColumn
              key={id}
              x={pt.x}
              pointY={pt.y}
              stack={stack}
              past2026Low={past2026Low}
            />
          );
        })}

        {/* Gold Halving epoch callouts on the ascent — protocol markers, not trade signals */}
        <g aria-label="Halving epoch callouts (protocol ~4y) — educational only">
          <text
            x={halvingZone.x}
            y={halvingZone.y - 18}
            textAnchor="middle"
            fill="#d4a017"
            fontSize="10"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            Halving
          </text>
          <text
            x={halvingZone.x}
            y={halvingZone.y - 6}
            textAnchor="middle"
            fill="#b8962e"
            fontSize="8"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            ~2012 · 2016 · 2020 · 2024 · ~2028
          </text>
          <line
            x1={halvingZone.x}
            y1={halvingZone.y - 22}
            x2={halvingZone.x}
            y2={halvingZone.y - 4}
            stroke="#d4a017"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.7"
          />
        </g>

        <text
          x={earlyBull.x - 52}
          y={earlyBull.y - 8}
          textAnchor="end"
          fill="#8b9bb4"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Early bull
        </text>
        <text
          x={midPause.x + 48}
          y={midPause.y + 4}
          textAnchor="start"
          fill="#8b9bb4"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Mid pause
        </text>

        {/* Green Live dot — classic lap then next-lap wrap; pulse resonates out */}
        <g
          aria-label="Live marker positioned by Melbourne calendar date on the cycle path (classic lap, then next-lap wrap after Jul 2026 framework low)"
          filter="url(#btc-live-glow)"
        >
          <circle
            cx={live.x}
            cy={live.y}
            r="6"
            fill="none"
            stroke="#2fd67b"
            strokeWidth="1.5"
            opacity="0"
          >
            <animate
              attributeName="r"
              values="5;20"
              dur="2.5s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.75;0"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={live.x}
            cy={live.y}
            r="6"
            fill="none"
            stroke="#7dffb0"
            strokeWidth="1"
            opacity="0"
          >
            <animate
              attributeName="r"
              values="5;20"
              dur="2.5s"
              begin="1.25s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.55;0"
              dur="2.5s"
              begin="1.25s"
              repeatCount="indefinite"
            />
          </circle>
          <circle
            cx={live.x}
            cy={live.y}
            r="5.5"
            fill="#2fd67b"
            stroke="#9dffc4"
            strokeWidth="1.5"
          />
          <circle cx={live.x} cy={live.y} r="2" fill="#0a0a0a" opacity="0.55" />
          <rect
            x={live.x + liveLabelDx}
            y={live.y + liveLabelDy - 10}
            width="34"
            height="14"
            rx="3"
            fill="#0f2418"
            stroke="#2fd67b"
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

        <text
          x={cycleLow.x}
          y={398}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Cycle low
        </text>
        <text
          x={(earlyBull.x + peak.x) / 2}
          y={398}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          ~3y bull stretch
        </text>
        <text
          x={bear.x}
          y={398}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          ~1y bear / reset
        </text>

        <SpanArrow x1={cycleLow.x} x2={peak.x} y={422} label="~3 years bull" />
        <SpanArrow x1={peak.x} x2={nextLow.x} y={422} label="~1 year bear" />

        <text
          x={SVG_W / 2}
          y={458}
          textAnchor="middle"
          fill="#6b7a90"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Bold yellow years mark the active cycle (current lap before Jul 2026 low; next-lap theory years after). Framework dates — not predictions.
        </text>

        <rect
          x="40"
          y="474"
          width={SVG_W - 80}
          height="48"
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
          Next-lap theory years on columns (future above older): rough guide on the repeating cycle shape — not a predictive model.
        </text>
        <text
          x={SVG_W / 2}
          y="510"
          textAnchor="middle"
          fill="#9eb0c8"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Not to be relied on for market timing. Research / educational purposes only. Not financial advice (NFA).
        </text>
      </g>
    </svg>
  );
}
