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

/**
 * Asset registry. To add an asset: add its key here, a SEASON_ASSETS entry, and
 * its history to src/data/seasonality-snapshot.json — the API, toggles, grid and
 * hub card pick it up from this list.
 */
export type SeasonAsset = "btc" | "eth" | "sol" | "xrp" | "zec" | "ltc" | "doge" | "msci" | "spx" | "nq" | "ndx" | "rut";
export type SeasonMarket = "crypto" | "equities";

export type SeasonAssetDef = {
  key: SeasonAsset;
  market: SeasonMarket;
  /** Toggle / title label. */
  label: string;
  /** Yahoo Finance symbol for the live feed. */
  yahoo: string;
  /** Market clock: UTC days (crypto) or New York trading days. */
  clock: "utc" | "ny";
  /** How closes print in hover cards. */
  closeFmt: "usd" | "pts";
  /** Tile shade caps: a move this big (in %) gets the strongest colour. */
  cap: { monthly: number; quarterly: number; yearly: number };
  /** Source note under the grid. */
  source: string;
};

export const SEASON_ASSETS: SeasonAssetDef[] = [
  {
    key: "btc",
    market: "crypto",
    label: "Bitcoin",
    yahoo: "BTC-USD",
    clock: "utc",
    closeFmt: "usd",
    cap: { monthly: 40, quarterly: 80, yearly: 160 },
    source:
      "Source: Yahoo Finance BTC-USD daily close (UTC) from 17 Sep 2014; Dec 2012 – 16 Sep 2014 use the blockchain.com average USD market price across major exchanges (a daily average, not a close). Earlier, thinly traded years are not shown. Recent-month fallback: Coinbase Exchange.",
  },
  {
    key: "eth",
    market: "crypto",
    label: "Ethereum",
    yahoo: "ETH-USD",
    clock: "utc",
    closeFmt: "usd",
    cap: { monthly: 50, quarterly: 100, yearly: 200 },
    source: "Source: Yahoo Finance ETH-USD daily close (UTC), from 9 Nov 2017 (the start of Yahoo's history).",
  },
  {
    key: "sol",
    market: "crypto",
    label: "Solana",
    yahoo: "SOL-USD",
    clock: "utc",
    closeFmt: "usd",
    cap: { monthly: 60, quarterly: 120, yearly: 240 },
    source: "Source: Yahoo Finance SOL-USD daily close (UTC), from 10 Apr 2020 (the start of Yahoo's history).",
  },
  {
    key: "xrp",
    market: "crypto",
    label: "XRP",
    yahoo: "XRP-USD",
    clock: "utc",
    closeFmt: "usd",
    cap: { monthly: 50, quarterly: 100, yearly: 200 },
    source: "Source: Yahoo Finance XRP-USD daily close (UTC), from 9 Nov 2017 (the start of Yahoo's history).",
  },
  {
    key: "zec",
    market: "crypto",
    label: "Zcash",
    yahoo: "ZEC-USD",
    clock: "utc",
    closeFmt: "usd",
    cap: { monthly: 50, quarterly: 100, yearly: 200 },
    source: "Source: Yahoo Finance ZEC-USD daily close (UTC), from 9 Nov 2017 (the start of Yahoo's history).",
  },
  {
    key: "ltc",
    market: "crypto",
    label: "Litecoin",
    yahoo: "LTC-USD",
    clock: "utc",
    closeFmt: "usd",
    cap: { monthly: 40, quarterly: 80, yearly: 160 },
    source: "Source: Yahoo Finance LTC-USD daily close (UTC), from 17 Sep 2014 (the start of Yahoo's history).",
  },
  {
    key: "doge",
    market: "crypto",
    label: "Dogecoin",
    yahoo: "DOGE-USD",
    clock: "utc",
    closeFmt: "usd",
    cap: { monthly: 60, quarterly: 120, yearly: 200 },
    source: "Source: Yahoo Finance DOGE-USD daily close (UTC).",
  },

  {
    key: "msci",
    market: "equities",
    label: "MSCI World",
    yahoo: "URTH",
    clock: "ny",
    closeFmt: "usd",
    cap: { monthly: 8, quarterly: 16, yearly: 32 },
    source:
      "Source: Yahoo Finance URTH daily close — the iShares MSCI World ETF, used as a stand-in because MSCI index data can't be republished. Price only (distributions excluded, after ETF fees), so it runs slightly under the index's total return. URTH history starts Jan 2012.",
  },
  {
    key: "spx",
    market: "equities",
    label: "S&P 500",
    yahoo: "^GSPC",
    clock: "ny",
    closeFmt: "pts",
    cap: { monthly: 8, quarterly: 16, yearly: 32 },
    source:
      "Source: Yahoo Finance ^GSPC daily close — the S&P 500 price index, excluding dividends, so total returns were higher. Shown from 1950 (base: Dec 1949 close); before March 1957 the series is S&P's 90-stock predecessor index.",
  },
  {
    key: "nq",
    market: "equities",
    label: "Nasdaq Composite",
    yahoo: "^IXIC",
    clock: "ny",
    closeFmt: "pts",
    cap: { monthly: 10, quarterly: 20, yearly: 40 },
    source:
      "Source: Yahoo Finance ^IXIC daily close — the Nasdaq Composite price index, excluding dividends, so total returns were higher. Shown from Feb 1971.",
  },
  {
    key: "ndx",
    market: "equities",
    label: "Nasdaq 100",
    yahoo: "^NDX",
    clock: "ny",
    closeFmt: "pts",
    cap: { monthly: 10, quarterly: 20, yearly: 40 },
    source:
      "Source: Yahoo Finance ^NDX daily close — the Nasdaq-100 price index, excluding dividends. History from Oct 1985.",
  },
  {
    key: "rut",
    market: "equities",
    label: "Russell 2000",
    yahoo: "^RUT",
    clock: "ny",
    closeFmt: "pts",
    cap: { monthly: 10, quarterly: 20, yearly: 40 },
    source:
      "Source: Yahoo Finance ^RUT daily close — the Russell 2000 price index, excluding dividends. History from Sep 1987.",
  },

];

