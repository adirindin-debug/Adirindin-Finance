/**
 * Classic “18.6 Year Real Estate Cycle theory” schematic (educational diagram).
 * Jagged phase line with stacked historical/framework years. Next-cycle
 * theory waypoints (≈2037 / 2039 / 2044 / 2048) overlay the same loop
 * shape — a reset/wrap onto the classic schematic, not a linear runway
 * past 2030. Green Live marker is calendar-dated on classic year vertices
 * (end-of-year → vertex), with an outward pulse — not a decorative tour.
 * Active-cycle years render bold yellow (current lap before end-2030; next-lap
 * theory years after). Research only — not prices, not predictive, not for timing.
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
 * Classic silhouette: modest first half → land-boom ascent → steepening final leg into a
 * high major peak (Land Boom callouts in the winner’s-curse crest zone) → drawdown → recovery.
 */
const POINTS = [
  { id: "recovery", x: 88, y: 305 },
  { id: "midPeak", x: 210, y: 182 },
  { id: "midSlow", x: 285, y: 228 },
  /** Land boom — still mid-ascent; leave room for a steeper final leg into the peak */
  { id: "landBoom", x: 430, y: 148 },
  /** Major peak — high so the post-2024 land-boom upswing dominates */
  { id: "peak", x: 610, y: 42 },
  /** Clear decline, trough near mid-slowdown depth (not below recovery) */
  { id: "downturn", x: 680, y: 230 },
  /** Assumed ~2030 cycle low / restart — schematic framework, not a prediction */
  { id: "next", x: 760, y: 182 },
] as const;

/**
 * Next-lap theory waypoints mapped onto the classic loop (reset/wrap),
 * not a linear x-axis extension. Conceptual only — rough guide.
 */
const THEORY_OVERLAY: {
  id: (typeof POINTS)[number]["id"];
  year: string;
  caption: string;
  placement: "above" | "below";
  dx?: number;
  dy?: number;
}[] = [
  {
    id: "midPeak",
    year: "2037",
    caption: "Theory mid",
    placement: "below",
    dx: -86,
    dy: 32,
  },
  {
    id: "midSlow",
    year: "2039",
    caption: "Theory dip",
    placement: "below",
    dx: 74,
    dy: 26,
  },
  {
    id: "peak",
    year: "2044",
    caption: "Theory top",
    /** Park far right of crest — clear of Live, peak years, Land Boom callouts */
    placement: "above",
    dx: 132,
    dy: 14,
  },
  {
    id: "next",
    year: "2048",
    caption: "Theory low",
    placement: "below",
    dx: 62,
    dy: 18,
  },
];

/**
 * Geometry-only inflection after the 2024 land-boom vertex: hold a modest rise,
 * then a clearly steeper final upswing into the 2026 major peak — matching the
 * classic diagram silhouette without adding a labeled vertex.
 */
const LAND_ACCEL = { x: 525, y: 128 };

const YEAR_STACKS: Record<(typeof POINTS)[number]["id"], YearStack> = {
  recovery: {
    years: ["2012", "1994", "1975"],
    placement: "above",
  },
  midPeak: {
    years: ["2019", "2000", "1981"],
    placement: "above",
    dx: -10,
    dyClear: 8,
  },
  midSlow: {
    years: ["2022", "2002", "1982"],
    placement: "below",
    dx: -8,
    dyClear: 4,
  },
  landBoom: {
    years: ["2024"],
    placement: "above",
    dx: -10,
    dyClear: 6,
  },
  peak: {
    years: ["2026", "2007", "1989"],
    placement: "above",
    /** Right + up so stack clears crest, Live badge, Land Boom callouts */
    dx: 40,
    dyClear: 20,
  },
  downturn: {
    years: ["2028", "2009", "1991", "1972"],
    placement: "below",
    dx: -4,
  },
  next: {
    years: ["2030", "2011", "1993", "1974"],
    placement: "above",
    dx: 6,
  },
};

const PATH_VERTS = [
  POINTS[0],
  POINTS[1],
  POINTS[2],
  POINTS[3], // landBoom (2024)
  LAND_ACCEL, // steepening inflection — unlabeled
  POINTS[4], // peak (2026)
  POINTS[5],
  POINTS[6],
] as const;

const LINE_PATH = PATH_VERTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

const SVG_W = 820;

type Pt = { x: number; y: number };

/**
 * Classic labelled year vertices (framework years). Each year maps to
 * end-of-calendar-year on that vertex — so end-2026 sits at the peak.
 * Between 2024→2026 the path includes the unlabeled LAND_ACCEL inflection.
 */
