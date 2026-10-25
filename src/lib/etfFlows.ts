/**
 * US spot crypto ETF net creations / redemptions — QUARTERLY, from SEC EDGAR only.
 * Each trust's 10-Q / 10-K XBRL (data.sec.gov companyfacts) reports the US$ value of
 * shares created and redeemed in the period (statement of changes in net assets).
 * Net = creations − redemptions. Public US-government data; no permission needed.
 * Educational · never invent figures — a fund/quarter we can't derive is omitted and listed.
 */

export type EtfAssetId = "btc" | "eth" | "sol";
export type EtfViewId = "total" | EtfAssetId;
export type EtfAgg = "quarterly" | "yearly";

export type EtfFundQuarter = {
  /** e.g. "2025Q3" */
  q: string;
  /** Quarter end date (ISO) */
  end: string;
  netUsd: number;
  createdUsd?: number;
  redeemedUsd?: number;
};

export type EtfFund = {
  ticker: string;
  name: string;
  asset: EtfAssetId;
  cik: number;
  quarters: EtfFundQuarter[];
  /** Filing URL for the trust (EDGAR browse). */
  url: string;
  snapshot?: boolean;
};

export type EtfOmitted = { ticker: string; name: string; asset: EtfAssetId; reason: string };

export type EtfFlowsPayload = {
  ok: boolean;
  asOf: string;
  unit: "USD";
  frequency: "quarterly";
  source: string;
  sourceUrl: string;
  funds: EtfFund[];
  omitted: EtfOmitted[];
  snapshot?: boolean;
  errors?: string[];
};

export type EtfBucket = {
  key: string;
  label: string;
  netFlowUsd: number;
  cumulativeUsd: number;
  /** Funds contributing a figure to this bucket. */
  funds: number;
};

export const ETF_ASSETS: EtfAssetId[] = ["btc", "eth", "sol"];
export const ETF_VIEWS: EtfViewId[] = ["total", "btc", "eth", "sol"];

export const ETF_ASSET_META: Record<EtfViewId, { label: string; short: string; color: string }> = {
  total: { label: "Total (all crypto ETFs)", short: "Total", color: "#9eb0c8" },
  btc: { label: "Bitcoin", short: "BTC", color: "#f7931a" },
  eth: { label: "Ethereum", short: "ETH", color: "#627eea" },
  sol: { label: "Solana", short: "SOL", color: "#14f195" },
};

export const ETF_AGGS: { key: EtfAgg; label: string }[] = [
  { key: "quarterly", label: "Quarterly" },
  { key: "yearly", label: "Yearly" },
];

export const SEC_SOURCE_URL = "https://www.sec.gov/edgar/search/";

export function isEtfView(v: string): v is EtfViewId {
  return (ETF_VIEWS as string[]).includes(v);
}

export function quarterLabel(q: string): string {
  return `Q${q.slice(5)} ${q.slice(0, 4)}`;
}

/** Sum fund quarters for a view into quarterly (or yearly) buckets, oldest → newest. */
export function bucketsForView(payload: EtfFlowsPayload, view: EtfViewId, agg: EtfAgg = "quarterly"): EtfBucket[] {
  const m = new Map<string, { net: number; funds: Set<string> }>();
  for (const f of payload.funds ?? []) {
    if (view !== "total" && f.asset !== view) continue;
    for (const q of f.quarters) {
      const key = agg === "yearly" ? q.q.slice(0, 4) : q.q;
      const b = m.get(key) ?? { net: 0, funds: new Set<string>() };
      b.net += q.netUsd;
      b.funds.add(f.ticker);
      m.set(key, b);
    }
  }
  let cum = 0;
  return [...m.keys()].sort().map((key) => {
    const b = m.get(key)!;
    cum += b.net;
    return {
      key,
      label: agg === "yearly" ? key : quarterLabel(key),
      netFlowUsd: b.net,
      cumulativeUsd: cum,
      funds: b.funds.size,
    };
  });
}

export function fundsForView(payload: EtfFlowsPayload, view: EtfViewId): EtfFund[] {
  return (payload.funds ?? []).filter((f) => view === "total" || f.asset === view);
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
