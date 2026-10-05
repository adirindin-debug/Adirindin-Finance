/**
 * US spot crypto ETF net flows — shared types and aggregation.
 * Daily series are summed into weekly / monthly / quarterly / yearly buckets.
 * Values are USD (Farside US$m totals converted ×1e6; ZCSH CSV already USD).
 * Educational · never invent figures · NFA.
 */

export type EtfAssetId = "btc" | "eth" | "sol" | "zcsh";

/** Dropdown view: Total (sum of assets) or a single asset. */
export type EtfViewId = "total" | EtfAssetId;

export type EtfAgg = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type EtfDay = { date: string; netFlowUsd: number };

export type EtfAssetStatus = "ok" | "pending" | "error";

export type EtfAssetSeries = {
  label: string;
  source: string;
  sourceUrl: string;
  status: EtfAssetStatus;
  pendingReason?: string;
  firstDate: string | null;
  lastDate: string | null;
  days: EtfDay[];
  snapshot?: boolean;
};

export type EtfFlowsPayload = {
  ok: boolean;
  asOf: string;
  unit: "USD";
  assets: Record<EtfAssetId, EtfAssetSeries>;
  errors?: string[];
  disclaimer?: string;
};

export type EtfBucket = {
  /** Bucket start date (ISO YYYY-MM-DD) or period key for labels. */
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  netFlowUsd: number;
  /** Running sum of bucket nets from the first bucket in the series. */
  cumulativeUsd: number;
};

export const ETF_ASSETS: EtfAssetId[] = ["btc", "eth", "sol", "zcsh"];

/** Dropdown order — Total first (default). */
export const ETF_VIEWS: EtfViewId[] = ["total", "btc", "eth", "sol", "zcsh"];

export const ETF_ASSET_META: Record<
  EtfViewId,
  { label: string; short: string; color: string }
> = {
  total: {
    label: "Total (all crypto ETFs)",
    short: "Total",
    color: "#9eb0c8",
  },
  btc: { label: "Bitcoin", short: "BTC", color: "#f7931a" },
  eth: { label: "Ethereum", short: "ETH", color: "#627eea" },
  sol: { label: "Solana", short: "SOL", color: "#14f195" },
  zcsh: { label: "Zcash (ZCSH)", short: "ZCSH", color: "#f4b942" },
};

export const ETF_AGGS: { key: EtfAgg; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

export function isEtfAsset(v: string): v is EtfAssetId {
  return (ETF_ASSETS as string[]).includes(v);
}

export function isEtfView(v: string): v is EtfViewId {
  return (ETF_VIEWS as string[]).includes(v);
}

/**
 * Sum daily net flows across assets that have a print that day.
 * Missing asset on a date contributes 0 (never invent). Only ok series with days.
 * Cumulative of the result = total net inflows − outflows across included ETFs.
 */
export function buildTotalSeries(
  assets: Record<EtfAssetId, EtfAssetSeries>,
): EtfAssetSeries {
  const byDate = new Map<string, number>();
  const sources: string[] = [];
  const urls: string[] = [];
  let anyOk = false;

  for (const id of ETF_ASSETS) {
    const a = assets[id];
    if (!a || a.status !== "ok" || !a.days.length) continue;
    anyOk = true;
    if (a.source) sources.push(`${ETF_ASSET_META[id].short}: ${a.source}`);
    if (a.sourceUrl) urls.push(a.sourceUrl);
    for (const d of a.days) {
      byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.netFlowUsd);
    }
  }

  const dates = [...byDate.keys()].sort();
  const days: EtfDay[] = dates.map((date) => ({
    date,
    netFlowUsd: byDate.get(date)!,
  }));

  return {
    label: ETF_ASSET_META.total.label,
    source: sources.length
      ? `Sum of available series — ${sources.join("; ")}`
      : "Sum of available crypto ETF flow series",
    sourceUrl: urls[0] ?? "https://farside.co.uk/",
    status: anyOk && days.length ? "ok" : "pending",
    pendingReason: anyOk
      ? undefined
      : "No underlying asset series available yet",
    firstDate: days[0]?.date ?? null,
    lastDate: days[days.length - 1]?.date ?? null,
    days,
  };
}

/** Resolve a view (Total or single asset) to a series. */
export function seriesForView(
  payload: EtfFlowsPayload,
  view: EtfViewId,
): EtfAssetSeries | undefined {
  if (view === "total") return buildTotalSeries(payload.assets);
  return payload.assets[view];
}

export function isEtfAgg(v: string): v is EtfAgg {
  return ETF_AGGS.some((a) => a.key === v);
}

