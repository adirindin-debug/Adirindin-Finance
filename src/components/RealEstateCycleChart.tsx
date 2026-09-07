/**
 * Classic “18 Year Real Estate Cycle” schematic (Anthony-style educational diagram).
 * Jagged phase line with stacked historical/framework years — not prices, not a forecast.
 */

type YearStack = {
  years: string[];
  /** Emphasize framework years (underline) — still schematic, not predictions */
  emphasize?: string[];
  placement: "above" | "below";
};

/** Vertex coordinates for the jagged educational cycle line (not price data). */
const POINTS = [
  { id: "recovery", x: 72, y: 255 },
  { id: "midPeak", x: 210, y: 145 },
  { id: "midSlow", x: 312, y: 188 },
  { id: "landBoom", x: 420, y: 132 },
  { id: "peak", x: 520, y: 88 },
  { id: "downturn", x: 640, y: 275 },
  { id: "next", x: 732, y: 245 },
] as const;

const YEAR_STACKS: Record<(typeof POINTS)[number]["id"], YearStack> = {
  recovery: {
    years: ["2012", "1994", "1975"],
    placement: "above",
  },
  midPeak: {
    years: ["2019", "2000", "1981"],
    placement: "above",
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
  },
  downturn: {
    years: ["2028", "2009", "1991", "1972"],
    emphasize: ["2028"],
    placement: "below",
  },
  next: {
    years: ["2030", "2011", "1993", "1974"],
    emphasize: ["2030"],
    placement: "above",
  },
};

const LINE_PATH = POINTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

function YearColumn({
  x,
  pointY,
  stack,
  extraOffset = 0,
}: {
  x: number;
  pointY: number;
  stack: YearStack;
  extraOffset?: number;
}) {
  const lineH = 13;
  const gap = 1;
  const n = stack.years.length;
  const totalH = n * lineH + Math.max(0, n - 1) * gap;
  const clear = 14 + extraOffset;
  const startY =
    stack.placement === "above"
      ? pointY - clear - totalH + lineH
      : pointY + clear + lineH * 0.35;

  return (
    <g>
      {stack.years.map((yr, i) => {
        const y = startY + i * (lineH + gap);
        const emph = stack.emphasize?.includes(yr);
        return (
          <text
            key={yr}
            x={x}
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

  return (
    <svg
      viewBox="0 0 800 455"
      className="mt-6 h-auto w-full"
      role="img"
      aria-label="Classic 18-year real estate cycle schematic with stacked historical framework years, mid-cycle dip, land boom marker, peak and downturn — educational only, not a forecast"
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

      <rect width="800" height="455" fill="#0a0a0a" rx="8" />

      <text
        x="400"
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
        x="400"
        y="44"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        Schematic · ~18 / 18.6y framing · stacked years = classic series · not a forecast · NFA
      </text>

      {/* Soft 7–7–4 guide bands */}
      <rect
        x={recovery.x}
        y="52"
        width={midSlow.x - recovery.x}
        height="250"
        fill="#3dcc9a"
        opacity="0.05"
      />
      <rect
        x={midSlow.x}
        y="52"
        width={peak.x - midSlow.x}
        height="250"
        fill="#d4a017"
        opacity="0.06"
      />
      <rect
        x={peak.x}
        y="52"
        width={next.x - peak.x}
        height="250"
        fill="#ef6b6b"
        opacity="0.05"
      />

      {/* Subtle horizontal grid */}
      {[100, 140, 180, 220, 260].map((y) => (
        <line key={y} x1="48" y1={y} x2="752" y2={y} stroke="#1a1a1a" strokeWidth="1" />
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

      {/* Land Boom gold marker on ascending leg */}
      <g>
        <text
          x={landBoom.x}
          y={landBoom.y - 38}
          textAnchor="middle"
          fill="#d4a017"
          fontSize="12"
          fontFamily="system-ui, sans-serif"
          fontWeight="700"
        >
          Land Boom
        </text>
        <text
          x={landBoom.x}
          y={landBoom.y - 22}
          textAnchor="middle"
          fill="#f0d78c"
          fontSize="11"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fontWeight="700"
        >
          2024
        </text>
        <circle
          cx={landBoom.x}
          cy={landBoom.y}
          r="9"
          fill="#d4a017"
          stroke="#f5d56a"
          strokeWidth="2"
        />
        <circle cx={landBoom.x} cy={landBoom.y} r="3.5" fill="#0a0a0a" />
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
        const extra = id === "peak" ? 4 : id === "midPeak" ? 2 : 0;
        return (
          <YearColumn
            key={id}
            x={pt.x}
            pointY={pt.y}
            stack={YEAR_STACKS[id]}
            extraOffset={extra}
          />
        );
      })}

      {/* Mid-cycle peak caption — left of vertex so year stack stays clear */}
      <text
        x={midPeak.x - 56}
        y={midPeak.y + 4}
        textAnchor="end"
        fill="#8b9bb4"
        fontSize="9"
        fontFamily="system-ui, sans-serif"
      >
        Mid-cycle peak
      </text>

      {/* Phase labels under the plot (below downturn year stack) */}
      <text
        x={recovery.x}
        y={368}
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
        y={368}
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
        y={368}
        textAnchor="middle"
        fill="#a8b4c8"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        Major land-driven downturn
      </text>

      {/* 7 · 7 · 4 span arrows */}
      <SpanArrow x1={recovery.x} x2={midSlow.x} y={392} label="~7 years" />
      <SpanArrow x1={midSlow.x} x2={peak.x} y={392} label="~7 years" />
      <SpanArrow x1={peak.x} x2={next.x} y={392} label="~4 years" />

      <text
        x="400"
        y="440"
        textAnchor="middle"
        fill="#6b7a90"
        fontSize="9"
        fontFamily="system-ui, sans-serif"
      >
        Underlined years (2026 / 2028 / 2030) are framework dates in the classic series — not predictions
      </text>
    </svg>
  );
}
