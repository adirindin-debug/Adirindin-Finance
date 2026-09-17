import { blendLevels, monthGrid, smoothValueAt, valueAt, type Point } from "./chart";
import type { Mark, Property } from "./types";

/** Desk as-of. Avoid Date.now() so SSR and client share a window. */
export const CHART_AS_OF = "2026-09-14";

export type RangeKey = "1" | "3" | "5" | "10" | "20" | "all";
export type OverlayKey = "none" | "australia" | "melbourne" | "suburbs";

export const RANGE_OPTIONS: { id: RangeKey; label: string }[] = [
  { id: "1", label: "1Y" },
  { id: "3", label: "3Y" },
  { id: "5", label: "5Y" },
  { id: "10", label: "10Y" },
  { id: "20", label: "20Y" },
  { id: "all", label: "All" },
];

export function windowStart(range: RangeKey, asOf = CHART_AS_OF): string | null {
  if (range === "all") return null;
  const years = Number(range);
  const [y, m, d] = asOf.split("-").map(Number);
  return `${y - years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function clipPoints(
  points: Point[],
  start: string | null,
  end: string,
  carry = true,
  carryFrom: string | null = null,
): Point[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const inWindow = sorted.filter(
    (p) => (!start || p.date >= start) && p.date <= end,
  );
  if (carry && start) {
    const before = [...sorted]
      .reverse()
      .find((p) => p.date < start && p.value != null);
    if (
      before &&
      (!carryFrom || before.date >= carryFrom) &&
      !inWindow.some((p) => p.date === start)
    ) {
      inWindow.unshift({ date: start, value: before.value });
    }
  }
  return inWindow;
}

type Annual = { year: number; value: number };

function annualPoints(rows: Annual[]): Point[] {
  return rows.map((r) => ({
    date: `${r.year}-12-31`,
    value: r.value,
  }));
}

function mapAnnual(rows: Annual[]): Map<number, number> {
  return new Map(rows.map((r) => [r.year, r.value]));
}

/**
 * ABS 6432.0 Total Value of Dwellings, Australia mean residential
 * dwelling price ($'000 × 1000). Quarterly stock mean — same series as
 * TradingView AUAHP. Not a sale median and not Cotality HVI.
 * Source: ABS Table 1 series A83728647F, Jun quarter 2026 release.
 */
const AUSTRALIA_MEAN_ABS: Point[] = [
  { date: "2011-09-30", value: 490_800 },
  { date: "2011-12-31", value: 486_900 },
  { date: "2012-03-31", value: 488_600 },
  { date: "2012-06-30", value: 489_900 },
  { date: "2012-09-30", value: 486_300 },
  { date: "2012-12-31", value: 496_400 },
  { date: "2013-03-31", value: 501_100 },
  { date: "2013-06-30", value: 508_100 },
  { date: "2013-09-30", value: 515_500 },
  { date: "2013-12-31", value: 532_700 },
  { date: "2014-03-31", value: 539_300 },
  { date: "2014-06-30", value: 547_500 },
  { date: "2014-09-30", value: 553_500 },
  { date: "2014-12-31", value: 568_700 },
  { date: "2015-03-31", value: 579_300 },
  { date: "2015-06-30", value: 600_100 },
  { date: "2015-09-30", value: 611_000 },
  { date: "2015-12-31", value: 611_600 },
  { date: "2016-03-31", value: 609_300 },
  { date: "2016-06-30", value: 619_500 },
  { date: "2016-09-30", value: 628_600 },
  { date: "2016-12-31", value: 651_600 },
  { date: "2017-03-31", value: 665_000 },
  { date: "2017-06-30", value: 678_800 },
  { date: "2017-09-30", value: 676_400 },
  { date: "2017-12-31", value: 689_700 },
  { date: "2018-03-31", value: 688_000 },
  { date: "2018-06-30", value: 681_100 },
  { date: "2018-09-30", value: 671_700 },
  { date: "2018-12-31", value: 661_400 },
  { date: "2019-03-31", value: 646_000 },
  { date: "2019-06-30", value: 649_300 },
  { date: "2019-09-30", value: 668_800 },
  { date: "2019-12-31", value: 686_800 },
  { date: "2020-03-31", value: 694_700 },
  { date: "2020-06-30", value: 689_400 },
  { date: "2020-09-30", value: 706_700 },
  { date: "2020-12-31", value: 738_900 },
  { date: "2021-03-31", value: 778_300 },
  { date: "2021-06-30", value: 813_900 },
  { date: "2021-09-30", value: 865_700 },
  { date: "2021-12-31", value: 916_800 },
  { date: "2022-03-31", value: 930_600 },
  { date: "2022-06-30", value: 921_200 },
  { date: "2022-09-30", value: 890_500 },
  { date: "2022-12-31", value: 891_000 },
  { date: "2023-03-31", value: 890_900 },
  { date: "2023-06-30", value: 914_900 },
  { date: "2023-09-30", value: 925_200 },
  { date: "2023-12-31", value: 949_400 },
  { date: "2024-03-31", value: 962_100 },
  { date: "2024-06-30", value: 982_200 },
  { date: "2024-09-30", value: 983_300 },
  { date: "2024-12-31", value: 1_002_900 },
  { date: "2025-03-31", value: 1_007_800 },
  { date: "2025-06-30", value: 1_029_900 },
  { date: "2025-09-30", value: 1_050_900 },
  { date: "2025-12-31", value: 1_093_200 },
  { date: "2026-03-31", value: 1_108_600 },
  { date: "2026-06-30", value: 1_100_400 },
];

/**
 * Metropolitan Melbourne house sale median, plotted as the optional overlay.
 * 2013–2024: Valuer-General Victoria, A Guide to Property Values.
 * 2005 and 2010: Abelson & Joyeux (ANU TTPI WP 14/2023). Gap years are
 * missing, not zero. Do not mix with Cotality stock medians.
 */
const MELBOURNE_HOUSES: Annual[] = [
  { year: 2005, value: 320_500 },
  { year: 2010, value: 494_075 },
  { year: 2013, value: 520_000 },
  { year: 2014, value: 550_000 },
  { year: 2015, value: 600_000 },
  { year: 2016, value: 635_000 },
  { year: 2017, value: 721_000 },
  { year: 2018, value: 740_000 },
  { year: 2019, value: 721_000 },
  { year: 2020, value: 750_000 },
  { year: 2021, value: 875_000 },
  { year: 2022, value: 892_500 },
  { year: 2023, value: 860_000 },
  { year: 2024, value: 855_000 },
];

/**
 * Abelson & Chung 2005, Melbourne house medians. Used only as YoY growth
 * to bridge a title sale that sits before the VGV suburb tables (2013).
 * Not plotted as dollar levels on the overlay (different series to VGV).
 */
const MELBOURNE_CHUNG_HOUSES: Annual[] = [
  { year: 1990, value: 131_000 },
  { year: 1991, value: 127_000 },
  { year: 1992, value: 125_000 },
  { year: 1993, value: 126_000 },
  { year: 1994, value: 130_000 },
  { year: 1995, value: 129_000 },
  { year: 1996, value: 131_000 },
  { year: 1997, value: 142_000 },
  { year: 1998, value: 155_000 },
  { year: 1999, value: 175_000 },
  { year: 2000, value: 191_000 },
  { year: 2001, value: 225_000 },
  { year: 2002, value: 258_000 },
  { year: 2003, value: 276_000 },
];

/**
 * Abelson & Joyeux 2023 / ABS 6432, Melbourne house medians. Chain-linked
 * onto Chung at 2003 (ABS 2003 = $293,125) so the 2003 series break is not
 * treated as a 13% market move.
 */
const MELBOURNE_ABS_HOUSES: Annual[] = [
  { year: 2003, value: 293_125 },
  { year: 2004, value: 308_875 },
  { year: 2005, value: 320_500 },
  { year: 2006, value: 345_250 },
  { year: 2007, value: 371_750 },
  { year: 2008, value: 388_750 },
  { year: 2009, value: 418_625 },
  { year: 2010, value: 494_075 },
  { year: 2011, value: 492_375 },
  { year: 2012, value: 487_750 },
  { year: 2013, value: 516_750 },
  { year: 2014, value: 522_600 },
];

/**
 * Calendar-year suburb medians, Valuer-General Victoria, as published
 * in public suburb tables (2013–2024). Rolling “current” medians omitted.
 */
const SUBURB_MEDIANS: Record<string, { houses: Annual[]; units: Annual[] }> = {
  "Templestowe Lower": {
    houses: [
      { year: 2013, value: 750_000 },
      { year: 2014, value: 830_000 },
      { year: 2015, value: 1_060_000 },
      { year: 2016, value: 1_105_500 },
      { year: 2017, value: 1_302_000 },
      { year: 2018, value: 1_150_000 },
      { year: 2019, value: 1_080_000 },
      { year: 2020, value: 1_189_000 },
      { year: 2021, value: 1_432_500 },
      { year: 2022, value: 1_390_000 },
      { year: 2023, value: 1_410_000 },
      { year: 2024, value: 1_362_000 },
    ],
    units: [
      { year: 2013, value: 555_000 },
      { year: 2014, value: 567_500 },
      { year: 2015, value: 700_000 },
      { year: 2016, value: 699_000 },
      { year: 2017, value: 880_000 },
      { year: 2018, value: 810_000 },
      { year: 2019, value: 777_000 },
      { year: 2020, value: 880_000 },
      { year: 2021, value: 937_500 },
      { year: 2022, value: 985_000 },
      { year: 2023, value: 1_050_000 },
      { year: 2024, value: 1_010_000 },
    ],
  },
  Preston: {
    houses: [
      { year: 2013, value: 632_500 },
      { year: 2014, value: 690_000 },
      { year: 2015, value: 791_000 },
      { year: 2016, value: 882_000 },
      { year: 2017, value: 996_000 },
      { year: 2018, value: 980_000 },
      { year: 2019, value: 940_000 },
      { year: 2020, value: 1_026_000 },
      { year: 2021, value: 1_251_000 },
      { year: 2022, value: 1_160_000 },
      { year: 2023, value: 1_150_000 },
      { year: 2024, value: 1_185_000 },
    ],
    units: [
      { year: 2013, value: 425_000 },
      { year: 2014, value: 440_000 },
      { year: 2015, value: 450_000 },
      { year: 2016, value: 455_000 },
      { year: 2017, value: 450_000 },
      { year: 2018, value: 500_000 },
      { year: 2019, value: 500_000 },
      { year: 2020, value: 550_000 },
      { year: 2021, value: 620_000 },
      { year: 2022, value: 612_500 },
      { year: 2023, value: 575_500 },
      { year: 2024, value: 610_000 },
    ],
  },
  Bulleen: {
    houses: [
      { year: 2013, value: 780_000 },
      { year: 2014, value: 861_000 },
      { year: 2015, value: 1_095_000 },
      { year: 2016, value: 1_170_000 },
      { year: 2017, value: 1_300_000 },
      { year: 2018, value: 1_230_000 },
      { year: 2019, value: 1_105_000 },
      { year: 2020, value: 1_177_000 },
      { year: 2021, value: 1_355_000 },
      { year: 2022, value: 1_386_000 },
      { year: 2023, value: 1_400_000 },
      { year: 2024, value: 1_300_000 },
    ],
    units: [
      { year: 2013, value: 607_500 },
      { year: 2014, value: 629_000 },
      { year: 2015, value: 722_500 },
      { year: 2016, value: 768_000 },
      { year: 2017, value: 787_000 },
      { year: 2018, value: 746_000 },
      { year: 2019, value: 675_000 },
      { year: 2020, value: 751_000 },
      { year: 2021, value: 755_000 },
      { year: 2022, value: 845_000 },
      { year: 2023, value: 890_000 },
      { year: 2024, value: 790_000 },
    ],
  },
  "Chirnside Park": {
    houses: [
      { year: 2013, value: 450_000 },
      { year: 2014, value: 490_500 },
      { year: 2015, value: 542_500 },
      { year: 2016, value: 627_000 },
      { year: 2017, value: 735_000 },
      { year: 2018, value: 700_000 },
      { year: 2019, value: 680_500 },
      { year: 2020, value: 750_000 },
      { year: 2021, value: 900_000 },
      { year: 2022, value: 925_000 },
      { year: 2023, value: 900_000 },
      { year: 2024, value: 890_500 },
    ],
    units: [
      { year: 2013, value: 385_500 },
      { year: 2014, value: 497_000 },
      { year: 2015, value: 464_000 },
      { year: 2016, value: 476_500 },
      { year: 2017, value: 495_000 },
      { year: 2018, value: 532_500 },
      { year: 2019, value: 598_000 },
      { year: 2020, value: 620_000 },
      { year: 2021, value: 675_000 },
      { year: 2022, value: 700_500 },
      { year: 2023, value: 701_000 },
      { year: 2024, value: 712_500 },
    ],
  },
};

export function latestAustraliaMean(): { date: string; value: number } {
  const last = AUSTRALIA_MEAN_ABS[AUSTRALIA_MEAN_ABS.length - 1];
  return { date: last.date, value: last.value ?? 0 };
}

export function australiaOverlay(): Point[] {
  return AUSTRALIA_MEAN_ABS.map((p) => ({ ...p }));
}

export function melbourneOverlay(): Point[] {
  return annualPoints(MELBOURNE_HOUSES);
}

function dwellingKey(p: Property): "houses" | "units" {
  return p.type === "unit" ? "units" : "houses";
}

function isVic(p: Property): boolean {
  return /^\s*3\d{3}\s*$/.test(p.postcode) || Boolean(SUBURB_MEDIANS[p.suburb]);
}

function australiaAnnual(): Annual[] {
  const last = new Map<number, number>();
  for (const p of AUSTRALIA_MEAN_ABS) {
    last.set(Number(p.date.slice(0, 4)), p.value ?? 0);
  }
  return [...last.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ year, value }));
}

export function suburbOverlays(
  properties: Property[],
): { key: string; label: string; points: Point[] }[] {
  const seen = new Set<string>();
  const out: { key: string; label: string; points: Point[] }[] = [];
  for (const p of properties) {
    const table = SUBURB_MEDIANS[p.suburb];
    if (!table) continue;
    const kind = dwellingKey(p);
    const id = `${p.suburb}|${kind}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const noun = kind === "units" ? "units" : "houses";
    out.push({
      key: `suburb-${p.suburb.toLowerCase().replace(/\s+/g, "-")}-${noun}`,
      label: `${p.suburb} ${noun} (VGV)`,
      points: annualPoints(table[kind]),
    });
  }
  return out;
}