const YEAR_WAYPOINTS: { year: number; points: Pt[] }[] = [
  { year: 2012, points: [{ x: POINTS[0].x, y: POINTS[0].y }] },
  { year: 2019, points: [{ x: POINTS[1].x, y: POINTS[1].y }] },
  { year: 2022, points: [{ x: POINTS[2].x, y: POINTS[2].y }] },
  { year: 2024, points: [{ x: POINTS[3].x, y: POINTS[3].y }] },
  {
    year: 2026,
    points: [
      { x: POINTS[3].x, y: POINTS[3].y },
      { x: LAND_ACCEL.x, y: LAND_ACCEL.y },
      { x: POINTS[4].x, y: POINTS[4].y },
    ],
  },
  { year: 2028, points: [{ x: POINTS[5].x, y: POINTS[5].y }] },
  { year: 2030, points: [{ x: POINTS[6].x, y: POINTS[6].y }] },
];

/** End of calendar year Y as UTC ms (schematic; Melbourne date used for "now"). */
function endOfYearMs(year: number): number {
  return Date.UTC(year, 11, 31, 23, 59, 59, 999);
}

/** Classic-lap framework years on the current cycle (top of each stack). */
const CURRENT_CYCLE_YEARS = new Set([
  "2012",
  "2019",
  "2022",
  "2024",
  "2026",
  "2028",
  "2030",
]);

/** Next-lap theory timing years — bold yellow only after the ~2030 low. */
const NEXT_CYCLE_YEARS = new Set(["2037", "2039", "2044", "2048"]);

/** Bold yellow for the active cycle highlight. */
const ACTIVE_YEAR_FILL = "#ffe14a";
/** White / neutral once a year is no longer the active highlight. */
const INACTIVE_YEAR_FILL = "#e8eef7";
const MUTED_YEAR_FILL = "#c8d0dc";

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
 * True once Melbourne calendar is past end-2030 (assumed ~2030 low / restart).
 * Before that, classic current-lap years stay bold yellow; after, next-lap theory years do.
 */
function isPast2030Low(nowMs: number = Date.now()): boolean {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  return now > endOfYearMs(2030);
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
 * Melbourne-local Y-M-D → Live (cx, cy) on the classic path.
 * Linear in calendar time between neighbouring year waypoints; on the
 * 2024→2026 leg, movement follows path length through LAND_ACCEL.
 */
function livePositionFromNow(nowMs: number = Date.now()): Pt {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);

  const ends = YEAR_WAYPOINTS.map((w) => endOfYearMs(w.year));
  if (now <= ends[0]) {
    return YEAR_WAYPOINTS[0].points[YEAR_WAYPOINTS[0].points.length - 1];
  }
  if (now >= ends[ends.length - 1]) {
    const last = YEAR_WAYPOINTS[YEAR_WAYPOINTS.length - 1];
    return last.points[last.points.length - 1];
  }

  for (let i = 0; i < YEAR_WAYPOINTS.length - 1; i++) {
    const t0 = ends[i];
    const t1 = ends[i + 1];
    if (now > t1) continue;
    const frac = (now - t0) / (t1 - t0);
    const a = YEAR_WAYPOINTS[i];
    const b = YEAR_WAYPOINTS[i + 1];
    // Segment geometry: start at end of prior waypoint, end at next year vertex.
    // For 2026 entry, YEAR_WAYPOINTS[2026].points is landBoom→accel→peak; use that
    // full polyline when leaving 2024. Otherwise straight lerp between vertices.
    if (b.year === 2026 && b.points.length > 1) {
      return pointAlong(b.points, frac);
    }
    const from = a.points[a.points.length - 1];
    const to = b.points[b.points.length - 1];
    return {
      x: from.x + (to.x - from.x) * frac,
      y: from.y + (to.y - from.y) * frac,
    };
  }

  const last = YEAR_WAYPOINTS[YEAR_WAYPOINTS.length - 1];
  return last.points[last.points.length - 1];
}

