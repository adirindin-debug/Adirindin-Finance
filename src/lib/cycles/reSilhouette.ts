/**
 * Real estate cycle theory silhouette for the Market cycles hub.
 * Drawn Anderson shape knots and Live calendar walk match RealEstateCycleChart.tsx.
 * Anderson 18y line shape is locked — values copied verbatim. Educational · NFA.
 */

import {
  bezierPathD,
  curveLerp,
  pointAtX,
  smoothBeziers,
  type Pt,
} from "@/lib/smoothCurve";

const POINTS = [
  { id: "recovery", x: 88, y: 305 },
  { id: "midPeak", x: 290, y: 182 },
  { id: "midSlow", x: 370, y: 228 },
  { id: "landBoom", x: 430, y: 148 },
  { id: "peak", x: 610, y: 42 },
  { id: "downturn", x: 680, y: 230 },
  { id: "next", x: 760, y: 182 },
] as const;

const LAND_ACCEL = { x: 525, y: 128 };
const NEXT_LOW_YEAR = 2031;
const WRAP_Y = 348;

const PATH_VERTS = [
  POINTS[0],
  POINTS[1],
  POINTS[2],
  POINTS[3],
  LAND_ACCEL,
  POINTS[4],
  POINTS[5],
  POINTS[6],
] as const;

const LINE_VERTS: Pt[] = PATH_VERTS.map((p) => ({ x: p.x, y: p.y }));
const LINE_BEZ = smoothBeziers(LINE_VERTS, { extremeHandle: 0.22 });

/** Exact Anderson shape knots from RealEstateCycleChart.tsx */
const SHAPE_KNOTS: Pt[] = [
  { x: POINTS[0].x, y: POINTS[0].y },
  { x: 128, y: 280 },
  { x: 138, y: 285 },
  { x: 180, y: 250 },
  { x: 191, y: 255 },
  { x: 234, y: 216 },
  { x: 245, y: 220 },
  { x: POINTS[1].x, y: POINTS[1].y },
  { x: 318, y: 202 },
  { x: 328, y: 198 },
  { x: POINTS[2].x, y: POINTS[2].y },
  { x: 396, y: 219.6 },
  { x: POINTS[3].x, y: 206 },
  { x: 456, y: 195.6 },
  { x: 480, y: 177 },
  { x: 503, y: 164.9 },
  { x: LAND_ACCEL.x, y: 144.9 },
  { x: 546, y: 122.4 },
  { x: 566, y: 104.4 },
  { x: 584, y: 80.3 },
  { x: 598, y: 60.5 },
  { x: POINTS[4].x, y: POINTS[4].y },
  { x: 632, y: 104 },
  { x: 638, y: 97 },
  { x: 660, y: 182 },
  { x: 666, y: 176 },
  { x: POINTS[5].x, y: POINTS[5].y },
  { x: 705, y: 214 },
  { x: 716, y: 220 },
  { x: POINTS[6].x, y: POINTS[6].y },
];
const SHAPE_BEZ = smoothBeziers(SHAPE_KNOTS, { extremeHandle: 0.22 });

export const RE_SILHOUETTE = {
  path: bezierPathD(SHAPE_BEZ),
  viewBox: "70 25 710 300",
  color: "#3dcc9a",
} as const;

function onDrawnLine(p: Pt): Pt {
  return { x: p.x, y: pointAtX(SHAPE_BEZ, p.x).y };
}

function endOfYearMs(year: number): number {
  return Date.UTC(year, 11, 31, 23, 59, 59, 999);
}