/**
 * Rebase `base` into the units of `next` at `spliceYear`, then follow `next`.
 * Growth before the splice is preserved; the level from spliceYear on is `next`.
 */
function chainOn(
  base: Map<number, number>,
  next: Annual[],
  spliceYear: number,
): Map<number, number> {
  const out = new Map<number, number>();
  const b = base.get(spliceYear);
  const n = next.find((r) => r.year === spliceYear)?.value;
  if (b && n) {
    const scale = n / b;
    for (const [y, v] of base) {
      if (y < spliceYear) out.set(y, v * scale);
    }
  } else {
    for (const [y, v] of base) out.set(y, v);
  }
  for (const r of next) {
    if (!b || !n || r.year >= spliceYear) out.set(r.year, r.value);
  }
  return out;
}

function melbourneGrowthIndex(): Map<number, number> {
  return chainOn(mapAnnual(MELBOURNE_CHUNG_HOUSES), MELBOURNE_ABS_HOUSES, 2003);
}

function suburbTable(p: Property): Annual[] | null {
  const table = SUBURB_MEDIANS[p.suburb];
  if (!table) return null;
  const rows = table[dwellingKey(p)];
  return rows.length ? rows : null;
}

function propertyIndex(p: Property): Map<number, number> | null {
  const suburb = suburbTable(p);
  const melb = melbourneGrowthIndex();
  if (suburb) return chainOn(melb, suburb, suburb[0].year);
  if (isVic(p)) {
    const vgv = MELBOURNE_HOUSES.filter((r) => r.year >= 2015);
    if (vgv.length) return chainOn(melb, vgv, 2015);
  }
  const au = australiaAnnual();
  if (au.length >= 2) return mapAnnual(au);
  return melb.size ? melb : null;
}

