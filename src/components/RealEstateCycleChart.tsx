/**
 * Classic “18 Year Real Estate Cycle” schematic (educational diagram).
 * Jagged phase line with stacked historical/framework years, plus a dashed
 * theory-based extension after the assumed ~2030 cycle low — not prices,
 * not a predictive model, not for market timing.
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
 * Theory-based forecast waypoints after assuming ~2030 is the cycle low.
 * Schematic cycle-theory extension only — rough guide, not a model.
 */
const FORECAST_POINTS = [
  { id: "fcMid", x: 928, y: 98, year: "2037", caption: "Mid cycle" },
  { id: "fcMidSlow", x: 976, y: 158, year: "2039", caption: "Mid-cycle correction" },
  { id: "fcPeak", x: 1096, y: 45, year: "2044", caption: "Projected top" },
  { id: "fcLow", x: 1192, y: 295, year: "2048", caption: "Next low" },
] as const;

/**
 * Geometry-only inflection after the 2024 Land Boom marker: hold a modest rise,
 * then a clearly steeper final upswing into the 2026 major peak — matching the
 * classic diagram silhouette without adding a labeled vertex.
 */
const LAND_ACCEL = { x: 525, y: 128 };

/** Unlabeled steepening before the theory top (silhouette only). */
const FC_ACCEL = { x: 1040, y: 120 };

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
    /** Far right of the peak tip so NOW badge never covers the year stack */
    dx: 52,
    dyClear: 18,
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

/** Forecast path starts at the assumed 2030 low so the schematic continues forward. */
const FORECAST_VERTS = [
  POINTS[6],
  FORECAST_POINTS[0],
  FORECAST_POINTS[1],
  FC_ACCEL,
  FORECAST_POINTS[2],
  FORECAST_POINTS[3],
] as const;

const FORECAST_PATH = FORECAST_VERTS.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(
  " ",
);

const SVG_W = 1260;

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

