/**
 * Classic “18 Year Real Estate Cycle” schematic (educational diagram).
 * Jagged phase line with stacked historical/framework years — not prices, not a forecast.
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
  /** Gentle lift toward next recovery — similar height to mid-cycle peak */
  { id: "next", x: 760, y: 182 },
] as const;

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
    /** Sit to the right of the peak so Land Boom label stays clear */
    dx: 30,
    dyClear: 10,
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

/** Framework timeline for NOW placement along landBoom → LAND_ACCEL → peak. */
const LAND_BOOM_MS = Date.UTC(2024, 0, 1);
const PEAK_MS = Date.UTC(2026, 11, 31);

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Interpolate along polyline by fraction of cumulative length. */
function pointAlong(
  verts: readonly { x: number; y: number }[],
  fraction: number,
): { x: number; y: number } {
  if (verts.length === 0) return { x: 0, y: 0 };
  if (verts.length === 1) return { x: verts[0].x, y: verts[0].y };
  const segs: { len: number; ax: number; ay: number; bx: number; by: number }[] = [];
  let total = 0;
  for (let i = 0; i < verts.length - 1; i++) {
    const ax = verts[i].x;
    const ay = verts[i].y;
    const bx = verts[i + 1].x;
    const by = verts[i + 1].y;
    const len = Math.hypot(bx - ax, by - ay);
    segs.push({ len, ax, ay, bx, by });
    total += len;
  }
  let remain = clamp01(fraction) * total;
  for (const s of segs) {
    if (remain <= s.len || s === segs[segs.length - 1]) {
      const t = s.len === 0 ? 0 : remain / s.len;
      return {
        x: s.ax + (s.bx - s.ax) * t,
        y: s.ay + (s.by - s.ay) * t,
      };
    }
    remain -= s.len;
  }
  const last = verts[verts.length - 1];
  return { x: last.x, y: last.y };
}

function nowMarkerPosition(nowMs: number) {
  const frac = clamp01((nowMs - LAND_BOOM_MS) / (PEAK_MS - LAND_BOOM_MS));
  const boomPath = [POINTS[3], LAND_ACCEL, POINTS[4]];
  return { ...pointAlong(boomPath, frac), frac };
}

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

  // Client/server both use "today" — schematic placement on the classic timeline.
  const nowMs = Date.now();
  const nowPos = nowMarkerPosition(nowMs);
  const nowLabel = new Date(nowMs).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
  });

  /** Extra top band so title/subtitle sit clear of the high peak / NOW marker */
  const TOP_PAD = 60;
  const SVG_H = 500 + TOP_PAD;

  return (
    <svg
      viewBox={`0 0 840 ${SVG_H}`}
      className="mt-6 h-auto w-full overflow-visible"
      role="img"
      aria-label="Classic 18-year real estate cycle schematic with stacked historical framework years, mid-cycle dip, land boom marker, NOW time marker, peak and downturn — educational only, not a forecast"
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
      </defs>

      <rect width="840" height={SVG_H} fill="#0a0a0a" rx="8" />

      <text
        x="420"
        y="28"
        textAnchor="middle"
        fill="#e8eef4"
        fontSize="16"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
      >
        18 Year Real Estate Cycle
      </text>
      <text
        x="420"
        y="46"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        Schematic · ~18 / 18.6y framing · stacked years = classic series · not a forecast · NFA
      </text>

      {/* Shift chart geometry down into the padded canvas; title stays in the top band */}
      <g transform={`translate(0, ${TOP_PAD})`}>
      {/* Soft 7–7–4 guide bands */}
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
        <line key={y} x1="56" y1={y} x2="784" y2={y} stroke="#1a1a1a" strokeWidth="1" />
      ))}

      {/* Jagged cycle line — straight segments like the classic infographic */}
      <path
        d={LINE_PATH}
        fill="none"
        stroke="#e8eef7"
        strokeWidth="3.5"
        strokeLinejoin="miter"
        strokeLinecap="square"
        filter="url(#re-glow)"
      />

      {/* Vertex dots (land boom uses gold marker instead) */}
      {POINTS.filter((p) => p.id !== "landBoom").map((p) => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={p.id === "peak" ? 5.5 : 4}
          fill="#0a0a0a"
          stroke={p.id === "peak" ? "#d4a017" : "#e8eef7"}
          strokeWidth={p.id === "peak" ? 2.25 : 1.75}
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

      {/* NOW marker — schematic date placement on classic 2024→2026 land-boom leg */}
      <g aria-label={`NOW marker around ${nowLabel} on the classic timeline`}>
        <line
          x1={nowPos.x}
          y1={nowPos.y - 52}
          x2={nowPos.x}
          y2={nowPos.y - 10}
          stroke="#5ec8ff"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
        <circle
          cx={nowPos.x}
          cy={nowPos.y}
          r="6"
          fill="#0a0a0a"
          stroke="#5ec8ff"
          strokeWidth="2.25"
        />
        <circle cx={nowPos.x} cy={nowPos.y} r="2.25" fill="#5ec8ff" />
        <rect
          x={nowPos.x - 28}
          y={nowPos.y - 72}
          width="56"
          height="18"
          rx="4"
          fill="#122033"
          stroke="#5ec8ff"
          strokeWidth="1"
        />
        <text
          x={nowPos.x}
          y={nowPos.y - 59}
          textAnchor="middle"
          fill="#5ec8ff"
          fontSize="11"
          fontFamily="system-ui, sans-serif"
          fontWeight="800"
        >
          NOW
        </text>
        <text
          x={nowPos.x}
          y={nowPos.y + 22}
          textAnchor="middle"
          fill="#8b9bb4"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
        >
          {nowLabel} · schematic
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

      {/* 7 · 7 · 4 span arrows */}
      <SpanArrow x1={recovery.x} x2={midSlow.x} y={422} label="~7 years" />
      <SpanArrow x1={midSlow.x} x2={peak.x} y={422} label="~7 years" />
      <SpanArrow x1={peak.x} x2={next.x} y={422} label="~4 years" />

      <text
        x="420"
        y="472"
        textAnchor="middle"
        fill="#6b7a90"
        fontSize="9"
        fontFamily="system-ui, sans-serif"
      >
        Underlined years (2026 / 2028 / 2030) are framework dates in the classic series — not predictions.
        NOW is schematic placement on that timeline, not a forecast.
      </text>
      </g>
    </svg>
  );
}