/** Parse ISO date as UTC noon to avoid DST edge cases. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO week key YYYY-Www (UTC), Monday-based. */
function isoWeekKey(iso: string): { key: string; start: string; end: string } {
  const dt = parseIsoDate(iso);
  const day = dt.getUTCDay() || 7; // Mon=1 … Sun=7
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - (day - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  // ISO week year
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / 604_800_000) + 1;
  const y = thursday.getUTCFullYear();
  const start = `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`;
  const end = `${sunday.getUTCFullYear()}-${pad2(sunday.getUTCMonth() + 1)}-${pad2(sunday.getUTCDate())}`;
  return { key: `${y}-W${pad2(week)}`, start, end };
}

function monthKey(iso: string): { key: string; start: string; end: string } {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    key: `${y}-${pad2(m)}`,
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(lastDay)}`,
  };
}

function quarterKey(iso: string): { key: string; start: string; end: string } {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  const q = Math.floor((m - 1) / 3) + 1;
  const startM = (q - 1) * 3 + 1;
  const endM = startM + 2;
  const lastDay = new Date(Date.UTC(y, endM, 0)).getUTCDate();
  return {
    key: `${y}-Q${q}`,
    start: `${y}-${pad2(startM)}-01`,
    end: `${y}-${pad2(endM)}-${pad2(lastDay)}`,
  };
}

function yearKey(iso: string): { key: string; start: string; end: string } {
  const y = Number(iso.slice(0, 4));
  return { key: String(y), start: `${y}-01-01`, end: `${y}-12-31` };
}

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function bucketLabel(agg: EtfAgg, key: string, start: string, end: string): string {
  if (agg === "daily") {
    const dt = parseIsoDate(start);
    return `${dt.getUTCDate()} ${MONTH_SHORT[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
  }
  if (agg === "weekly") {
    const a = parseIsoDate(start);
    const b = parseIsoDate(end);
    return `${a.getUTCDate()} ${MONTH_SHORT[a.getUTCMonth()]} – ${b.getUTCDate()} ${MONTH_SHORT[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }
  if (agg === "monthly") {
    const [y, m] = key.split("-").map(Number) as [number, number];
    return `${MONTH_SHORT[m - 1]} ${y}`;
  }
  if (agg === "quarterly") return key.replace("-", " ");
  return key;
}

/**
 * Aggregate a sorted daily series. Empty input → []. Cumulative is the running
 * sum of bucket nets (not source cumulative, so partial windows stay honest).
 */
export function aggregateFlows(days: EtfDay[], agg: EtfAgg): EtfBucket[] {
  if (!days.length) return [];
  if (agg === "daily") {
    let cum = 0;
    return days.map((d) => {
      cum += d.netFlowUsd;
      return {
        key: d.date,
        label: bucketLabel("daily", d.date, d.date, d.date),
        startDate: d.date,
        endDate: d.date,
        netFlowUsd: d.netFlowUsd,
        cumulativeUsd: cum,
      };
    });
  }

  const map = new Map<
    string,
    { start: string; end: string; net: number }
  >();
  for (const d of days) {
    const meta =
      agg === "weekly"
        ? isoWeekKey(d.date)
        : agg === "monthly"
          ? monthKey(d.date)
          : agg === "quarterly"
            ? quarterKey(d.date)
            : yearKey(d.date);
    const prev = map.get(meta.key);
    if (!prev) {
      map.set(meta.key, { start: meta.start, end: meta.end, net: d.netFlowUsd });
    } else {
      prev.net += d.netFlowUsd;
      if (d.date < prev.start) prev.start = d.date;
      if (d.date > prev.end) prev.end = d.date;
    }
  }

  const keys = [...map.keys()].sort();
  let cum = 0;
  return keys.map((key) => {
    const b = map.get(key)!;
    cum += b.net;
    return {
      key,
      label: bucketLabel(agg, key, b.start, b.end),
      startDate: b.start,
      endDate: b.end,
      netFlowUsd: b.net,
      cumulativeUsd: cum,
    };
  });
}

export function fmtFlowUsd(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const mag =
    abs >= 1e9
      ? `$${(abs / 1e9).toFixed(digits)}B`
      : abs >= 1e6
        ? `$${(abs / 1e6).toFixed(digits)}M`
        : abs >= 1e3
          ? `$${(abs / 1e3).toFixed(digits)}K`
          : `$${abs.toFixed(0)}`;
  return `${sign}${mag}`;
}

export function flowColor(n: number): string {
  if (n > 0) return "#3dcc9a";
  if (n < 0) return "#ef6b6b";
  return "#8b95a8";
}

/** Recent monthly buckets for hub tile bars (oldest → newest). */
export function recentMonthlyBars(days: EtfDay[], maxMonths = 12): EtfBucket[] {
  const months = aggregateFlows(days, "monthly");
  return months.slice(-maxMonths);
}
