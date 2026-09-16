import type { Property, PropertyStatus } from "./types";

export type Point = { date: string; value: number | null };

export function propertyPoints(p: Property): Point[] {
  return [...p.marks]
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