function YearColumn({
  x,
  pointY,
  stack,
  past2030,
}: {
  x: number;
  pointY: number;
  stack: YearStack;
  past2030: boolean;
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
      {/* Short leader when stack is offset horizontally */}
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
        // Before end-2030: current-lap years bold yellow. After: 2030 goes white; others stay muted.
        let fill = MUTED_YEAR_FILL;
        let bold = false;
        if (isCurrentLap) {
          if (!past2030) {
            fill = ACTIVE_YEAR_FILL;
            bold = true;
          } else if (yr === "2030") {
            fill = INACTIVE_YEAR_FILL;
            bold = false;
          } else {
            fill = MUTED_YEAR_FILL;
          }
        }
        return (
          <text
            key={yr}
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

/** Next-lap theory label at a classic loop vertex — muted until past ~2030, then bold yellow. */
function TheoryOverlayLabel({
  x,
  y,
  year,
  caption,
  placement,
  dx = 0,
  dy = 0,
  active,
}: {
  x: number;
  y: number;
  year: string;
  caption: string;
  placement: "above" | "below";
  dx?: number;
  dy?: number;
  /** True after end-2030 — next-lap timing years become the bold yellow highlight */
  active?: boolean;
}) {
  const cx = x + dx;
  const baseY = y + dy;
  const yearY = placement === "above" ? baseY - 18 : baseY + 22;
  const capY = placement === "above" ? baseY - 30 : baseY + 34;
  const yearFill = active ? ACTIVE_YEAR_FILL : "#8fa0b8";
  const haloStroke = active ? ACTIVE_YEAR_FILL : "#8fa0b8";
  return (
    <g opacity={active ? 1 : 0.78}>
      {Math.abs(dx) >= 14 && (
        <line
          x1={x}
          y1={placement === "above" ? y - 8 : y + 8}
          x2={cx}
          y2={placement === "above" ? yearY + 4 : yearY - 8}
          stroke={active ? "#c9a227" : "#5a6a80"}
          strokeWidth="1"
          strokeDasharray="2 3"
          opacity="0.65"
        />
      )}
      <text
        x={cx}
        y={capY}
        textAnchor="middle"
        fill={active ? "#d4b84a" : "#6b7a90"}
        fontSize="7"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        {caption}
      </text>
      <text
        x={cx}
        y={yearY}
        textAnchor="middle"
        fill={yearFill}
        fontSize={active ? 11 : 10}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight={active ? 700 : 600}
        textDecoration={active ? "underline" : undefined}
      >
        {year}
      </text>
      {/* Soft vertex halo — dashed ring to mark theory overlay */}
      <circle
        cx={x}
        cy={y}
        r="8"
        fill="none"
        stroke={haloStroke}
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity={active ? 0.7 : 0.45}
      />
    </g>
  );
}

/** Orange double-headed span under the chart (classic diagram framing). */
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

export default function RealEstateCycleChart() {
  const recovery = POINTS[0];
  const midPeak = POINTS[1];
  const midSlow = POINTS[2];
  const peak = POINTS[4];
  const downturn = POINTS[5];
  const next = POINTS[6];

  /** Extra top band so title/subtitle sit clear of the high peak */
  const TOP_PAD = 70;
  /** Extra bottom band for theory disclaimer */
  const BOTTOM_PAD = 36;
  const SVG_H = 500 + TOP_PAD + BOTTOM_PAD;

  const live = livePositionFromNow();
  const past2030 = isPast2030Low();
  /** Below-left of dot — crest has peak years (above-right) + Land Boom callouts */
  const liveLabelDx = -42;
  const liveLabelDy = 20;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="mt-6 h-auto w-full overflow-visible"
      role="img"
      aria-label="Classic 18.6 Year Real Estate Cycle theory schematic with stacked historical framework years and next-lap theory waypoints overlaid on the same loop — educational rough guide only, not a predictive model or financial advice"
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="re-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="live-glow" x="-80%" y="-80%" width="260%" height="260%">
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
        18.6 Year Real Estate Cycle theory
      </text>
      <text
        x={SVG_W / 2}
        y="44"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        Schematic · 18.6y framing · bold yellow = active cycle years · muted = inactive / next-lap until after 2030 · not a forecast · NFA
      </text>

      {/* Shift chart geometry down into the padded canvas; title stays in the top band */}
      <g transform={`translate(0, ${TOP_PAD})`}>
        {/* Soft 7–7–4 guide bands (classic series) */}
        <rect
          x={recovery.x}
          y="58"
          width={midSlow.x - recovery.x}
          height="290"
          fill="#3dcc9a"
          opacity="0.05"
        />
        <rect
          x={midSlow.x}
          y="58"
          width={peak.x - midSlow.x}
          height="290"
          fill="#d4a017"
          opacity="0.06"
        />
        <rect
          x={peak.x}
          y="58"
          width={next.x - peak.x}
          height="290"
          fill="#ef6b6b"
          opacity="0.05"
        />

        {/* Subtle horizontal grid */}
        {[90, 130, 170, 210, 250, 290, 330].map((y) => (
          <line
            key={y}
            x1="56"
            y1={y}
            x2={next.x + 28}
            y2={y}
            stroke="#1a1a1a"
            strokeWidth="1"
          />
        ))}

        {/* Soft wrap hint: dashed return under the plot (reset to start of loop) */}
        <path
          d={`M ${next.x} ${next.y} L ${next.x + 28} ${348} L ${recovery.x - 18} ${348} L ${recovery.x} ${recovery.y}`}
          fill="none"
          stroke="#5a6a80"
          strokeWidth="1.75"
          strokeDasharray="5 5"
          opacity="0.55"
          strokeLinejoin="round"
        />
        <text
          x={(recovery.x + next.x) / 2}
          y={362}
          textAnchor="middle"
          fill="#6b7a90"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Next lap resets onto the same loop →
        </text>

        {/* Classic jagged cycle line — straight segments like the classic infographic */}
        <path
          d={LINE_PATH}
          fill="none"
          stroke="#e8eef7"
          strokeWidth="3.5"
          strokeLinejoin="miter"
          strokeLinecap="square"
          filter="url(#re-glow)"
        />

        {/* Muted dashed echo of the classic stroke = theory next-lap overlay on same shape */}
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

        {/* Vertex dots — no land-boom marker (geometry vertex stays unlabeled) */}
        {POINTS.filter((p) => p.id !== "landBoom").map((p) => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={p.id === "peak" ? 5.5 : 4}
            fill="#0a0a0a"
            stroke={p.id === "peak" || p.id === "next" ? "#d4a017" : "#e8eef7"}
            strokeWidth={p.id === "peak" || p.id === "next" ? 2.25 : 1.75}
          />
        ))}

        {/* Year stacks (2024 sits at land-boom geometry; wording moved to peak) */}
        {(
          [
            "recovery",
            "midPeak",
            "midSlow",
            "landBoom",
            "peak",
            "downturn",
            "next",
          ] as const
        ).map((id) => {
          const pt = POINTS.find((p) => p.id === id)!;
          return (
            <YearColumn
              key={id}
              x={pt.x}
              pointY={pt.y}
              stack={YEAR_STACKS[id]}
              past2030={past2030}
            />
          );
        })}

        {/* Land Boom — classic winner’s-curse zone at peak crest (both shoulders) */}
        <text
          x={peak.x - 72}
          y={peak.y + 12}
          textAnchor="end"
          fill="#d4a017"
          fontSize="11"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          Land Boom
        </text>
        <text
          x={peak.x + 48}
          y={peak.y + 44}
          textAnchor="start"
          fill="#d4a017"
          fontSize="11"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          Land Boom
        </text>

        {/* Next-lap theory waypoints — same loop verts, muted / dashed */}
        {THEORY_OVERLAY.map((t) => {
          const pt = POINTS.find((p) => p.id === t.id)!;
          return (
            <TheoryOverlayLabel
              key={t.year}
              x={pt.x}
              y={pt.y}
              year={t.year}
              caption={t.caption}
              placement={t.placement}
              dx={t.dx}
              dy={t.dy}
              active={past2030 && NEXT_CYCLE_YEARS.has(t.year)}
            />
          );
        })}

        {/* Mid-cycle peak caption — left of vertex so year stack stays clear */}
        <text
          x={midPeak.x - 58}
          y={midPeak.y - 10}
          textAnchor="end"
          fill="#8b9bb4"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Mid-cycle peak
        </text>

        {/* Green Live dot — calendar-dated on classic year waypoints; pulse resonates out */}
        <g
          aria-label="Live marker positioned by calendar date on the cycle path"
          filter="url(#live-glow)"
        >
          {/* Expanding opacity rings — resonate outward from the fixed dot (~2.5s) */}
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

        {/* Phase labels under the plot */}
        <text
          x={recovery.x}
          y={398}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Recovery
        </text>
        <text
          x={midSlow.x}
          y={398}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Mid-cycle slowdown
        </text>
        <text
          x={downturn.x}
          y={398}
          textAnchor="middle"
          fill="#a8b4c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Major land-driven downturn
        </text>

        {/* 7 · 7 · 4 span arrows (classic series) */}
        <SpanArrow x1={recovery.x} x2={midSlow.x} y={422} label="~7 years" />
        <SpanArrow x1={midSlow.x} x2={peak.x} y={422} label="~7 years" />
        <SpanArrow x1={peak.x} x2={next.x} y={422} label="~4 years" />

        <text
          x={SVG_W / 2}
          y={458}
          textAnchor="middle"
          fill="#6b7a90"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Bold yellow years mark the active cycle (current lap before end-2030; next-lap theory years after). Framework dates — not predictions.
        </text>

        {/* Prominent theory disclaimer — AU English, NFA tone */}
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
          Next-lap theory overlay (muted): rough guide on the repeating cycle shape — not a predictive model.
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