const YEAR_WAYPOINTS: { year: number; points: Pt[]; label: string }[] = [
  { year: 2012, points: [{ x: POINTS[0].x, y: POINTS[0].y }], label: "Recovery" },
  { year: 2019, points: [{ x: POINTS[1].x, y: POINTS[1].y }], label: "Mid-cycle peak" },
  { year: 2022, points: [{ x: POINTS[2].x, y: POINTS[2].y }], label: "Mid-cycle low" },
  { year: 2024, points: [{ x: POINTS[3].x, y: POINTS[3].y }], label: "Land boom" },
  {
    year: 2026,
    points: [
      { x: POINTS[3].x, y: POINTS[3].y },
      { x: LAND_ACCEL.x, y: LAND_ACCEL.y },
      { x: POINTS[4].x, y: POINTS[4].y },
    ],
    label: "Major peak",
  },
  { year: 2028, points: [{ x: POINTS[5].x, y: POINTS[5].y }], label: "Downturn" },
  { year: 2030, points: [{ x: POINTS[6].x, y: POINTS[6].y }], label: "Low zone" },
  {
    year: NEXT_LOW_YEAR,
    points: [
      { x: POINTS[6].x, y: POINTS[6].y },
      { x: POINTS[6].x + 28, y: WRAP_Y },
      { x: POINTS[0].x - 18, y: WRAP_Y },
      { x: POINTS[0].x, y: POINTS[0].y },
    ],
    label: "Next-lap low",
  },
];

const NEXT_LAP_WAYPOINTS: { year: number; points: Pt[]; label: string }[] = [
  {
    year: NEXT_LOW_YEAR,
    points: [{ x: POINTS[0].x, y: POINTS[0].y }],
    label: "Next-lap recovery",
  },
  { year: 2037, points: [{ x: POINTS[1].x, y: POINTS[1].y }], label: "Next-lap mid peak" },
  { year: 2039, points: [{ x: POINTS[2].x, y: POINTS[2].y }], label: "Next-lap mid low" },
  {
    year: 2044,
    points: [
      { x: POINTS[2].x, y: POINTS[2].y },
      { x: POINTS[3].x, y: POINTS[3].y },
      { x: LAND_ACCEL.x, y: LAND_ACCEL.y },
      { x: POINTS[4].x, y: POINTS[4].y },
    ],
    label: "Next-lap peak",
  },
  {
    year: 2048,
    points: [
      { x: POINTS[4].x, y: POINTS[4].y },
      { x: POINTS[5].x, y: POINTS[5].y },
      { x: POINTS[6].x, y: POINTS[6].y },
    ],
    label: "Next-lap low",
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
      return curveLerp(LINE_VERTS, LINE_BEZ, points[i], points[i + 1], u);
    }
    remain -= segs[i];
  }
  return points[points.length - 1];
}

function livePositionOnWaypoints(
  now: number,
  waypoints: { year: number; points: Pt[] }[],
): Pt {
  const ends = waypoints.map((w) => endOfYearMs(w.year));
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
    return curveLerp(LINE_VERTS, LINE_BEZ, from, to, frac);
  }
  const last = waypoints[waypoints.length - 1];
  return last.points[last.points.length - 1];
}

function livePositionFromNow(nowMs: number): Pt {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  if (now > endOfYearMs(NEXT_LOW_YEAR)) {
    return onDrawnLine(livePositionOnWaypoints(now, NEXT_LAP_WAYPOINTS));
  }
  if (now > endOfYearMs(NEXT_LOW_YEAR - 1)) {
    return livePositionOnWaypoints(now, YEAR_WAYPOINTS);
  }
  return onDrawnLine(livePositionOnWaypoints(now, YEAR_WAYPOINTS));
}

/** Phase line from the chart's own waypoint years only — never invented. */
function phaseLineFromNow(nowMs: number): string {
  const { y, m, d } = melbourneYmd(nowMs);
  const now = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  const waypoints = now > endOfYearMs(NEXT_LOW_YEAR) ? NEXT_LAP_WAYPOINTS : YEAR_WAYPOINTS;
  for (let i = 0; i < waypoints.length; i++) {
    const end = endOfYearMs(waypoints[i].year);
    if (now <= end) {
      const dest = waypoints[i];
      if (i === 0) return `${dest.label} · framework ~${dest.year}`;
      return `Toward ${dest.label.toLowerCase()} · framework ~${dest.year}`;
    }
  }
  const last = waypoints[waypoints.length - 1];
  return `${last.label} · framework ~${last.year}`;
}

export type ReLiveSilhouette = {
  pt: Pt;
  phaseLine: string;
};

export function reLiveSilhouette(nowMs: number): ReLiveSilhouette {
  return {
    pt: livePositionFromNow(nowMs),
    phaseLine: phaseLineFromNow(nowMs),
  };
}