export const ASSET_DEF = Object.fromEntries(SEASON_ASSETS.map((a) => [a.key, a])) as Record<SeasonAsset, SeasonAssetDef>;
export const MARKET_ASSETS = (m: SeasonMarket) => SEASON_ASSETS.filter((a) => a.market === m);
export const isMarket = (m: unknown): m is SeasonMarket => m === "crypto" || m === "equities";
export const MARKET_LABEL: Record<SeasonMarket, string> = { crypto: "Crypto", equities: "Equities" };
export type SeasonPeriod = "monthly" | "quarterly" | "yearly";

/** [period key YYYY-MM, last trading date YYYY-MM-DD, close]. */
export type MonthClose = [string, string, number];

export type SeasonSeries = {
  months: MonthClose[];
  /** First daily close used (the baseline month's first day). */
  firstDate: string;
  /** Latest daily close in the series. */
  lastDate: string;
  /** Calendar month "now" in the asset's market clock (UTC for crypto, New York for equities). */
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
  market?: SeasonMarket;
  /** Only the requested market's assets are included. */
  assets: Partial<Record<SeasonAsset, SeasonSeries>>;
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
export const YEAR_LABELS = ["Annual"];

export const ASSET_LABEL = Object.fromEntries(SEASON_ASSETS.map((a) => [a.key, a.label])) as Record<SeasonAsset, string>;

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
  } else if (period === "quarterly") {
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
  } else {
    // Year close = last monthly record in that calendar year; return vs previous Dec close.
    const byYear = new Map<number, { date: string; close: number; hasDec: boolean }>();
    for (const [key, date, close] of series.months) {
      const y = Number(key.slice(0, 4));
      const cur = byYear.get(y);
      byYear.set(y, {
        date,
        close,
        hasDec: key.endsWith("-12") || Boolean(cur?.hasDec),
      });
    }
    const [cy] = series.currentMonth.split("-").map(Number) as [number, number];
    for (const [y, v] of byYear) {
      const prev = byYear.get(y - 1);
      const prevComplete = prev != null && prev.hasDec;
      const ret = prev && prevComplete ? (v.close / prev.close - 1) * 100 : null;
      cells.set(cellKey(y, 0), {
        year: y,
        col: 0,
        label: String(y),
        ret,
        inProgress: y === cy,
        endDate: v.date,
        close: v.close,
        prevDate: prevComplete ? prev!.date : null,
        prevClose: prevComplete ? prev!.close : null,
        avgSource: ys != null ? isAvg(v.date) || isAvg(prevComplete ? prev!.date : null) : undefined,
      });
    }
  }

  const cols = period === "monthly" ? MONTH_LABELS : period === "quarterly" ? QUARTER_LABELS : YEAR_LABELS;
  const yearSet = new Set<number>();
  for (const c of cells.values()) if (c.ret != null || c.inProgress) yearSet.add(c.year);

  const [cy, cm] = series.currentMonth.split("-").map(Number) as [number, number];
  const current = {
    year: cy,
    col: period === "monthly" ? cm - 1 : period === "quarterly" ? Math.floor((cm - 1) / 3) : 0,
  };
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
  if (ASSET_DEF[asset].closeFmt === "usd") {
    const dp = v < 1 ? 4 : v < 1000 ? 2 : 0;
    return `US$${v.toLocaleString("en-AU", {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
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
  const cap = ASSET_DEF[asset].cap[period];
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
