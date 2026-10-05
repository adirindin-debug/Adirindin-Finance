/**
 * Monthly / quarterly returns ("seasonality") for /charts/seasonality.
 *
 * The API ships one record per calendar month: [YYYY-MM, last trading date in
 * that month, close on that date]. Everything else (monthly and quarterly
 * returns, per-column odds) is derived here so the page and the hub card agree.
 *
 * Return for a period = close on the period's last trading day ÷ close on the
 * previous period's last trading day − 1. The current, unfinished period is
 * flagged as in progress (latest close so far) and is left out of the odds.
 * History only — not a forecast. NFA.
 */

export type SeasonAsset = "btc" | "spx";
export type SeasonPeriod = "monthly" | "quarterly";

/** [period key YYYY-MM, last trading date YYYY-MM-DD, close]. */
export type MonthClose = [string, string, number];

export type SeasonSeries = {
  months: MonthClose[];
  /** First daily close used (the baseline month's first day). */
  firstDate: string;
  /** Latest daily close in the series. */
  lastDate: string;
  /** Calendar month "now" in the asset's market clock (UTC for BTC, New York for the S&P 500). */
  currentMonth: string;
  /** BTC only: first date taken from Yahoo; earlier closes are blockchain.com daily averages. */
  yahooFrom?: string;
  /** true when this asset is served from the dated snapshot (live feed failed). */
  snapshot?: boolean;
};

export type SeasonPayload = {
  ok: boolean;
  updatedAt: string;
  snapshot?: boolean;
  snapshotAsOf?: string;
  assets: Record<SeasonAsset, SeasonSeries>;
  error?: string;
};

export const SEASON_FOOTER =
  "Research tool. Past seasonality is not a forecast. Not financial advice.";

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];

export const ASSET_LABEL: Record<SeasonAsset, string> = { btc: "BTC", spx: "S&P 500" };

export type SeasonCell = {
  year: number;
  /** 0-based column (month 0–11 or quarter 0–3). */
  col: number;
  label: string;
  /** null when the previous period's close is not in the data (first period). */
  ret: number | null;
  inProgress: boolean;
  endDate: string;
  close: number;
  prevDate: string | null;
  prevClose: number | null;
  /** BTC: true when either close is a blockchain.com daily average (pre Yahoo). */
  avgSource?: boolean;
};

export type ColumnStat = {
  col: number;
  label: string;
  n: number;
  green: number;
  pctGreen: number | null;
  avg: number | null;
  median: number | null;
};

export type SeasonGrid = {
  period: SeasonPeriod;
  cols: string[];
  /** Newest year first. */
  years: number[];
  cells: Map<string, SeasonCell>;
  stats: ColumnStat[];
  /** Column of the current (in-progress) period, in the current year. */
  current: { year: number; col: number } | null;
  firstYear: number;
  lastYear: number;
};

export const cellKey = (year: number, col: number) => `${year}-${col}`;

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const quarterOf = (key: string) => {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return { y, q: Math.floor((m - 1) / 3) };
};
const qKey = (y: number, q: number) => y * 4 + q;

