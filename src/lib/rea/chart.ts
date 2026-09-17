import type { Property, PropertyStatus } from "./types";

export type Point = { date: string; value: number | null };

export function propertyPoints(p: Property): Point[] {
  const hard = p.marks.filter(
    (m) => m.method === "sale" || m.method === "list-mid" || m.method === "manual",
  );
  const marks = hard.length ? hard : p.marks.filter((m) => m.method === "estimate");
  return [...marks]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({ date: m.date, value: m.mid }));
}

export function toRelative(points: Point[]): Point[] {
  const first = points.find((pt) => pt.value != null && pt.value !== 0);
  if (!first || first.value == null) {
    return points.map((pt) => ({ date: pt.date, value: null }));
  }
  return toRelativeWithBase(points, first.value);
}

export function toRelativeWithBase(points: Point[], base: number | null): Point[] {
  if (base == null || base === 0) {
    return points.map((pt) => ({ date: pt.date, value: null }));
  }
  return points.map((pt) => ({
    date: pt.date,
    value: pt.value == null ? null : (pt.value / base - 1) * 100,
  }));
}

export function sleevePoints(
  properties: Property[],
  status: PropertyStatus,
): Point[] {
  const dates = new Set<string>();
  for (const p of properties) {
    if (p.status !== status) continue;
    p.marks.forEach((m) => dates.add(m.date));
  }
  const sorted = [...dates].sort();
  return sorted.map((d) => {
    let sum = 0;
    let any = false;
    for (const p of properties) {
      if (p.status !== status) continue;
      const marks = p.marks
        .filter((m) => m.date <= d)
        .sort((a, b) => a.date.localeCompare(b.date));
      const last = marks.at(-1);
      if (last) {
        sum += last.mid;
        any = true;
      }
    }
    return { date: d, value: any ? sum : null };
  });
}

export function toMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function monthGrid(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
  const e = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return dates;
  for (
    let d = s;
    d <= e;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Linear interpolate a path at `date`. Null before the first known point. */
export function valueAt(pts: Point[], date: string): number | null {
  const known = pts.filter(
    (p): p is { date: string; value: number } => p.value != null,
  );
  if (!known.length) return null;
  if (date < known[0].date) return null;
  if (date >= known[known.length - 1].date) return known[known.length - 1].value;
  let i = 0;
  while (i + 1 < known.length && known[i + 1].date < date) i += 1;
  const a = known[i];
  const b = known[i + 1];
  if (!b || b.date === date) return b?.value ?? a.value;
  const ta = toMs(a.date);
  const tb = toMs(b.date);
  const t = toMs(date);
  if (tb === ta) return a.value;
  return a.value + ((b.value - a.value) * (t - ta)) / (tb - ta);
}

/** Monotone cubic (PCHIP) interpolate — no overshoot on yearly medians. */
export function smoothValueAt(pts: Point[], date: string): number | null {
  const known = pts.filter(
    (p): p is { date: string; value: number } => p.value != null,
  );
  if (!known.length) return null;
  if (date < known[0].date) return null;
  if (date >= known[known.length - 1].date) return known[known.length - 1].value;
  const xs = known.map((p) => toMs(p.date));
  const ys = known.map((p) => p.value);
  const t = toMs(date);
  let i = 0;
  while (i + 1 < xs.length && xs[i + 1] < t) i += 1;
  const h: number[] = [];
  const d: number[] = [];
  for (let j = 0; j < xs.length - 1; j++) {
    const hj = xs[j + 1] - xs[j];
    h.push(hj);
    d.push(hj === 0 ? 0 : (ys[j + 1] - ys[j]) / hj);
  }
  const m = new Array<number>(ys.length).fill(0);
  m[0] = d[0] ?? 0;
  m[ys.length - 1] = d[d.length - 1] ?? 0;
  for (let j = 1; j < ys.length - 1; j++) {
    if (d[j - 1] * d[j] <= 0) m[j] = 0;
    else {
      const w1 = 2 * h[j] + h[j - 1];
      const w2 = h[j] + 2 * h[j - 1];
      m[j] = (w1 + w2) / (w1 / d[j - 1] + w2 / d[j]);
    }
  }
  const hi = h[i];
  if (!hi) return ys[i];
  const u = (t - xs[i]) / hi;
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    (2 * u3 - 3 * u2 + 1) * ys[i] +
    (u3 - 2 * u2 + u) * hi * m[i] +
    (-2 * u3 + 3 * u2) * ys[i + 1] +
    (u3 - u2) * hi * m[i + 1]
  );
}

function smoothstep(a: number): number {
  const x = Math.min(1, Math.max(0, a));
  return x * x * (3 - 2 * x);
}

/** Blend two positive levels with a C1 smoothstep on the time fraction. */
export function blendLevels(
  a: number,
  b: number,
  from: string,
  to: string,
  at: string,
): number {
  const span = toMs(to) - toMs(from);
  if (span <= 0) return b;
  const s = smoothstep((toMs(at) - toMs(from)) / span);
  if (a > 0 && b > 0) return Math.exp(Math.log(a) * (1 - s) + Math.log(b) * s);
  return a + (b - a) * s;
}

export function unionDates(series: Point[][]): string[] {
  const set = new Set<string>();
  for (const pts of series) pts.forEach((p) => set.add(p.date));
  return [...set].sort();
}

export function performanceOf(p: Property) {
  const pts = propertyPoints(p);
  const first = pts[0] ?? null;
  const last = pts.at(-1) ?? null;
  const hasPath = pts.length >= 2 && first?.value != null && last?.value != null;
  const delta = hasPath ? last.value! - first.value! : null;
  const pct = hasPath && first.value ? (delta! / first.value) * 100 : null;
  return { first, last, delta, pct, n: pts.length };
}
