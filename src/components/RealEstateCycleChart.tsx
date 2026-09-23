/**
 * Classic “18 Year Real Estate Cycle” schematic (educational diagram).
 * Jagged phase line with stacked historical/framework years. Next-cycle
 * theory waypoints (≈2037 / 2039 / 2044 / 2048) overlay the same loop
 * shape — a reset/wrap onto the classic schematic, not a linear runway
 * past 2030. Research only — not prices, not predictive, not for timing.
 */

type YearStack = {
  years: string[];
  /** Emphasize framework years (underline) — still schematic, not predictions */
  emphasize?: string[];
  placement: "above" | "below";
  /** Horizontal offset from vertex (keeps stacks from colliding) */
  dx?: number;
  /** Extra vertical clearance from the vertex */
  dyClear?: number;
};

/**
 * Vertex coordinates for the jagged educational cycle line (not price data).
 * Classic silhouette: modest first half → land boom → steepening final leg into a
 * high major peak → clear proportional drawdown → lift into next recovery.
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
    dx: -62,
    dy: 18,
  },
  {
    id: "midSlow",
    year: "2039",
    caption: "Theory dip",
    placement: "below",
    dx: 52,
    dy: 6,
  },
  {
    id: "peak",
    year: "2044",
    caption: "Theory top",
    placement: "above",
    dx: 58,
    dy: -4,
  },
  {
    id: "next",
    year: "2048",
    caption: "Theory low",
    placement: "below",
    dx: 48,
    dy: 4,
  },
];

/**
 * Geometry-only inflection after the 2024 Land Boom marker: hold a modest rise,
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
    dx: -6,
    dyClear: 4,
  },
  midSlow: {
    years: ["2022", "2002", "1982"],
    placement: "below",
  },
  landBoom: {
    years: ["2024"],
    placement: "above",
  },
  peak: {
    years: ["2026", "2007", "1989"],
    emphasize: ["2026"],
    placement: "above",
    /** Slight right offset so peak stack clears the tip */
    dx: 28,
    dyClear: 14,
  },
  downturn: {
    years: ["2028", "2009", "1991", "1972"],
    emphasize: ["2028"],
    placement: "below",
    dx: -4,
  },
  next: {
    years: ["2030", "2011", "1993", "1974"],
    emphasize: ["2030"],
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

/** Closed loop path for the Live dot: classic stroke, then soft wrap back to start. */
const LOOP_PATH = `${LINE_PATH} L ${POINTS[6].x + 28} 348 L ${POINTS[0].x - 18} 348 L ${POINTS[0].x} ${POINTS[0].y}`;

const SVG_W = 820;

function YearColumn({
  x,
  pointY,
  stack,
}: {
  x: number;
  pointY: number;
  stack: YearStack;
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
        const emph = stack.emphasize?.includes(yr);
        return (
          <text
            key={yr}
            x={cx}
            y={y}
            textAnchor="middle"
            fill={emph ? "#f0d78c" : "#c8d0dc"}
            fontSize={emph ? 11 : 10}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontWeight={emph ? 700 : 500}
            textDecoration={emph ? "underline" : undefined}
          >
            {yr}
          </text>
        );
      })}
    </g>
  );
}