function indexCurve(p: Property): Point[] {
  const idx = propertyIndex(p);
  if (!idx || idx.size < 2) return [];
  return [...idx.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, value]) => ({ date: `${year}-12-31`, value }));
}

function anchorsOf(p: Property): { anchors: Mark[]; estimateOnly: boolean } {
  const marks = [...p.marks].sort((a, b) => a.date.localeCompare(b.date));
  const hard = marks.filter(
    (m) => m.method === "sale" || m.method === "list-mid" || m.method === "manual",
  );
  if (hard.length) return { anchors: hard, estimateOnly: false };
  const est = marks.filter((m) => m.method === "estimate");
  if (!est.length) return { anchors: [], estimateOnly: true };
  return { anchors: est, estimateOnly: true };
}

/**
 * Area-median path for one title. Official sale medians (VGV / LANDATA —
 * the same public sales REA neighbourhood pages plot), chain-linked onto
 * Melbourne house growth before the suburb table starts.
 *
 * Sparse titles are backcast *before* the first sale on a PCHIP-smoothed
 * median path, then the title's premium vs that median is blended smoothly
 * between public prints so the line doesn't kink at each sale.
 * Not a valuation of the address.
 */
export function indexedPath(p: Property): Point[] {
  const { anchors, estimateOnly } = anchorsOf(p);
  if (!anchors.length) return [];
  const curve = indexCurve(p);
  if (curve.length < 2) return [];
  const suburb = suburbTable(p);
  if (estimateOnly && !suburb) return [];

  const start =
    estimateOnly && suburb
      ? `${suburb[0].year}-12-31`
      : curve[0]!.date;
  const first = anchors[0]!;
  const dates = [
    ...new Set([
      ...monthGrid(start, CHART_AS_OF),
      ...anchors.map((a) => a.date),
      CHART_AS_OF,
    ]),
  ]
    .filter((d) => d >= start && d <= CHART_AS_OF)
    .sort();

  const indexOn = (date: string, fallbackYear: string) =>
    smoothValueAt(curve, date) ??
    valueAt(curve, date) ??
    smoothValueAt(curve, `${fallbackYear.slice(0, 4)}-12-31`);

  const scaled = (sale: Mark, date: string): number | null => {
    const iY = indexOn(date, date);
    const iA = indexOn(sale.date, sale.date);
    if (iY == null || iA == null || iA === 0) return null;
    return sale.mid * (iY / iA);
  };

  const annual: Point[] = [];
  for (const date of dates) {
    const prev = anchors.filter((a) => a.date <= date).at(-1) ?? first;
    const next = anchors.find((a) => a.date > date);
    const v0 = scaled(prev, date);
    if (v0 == null) continue;
    let value = v0;
    if (next) {
      const v1 = scaled(next, date);
      if (v1 != null) value = blendLevels(v0, v1, prev.date, next.date, date);
    }
    annual.push({ date, value: Math.round(value) });
  }
  return stitchPath(annual, anchors);
}

