/**
 * Smooth-curve helpers for the cycle theory schematics.
 *
 * Turns an x-monotone polyline of key vertices into cubic bezier pieces that
 * pass through every vertex (one piece per original segment), using monotone
 * cubic Hermite interpolation of y(x):
 *   - interior slopes = Fritsch–Butland weighted harmonic mean of the adjacent
 *     secants (copes with very uneven segment lengths, no overshoot);
 *   - local tops / bottoms get a flat (zero) slope, so peaks and lows stay the
 *     true extremes; their handles can be shortened (`extremeHandle`) so tops
 *     read as clear, slightly rounded points rather than broad hills;
 *   - every control point is also clamped inside its own segment's bounding
 *     box, so the curve can never overshoot above a peak / below a low.
 * Positions on the curve use per-piece arc-length lookups, so a "fraction along
 * segment i" maps to the same progress it had on the old straight segment.
 */

export type Pt = { x: number; y: number };
export type Bezier = { p0: Pt; c1: Pt; c2: Pt; p3: Pt };

export type SmoothOptions = {
  /** Handle x-length as a fraction of the segment's x-span (Hermite default 1/3). */
  handle?: number;
  /** Handle x-length fraction at local tops / bottoms (smaller = sharper-looking point). */
  extremeHandle?: number;
};

function clampPt(c: Pt, a: Pt, b: Pt): Pt {
  return {
    x: Math.min(Math.max(c.x, Math.min(a.x, b.x)), Math.max(a.x, b.x)),
    y: Math.min(Math.max(c.y, Math.min(a.y, b.y)), Math.max(a.y, b.y)),
  };
}

export function smoothBeziers(points: readonly Pt[], opts: SmoothOptions = {}): Bezier[] {
  const handle = opts.handle ?? 1 / 3;
  const extremeHandle = opts.extremeHandle ?? handle;
  const n = points.length;
  if (n < 2) return [];
  const h: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    h.push(dx);
    d.push(dx === 0 ? 0 : (points[i + 1].y - points[i].y) / dx);
  }
  const m: number[] = new Array(n).fill(0);
  const extreme: boolean[] = new Array(n).fill(false);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) {
      m[i] = 0;
      extreme[i] = true;
    } else {
      const h0 = h[i - 1];
      const h1 = h[i];
      m[i] = (3 * (h0 + h1)) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
    }
  }
  const out: Bezier[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const la = h[i] * (extreme[i] ? extremeHandle : handle);
    const lb = h[i] * (extreme[i + 1] ? extremeHandle : handle);
    const c1 = clampPt({ x: a.x + la, y: a.y + m[i] * la }, a, b);
    const c2 = clampPt({ x: b.x - lb, y: b.y - m[i + 1] * lb }, a, b);
    out.push({ p0: a, c1, c2, p3: b });
  }
  return out;
}

const f2 = (v: number) => Number(v.toFixed(2));

/** SVG path data "M … C …" for the bezier chain. */
export function bezierPathD(beziers: readonly Bezier[]): string {
  if (beziers.length === 0) return "";
  const head = `M ${f2(beziers[0].p0.x)} ${f2(beziers[0].p0.y)}`;
  return (
    head +
    beziers
      .map(
        (b) =>
          ` C ${f2(b.c1.x)} ${f2(b.c1.y)} ${f2(b.c2.x)} ${f2(b.c2.y)} ${f2(b.p3.x)} ${f2(b.p3.y)}`,
      )
      .join("")
  );
}

export function bezierPoint(b: Bezier, t: number): Pt {
  const u = 1 - t;
  const a = u * u * u;
  const c = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return {
    x: a * b.p0.x + c * b.c1.x + d * b.c2.x + e * b.p3.x,
    y: a * b.p0.y + c * b.c1.y + d * b.c2.y + e * b.p3.y,
  };
}

const LUT_STEPS = 200;
const lutCache = new WeakMap<Bezier, { t: number[]; s: number[] }>();

function arcLut(b: Bezier): { t: number[]; s: number[] } {
  const hit = lutCache.get(b);
  if (hit) return hit;
  const t: number[] = [0];
  const s: number[] = [0];
  let prev = b.p0;
  let acc = 0;
  for (let i = 1; i <= LUT_STEPS; i++) {
    const ti = i / LUT_STEPS;
    const p = bezierPoint(b, ti);
    acc += Math.hypot(p.x - prev.x, p.y - prev.y);
    t.push(ti);
    s.push(acc);
    prev = p;
  }
  const lut = { t, s };
  lutCache.set(b, lut);
  return lut;
}

/** Point at arc-length fraction f ∈ [0, 1] along one bezier piece. */
export function bezierPointAtFraction(b: Bezier, f: number): Pt {
  const clamped = Math.min(1, Math.max(0, f));
  if (clamped <= 0) return b.p0;
  if (clamped >= 1) return b.p3;
  const { t, s } = arcLut(b);
  const target = clamped * s[s.length - 1];
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] < target) lo = mid;
    else hi = mid;
  }
  const span = s[hi] - s[lo];
  const u = span <= 0 ? 0 : (target - s[lo]) / span;
  return bezierPoint(b, t[lo] + (t[hi] - t[lo]) * u);
}

/** Point on an x-monotone bezier chain at a given x (bisection on t). */
export function pointAtX(beziers: readonly Bezier[], x: number): Pt {
  const piece =
    beziers.find((b) => x >= Math.min(b.p0.x, b.p3.x) && x <= Math.max(b.p0.x, b.p3.x)) ??
    (x < beziers[0].p0.x ? beziers[0] : beziers[beziers.length - 1]);
  const increasing = piece.p3.x >= piece.p0.x;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const px = bezierPoint(piece, mid).x;
    if (px < x === increasing) lo = mid;
    else hi = mid;
  }
  return bezierPoint(piece, (lo + hi) / 2);
}

/**
 * Same timing as the old straight-segment walk: if a→b is consecutive vertex
 * pair i→i+1 of the smoothed chain, return the point at arc-length fraction
 * `frac` along curve piece i; otherwise (e.g. a dashed wrap leg) a straight lerp.
 */
export function curveLerp(
  verts: readonly Pt[],
  beziers: readonly Bezier[],
  a: Pt,
  b: Pt,
  frac: number,
): Pt {
  for (let i = 0; i < verts.length - 1; i++) {
    const v0 = verts[i];
    const v1 = verts[i + 1];
    if (v0.x === a.x && v0.y === a.y && v1.x === b.x && v1.y === b.y) {
      return bezierPointAtFraction(beziers[i], frac);
    }
  }
  const f = Math.min(1, Math.max(0, frac));
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}