export function buildGrid(series: SeasonSeries, period: SeasonPeriod): SeasonGrid {
  const cells = new Map<string, SeasonCell>();
  const ys = series.yahooFrom ?? null;
  const isAvg = (d: string | null) => (ys != null && d != null ? d < ys : false);

  if (period === "monthly") {
    const byKey = new Map(series.months.map((m) => [m[0], m] as const));
    for (const [key, date, close] of series.months) {
      const [y, m] = key.split("-").map(Number) as [number, number];
      const prev = byKey.get(prevMonthKey(key));
      const ret = prev ? (close / prev[2] - 1) * 100 : null;
      cells.set(cellKey(y, m - 1), {
        year: y,
        col: m - 1,
        label: `${MONTH_LABELS[m - 1]} ${y}`,
        ret,
        inProgress: key === series.currentMonth,
        endDate: date,
        close,
        prevDate: prev?.[1] ?? null,
        prevClose: prev?.[2] ?? null,
        avgSource: ys != null ? isAvg(date) || isAvg(prev?.[1] ?? null) : undefined,
      });
    }
  } else {
    // Quarter close = last monthly record inside that quarter.
    const qs = new Map<number, { y: number; q: number; date: string; close: number; months: number }>();
    for (const [key, date, close] of series.months) {
      const { y, q } = quarterOf(key);
      const k = qKey(y, q);
      const cur = qs.get(k);
      qs.set(k, { y, q, date, close, months: (cur?.months ?? 0) + 1 });
    }
    const curQ = quarterOf(series.currentMonth);
    const curK = qKey(curQ.y, curQ.q);
    for (const [k, v] of qs) {
      const prev = qs.get(k - 1);
      // Previous quarter must be complete (its last month present) to be a fair base.
      const prevComplete = prev != null && prev.date.slice(5, 7) === String(((k - 1) % 4) * 3 + 3).padStart(2, "0");
      const ret = prev && prevComplete ? (v.close / prev.close - 1) * 100 : null;
      cells.set(cellKey(v.y, v.q), {
        year: v.y,
        col: v.q,
        label: `${QUARTER_LABELS[v.q]} ${v.y}`,
        ret,
        inProgress: k === curK,
        endDate: v.date,
        close: v.close,
        prevDate: prevComplete ? prev!.date : null,
        prevClose: prevComplete ? prev!.close : null,
        avgSource: ys != null ? isAvg(v.date) || isAvg(prevComplete ? prev!.date : null) : undefined,
      });
    }
  }

  const cols = period === "monthly" ? MONTH_LABELS : QUARTER_LABELS;
  const yearSet = new Set<number>();
  for (const c of cells.values()) if (c.ret != null || c.inProgress) yearSet.add(c.year);

  const [cy, cm] = series.currentMonth.split("-").map(Number) as [number, number];
  const current = { year: cy, col: period === "monthly" ? cm - 1 : Math.floor((cm - 1) / 3) };
  yearSet.add(cy);
  const years = [...yearSet].sort((a, b) => b - a);

  const stats: ColumnStat[] = cols.map((label, col) => {
    const rets: number[] = [];
    for (const c of cells.values()) {
      if (c.col === col && c.ret != null && !c.inProgress) rets.push(c.ret);
    }
    const green = rets.filter((r) => r > 0).length;
    return {
      col,
      label,
      n: rets.length,
      green,
      pctGreen: rets.length ? (green / rets.length) * 100 : null,
      avg: rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null,
      median: median(rets),
    };
  });

  return {
    period,
    cols,
    years,
    cells,
    stats,
    current,
    firstYear: years[years.length - 1] ?? cy,
    lastYear: years[0] ?? cy,
  };
}

/** Span of completed periods behind the odds, e.g. "Jan 2013 – Sep 2026". */
export function coverageLabel(grid: SeasonGrid): string {
  const done = [...grid.cells.values()].filter((c) => c.ret != null && !c.inProgress);
  if (!done.length) return "—";
  done.sort((a, b) => a.year - b.year || a.col - b.col);
  return `${done[0]!.label} – ${done[done.length - 1]!.label}`;
}

export function fmtRet(r: number | null | undefined, dp = 1): string {
  if (r == null || !Number.isFinite(r)) return "—";
  const v = Math.abs(r) < 0.05 && dp === 1 ? 0 : r;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(dp)}%`;
}

export function fmtClose(asset: SeasonAsset, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (asset === "btc") {
    return `US$${v.toLocaleString("en-AU", {
      minimumFractionDigits: v < 1000 ? 2 : 0,
      maximumFractionDigits: v < 1000 ? 2 : 0,
    })}`;
  }
  return `${v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} pts`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTH_LABELS[m - 1]} ${y}`;
}

/** Tile colour: green up / red down, alpha scaled by size against a per-asset cap. */
export const GREEN_RGB = "61,204,154";
export const RED_RGB = "239,107,107";
export function tileBg(asset: SeasonAsset, period: SeasonPeriod, r: number | null): string {
  if (r == null || !Number.isFinite(r)) return "rgba(255,255,255,0.03)";
  const cap = asset === "btc" ? (period === "monthly" ? 40 : 80) : period === "monthly" ? 8 : 16;
  const k = Math.min(Math.abs(r) / cap, 1);
  const a = 0.16 + 0.64 * Math.sqrt(k);
  return `rgba(${r >= 0 ? GREEN_RGB : RED_RGB},${a.toFixed(3)})`;
}

/** Odds for the current month column (completed years only). */
export function currentMonthOdds(series: SeasonSeries) {
  const grid = buildGrid(series, "monthly");
  const col = grid.current?.col ?? 0;
  const stat = grid.stats[col]!;
  const live = grid.current ? grid.cells.get(cellKey(grid.current.year, grid.current.col)) : undefined;
  return { grid, col, monthName: MONTH_NAMES[col]!, stat, live };
}