const HARD: Mark["method"][] = ["sale", "list-mid", "manual"];

function isHard(m: { method: string }): boolean {
  return HARD.includes(m.method as Mark["method"]);
}

/** Pin public prints; drop estimate needles; cap one-month spikes that are not sales. */
function stitchPath(annual: Point[], marks: Mark[]): Point[] {
  const locked = new Set(marks.filter(isHard).map((m) => m.date));
  const byDate = new Map<string, Point>();
  for (const pt of annual) {
    if (pt.value != null) byDate.set(pt.date, pt);
  }
  for (const m of marks) {
    if (!isHard(m) && marks.some(isHard)) continue;
    byDate.set(m.date, { date: m.date, value: m.mid });
  }
  const out = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const smoothed = despike(out, locked);
  const last = smoothed.at(-1);
  if (last && last.date < CHART_AS_OF && last.value != null) {
    smoothed.push({ date: CHART_AS_OF, value: last.value });
  }
  return smoothed;
}

/** Flatten a point that jumps vs both neighbours. Sales stay put. */
function despike(path: Point[], locked: Set<string>): Point[] {
  const out = path.map((p) => ({ ...p }));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < out.length - 1; i++) {
      const prev = out[i - 1].value;
      const cur = out[i].value;
      const next = out[i + 1].value;
      if (prev == null || cur == null || next == null) continue;
      if (locked.has(out[i].date)) continue;
      const chord = (prev + next) / 2;
      const isolated =
        Math.abs(cur - prev) / Math.max(prev, 1) > 0.06 &&
        Math.abs(cur - next) / Math.max(next, 1) > 0.06 &&
        Math.abs(cur - chord) / Math.max(Math.abs(chord), 1) > 0.05;
      if (isolated) {
        out[i] = { date: out[i].date, value: Math.round(chord) };
      }
    }
  }
  return out;
}

export function hasIndexedPath(p: Property): boolean {
  return indexedPath(p).length >= 2;
}

export function toMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function yearTicks(start: string, end: string): number[] {
  const y0 = Number(start.slice(0, 4));
  const y1 = Number(end.slice(0, 4));
  const step = y1 - y0 > 12 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = y0; y <= y1; y += step) {
    ticks.push(toMs(`${y}-01-01`));
  }
  return ticks;
}