/** Single theory-year label with caption — kept clear of the stroke. */
function ForecastLabel({
  x,
  y,
  year,
  caption,
  placement,
  dx = 0,
}: {
  x: number;
  y: number;
  year: string;
  caption: string;
  placement: "above" | "below";
  dx?: number;
}) {
  const cx = x + dx;
  const yearY = placement === "above" ? y - 22 : y + 26;
  const capY = placement === "above" ? y - 36 : y + 40;
  return (
    <g>
      {Math.abs(dx) >= 14 && (
        <line
          x1={x}
          y1={placement === "above" ? y - 8 : y + 8}
          x2={cx}
          y2={placement === "above" ? yearY + 4 : yearY - 10}
          stroke="#3a4558"
          strokeWidth="1"
          strokeDasharray="2 2"
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
        fill="#b8c4d4"
        fontSize="11"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="700"
      >
        {year}
      </text>
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
  const fcMid = FORECAST_POINTS[0];
  const fcMidSlow = FORECAST_POINTS[1];
  const fcPeak = FORECAST_POINTS[2];
  const fcLow = FORECAST_POINTS[3];

  // Client/server both use "today" — schematic placement on the classic timeline.
  const nowMs = Date.now();
  const nowPos = nowMarkerPosition(nowMs);
  const nowLabel = new Date(nowMs).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
  });
  // Keep the live date/subtitle left of the peak leg rather than under its stroke.
  const overlayX = nowPos.x - 96;

  /** Extra top band so title/subtitle sit clear of the high peak / NOW marker */
  const TOP_PAD = 60;
  /** Extra bottom band for theory disclaimer */
  const BOTTOM_PAD = 36;
  const SVG_H = 500 + TOP_PAD + BOTTOM_PAD;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="mt-6 h-auto w-full overflow-visible"
      role="img"
      aria-label="Classic 18-year real estate cycle schematic with stacked historical framework years and a dashed theory-based extension after an assumed 2030 cycle low — educational rough guide only, not a predictive model or financial advice"
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

      <rect width={SVG_W} height={SVG_H} fill="#0a0a0a" rx="8" />

      <text
        x={SVG_W / 2}
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
        x={SVG_W / 2}
        y="46"
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
      >
        {`As of ${nowLabel} · schematic · ~18 / 18.6y framing · stacked years = classic series · dashed = theory extension · not a forecast · NFA`}
      </text>

      {/* Shift chart geometry down into the padded canvas; title stays in the top band */}
      <g transform={`translate(0, ${TOP_PAD})`}>
      {/* Soft 7–7–4 guide bands (classic series only) */}
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
      {/* Muted theory-extension band after assumed 2030 low */}
      <rect
        x={next.x}
        y="58"
        width={fcLow.x - next.x + 24}
        height="290"
        fill="#5b6b82"
        opacity="0.06"
      />

      {/* Subtle horizontal grid */}
      {[90, 130, 170, 210, 250, 290, 330].map((y) => (
        <line
          key={y}
          x1="56"
          y1={y}
          x2={fcLow.x + 24}
          y2={y}
          stroke="#1a1a1a"
          strokeWidth="1"
        />
      ))}

      {/* Junction marker — assumed 2030 low / start of theory extension */}
      <line
        x1={next.x}
        y1="58"
        x2={next.x}
        y2="348"
        stroke="#3a4558"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <text
        x={next.x + 8}
        y="72"
        textAnchor="start"
        fill="#8b9bb4"
        fontSize="9"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
      >
        Theory extension →
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

      {/* Theory forecast segment — dashed / muted, distinct from classic series */}
      <path
        d={FORECAST_PATH}
        fill="none"
        stroke="#8fa0b8"
        strokeWidth="2.75"
        strokeLinejoin="miter"
        strokeLinecap="square"
        strokeDasharray="7 5"
        opacity="0.92"
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

      {/* Forecast vertex dots — muted */}
      {FORECAST_POINTS.map((p) => (
        <circle
          key={p.id}
          cx={p.x}
          cy={p.y}
          r={p.id === "fcPeak" ? 5 : 3.75}
          fill="#0a0a0a"
          stroke="#8fa0b8"
          strokeWidth={p.id === "fcPeak" ? 2 : 1.6}
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

      {/* NOW marker — kept clear of peak year stack; as-of date is live */}
      <g aria-label={`NOW marker as of ${nowLabel} on the classic timeline`}>
        {/* Leader up-left so badge sits off the peak stack and off the line */}
        <line
          x1={nowPos.x}
          y1={nowPos.y - 8}
          x2={overlayX}
          y2={nowPos.y - 48}
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
          x={nowPos.x - 64}
          y={nowPos.y - 66}
          width="56"
          height="18"
          rx="4"
          fill="#122033"
          stroke="#5ec8ff"
          strokeWidth="1"
        />
        <text
          x={nowPos.x - 36}
          y={nowPos.y - 53}
          textAnchor="middle"
          fill="#5ec8ff"
          fontSize="11"
          fontFamily="system-ui, sans-serif"
          fontWeight="800"
        >
          NOW
        </text>
        {/* Date caption below the line with clearance — not on the stroke */}
        <text
          x={overlayX}
          y={nowPos.y + 28}
          textAnchor="end"
          fill="#9eb0c8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          {`As of ${nowLabel}`}
        </text>
        <text
          x={overlayX}
          y={nowPos.y + 40}
          textAnchor="end"
          fill="#6b7a90"
          fontSize="8"
          fontFamily="system-ui, sans-serif"
        >
          live placement · schematic framework
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

      {/* Forecast year labels — spaced to avoid peak-line / caption crossover */}
      <ForecastLabel
        x={fcMid.x}
        y={fcMid.y}
        year={fcMid.year}
        caption={fcMid.caption}
        placement="above"
        dx={-4}
      />
      <ForecastLabel
        x={fcMidSlow.x}
        y={fcMidSlow.y}
        year={fcMidSlow.year}
        caption={fcMidSlow.caption}
        placement="below"
        dx={10}
      />
      <ForecastLabel
        x={fcPeak.x}
        y={fcPeak.y}
        year={fcPeak.year}
        caption={fcPeak.caption}
        placement="above"
        dx={42}
      />
      <ForecastLabel
        x={fcLow.x}
        y={fcLow.y}
        year={fcLow.year}
        caption={fcLow.caption}
        placement="below"
        dx={-6}
      />

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
      <text
        x={(next.x + fcLow.x) / 2}
        y={398}
        textAnchor="middle"
        fill="#8b9bb4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
        fontWeight="600"
      >
        Next-cycle theory (schematic)
      </text>

      {/* 7 · 7 · 4 span arrows (classic series) */}
      <SpanArrow x1={recovery.x} x2={midSlow.x} y={422} label="~7 years" />
      <SpanArrow x1={midSlow.x} x2={peak.x} y={422} label="~7 years" />
      <SpanArrow x1={peak.x} x2={next.x} y={422} label="~4 years" />
      {/* Theory span — muted */}
      <g opacity="0.85">
        <line
          x1={next.x}
          y1={422}
          x2={fcLow.x}
          y2={422}
          stroke="#8fa0b8"
          strokeWidth="2"
          strokeDasharray="5 4"
        />
        <text
          x={(next.x + fcLow.x) / 2}
          y={438}
          textAnchor="middle"
          fill="#8fa0b8"
          fontSize="10"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          ~18y theory stretch (rough guide)
        </text>
      </g>

      <text
        x={SVG_W / 2}
        y={472}
        textAnchor="middle"
        fill="#6b7a90"
        fontSize="9"
        fontFamily="system-ui, sans-serif"
      >
        Underlined years (2026 / 2028 / 2030) are framework dates in the classic series — not predictions.
        NOW is live as-of placement on that schematic timeline, not a forecast.
      </text>

      {/* Prominent theory disclaimer — AU English, NFA tone */}
      <rect
        x="48"
        y="488"
        width={SVG_W - 96}
        height="42"
        rx="6"
        fill="#121820"
        stroke="#3a4558"
        strokeWidth="1"
      />
      <text
        x={SVG_W / 2}
        y="506"
        textAnchor="middle"
        fill="#d0d8e4"
        fontSize="10"
        fontFamily="system-ui, sans-serif"
        fontWeight="700"
      >
        Theory extension (dashed): rough guide based on real estate cycle theory — not a predictive model.
      </text>
      <text
        x={SVG_W / 2}
        y="520"
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