/** Muted next-lap theory label at a classic loop vertex — not a linear forecast. */
function TheoryOverlayLabel({
  x,
  y,
  year,
  caption,
  placement,
  dx = 0,
  dy = 0,
}: {
  x: number;
  y: number;
  year: string;
  caption: string;
  placement: "above" | "below";
  dx?: number;
  dy?: number;
}) {
  const cx = x + dx;
  const baseY = y + dy;
  const yearY = placement === "above" ? baseY - 18 : baseY + 22;
  const capY = placement === "above" ? baseY - 30 : baseY + 34;
  return (
    <g opacity="0.92">
      {Math.abs(dx) >= 14 && (
        <line
          x1={x}
          y1={placement === "above" ? y - 8 : y + 8}
          x2={cx}
          y2={placement === "above" ? yearY + 4 : yearY - 8}
          stroke="#5a6a80"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}
      <text
        x={cx}
        y={capY}
        textAnchor="middle"
        fill="#7a8aa0"
        fontSize="8"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        {caption}
      </text>
      <text
        x={cx}
        y={yearY}
        textAnchor="middle"
        fill="#a8b8cc"
        fontSize="11"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="700"
      >
        {year}
      </text>
      {/* Soft vertex halo — dashed ring to mark theory overlay */}
      <circle
        cx={x}
        cy={y}
        r="9"
        fill="none"
        stroke="#8fa0b8"
        strokeWidth="1.25"
        strokeDasharray="3 3"
        opacity="0.7"
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
  const landBoom = POINTS[3];
  const peak = POINTS[4];
  const downturn = POINTS[5];
  const next = POINTS[6];

  /** Extra top band so title/subtitle sit clear of the high peak */
  const TOP_PAD = 52;
  /** Extra bottom band for theory disclaimer */
  const BOTTOM_PAD = 36;
  const SVG_H = 500 + TOP_PAD + BOTTOM_PAD;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="mt-6 h-auto w-full overflow-visible"
      role="img"
      aria-label="Classic 18-year real estate cycle schematic with stacked historical framework years and next-lap theory waypoints overlaid on the same loop — educational rough guide only, not a predictive model or financial advice"
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
        {/* Motion path for Live dot: classic stroke then soft wrap to restart */}
        <path id="re-live-loop" d={LOOP_PATH} fill="none" />
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
        18 Year Real Estate Cycle
      </text>
      <text
        x={SVG_W / 2}
        y="44"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        Schematic · ~18 / 18.6y framing · stacked years = classic series · muted = next-lap theory overlay · not a forecast · NFA
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

        {/* Vertex dots (land boom uses gold marker instead) */}
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

        {/* Land Boom gold marker — label left of marker so peak stack stays clear */}
        <g>
          <circle
            cx={landBoom.x}
            cy={landBoom.y}
            r="9"
            fill="#d4a017"
            stroke="#f5d56a"
            strokeWidth="2"
          />
          <circle cx={landBoom.x} cy={landBoom.y} r="3.5" fill="#0a0a0a" />
          <text
            x={landBoom.x - 16}
            y={landBoom.y - 18}
            textAnchor="end"
            fill="#d4a017"
            fontSize="12"
            fontFamily="system-ui, sans-serif"
            fontWeight="700"
          >
            Land Boom
          </text>
          <text
            x={landBoom.x - 16}
            y={landBoom.y - 4}
            textAnchor="end"
            fill="#f0d78c"
            fontSize="11"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontWeight="700"
          >
            2024
          </text>
        </g>

        {/* Year stacks (land boom year rendered with marker) */}
        {(
          [
            "recovery",
            "midPeak",
            "midSlow",
            "peak",
            "downturn",
            "next",
          ] as const
        ).map((id) => {
          const pt = POINTS.find((p) => p.id === id)!;
          return (
            <YearColumn key={id} x={pt.x} pointY={pt.y} stack={YEAR_STACKS[id]} />
          );
        })}

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
            />
          );
        })}

        {/* Mid-cycle peak caption — left of vertex so year stack stays clear */}
        <text
          x={midPeak.x - 52}
          y={midPeak.y + 4}
          textAnchor="end"
          fill="#8b9bb4"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          Mid-cycle peak
        </text>

        {/* Green Live dot — travels the classic path + wrap, full loop ≈ 10s */}
        <g aria-label="Live marker animating along the cycle path" filter="url(#live-glow)">
          <animateMotion dur="10s" repeatCount="indefinite" calcMode="linear">
            <mpath xlinkHref="#re-live-loop" />
          </animateMotion>
          <circle r="5.5" fill="#2fd67b" stroke="#9dffc4" strokeWidth="1.5" />
          <circle r="2" fill="#0a0a0a" opacity="0.55" />
          <rect
            x="8"
            y="-18"
            width="34"
            height="14"
            rx="3"
            fill="#0f2418"
            stroke="#2fd67b"
            strokeWidth="1"
          />
          <text
            x="25"
            y="-8"
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
          Underlined years (2026 / 2028 / 2030) are framework dates in the classic series — not predictions.
          Muted years (2037 / 2039 / 2044 / 2048) are next-lap theory overlays on the same loop.
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
