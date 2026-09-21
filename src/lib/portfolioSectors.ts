/**
 * Best-effort sector classification for portfolio allocation.
 * Local map (GICS-ish / TradingView-style buckets) — no scraped login required.
 * Unknown securities → Other; cash / collectables stay in honest buckets.
 */

import type { HoldingLive } from "./portfolioTypes";

export type SectorId =
  | "technology"
  | "financials"
  | "consumer_discretionary"
  | "consumer_staples"
  | "energy"
  | "healthcare"
  | "industrials"
  | "materials"
  | "real_estate"
  | "communication"
  | "utilities"
  | "digital_assets"
  | "cash"
  | "collectables"
  | "other";

export type SectorMeta = {
  id: SectorId;
  label: string;
  color: string;
};

export const SECTOR_META: Record<SectorId, SectorMeta> = {
  technology: { id: "technology", label: "Technology", color: "#60a5fa" },
  financials: { id: "financials", label: "Financials", color: "#4ade80" },
  consumer_discretionary: {
    id: "consumer_discretionary",
    label: "Consumer discretionary",
    color: "#f472b6",
  },
  consumer_staples: {
    id: "consumer_staples",
    label: "Consumer staples",
    color: "#fbbf24",
  },
  energy: { id: "energy", label: "Energy", color: "#fb923c" },
  healthcare: { id: "healthcare", label: "Healthcare", color: "#34d399" },
  industrials: { id: "industrials", label: "Industrials", color: "#a78bfa" },
  materials: { id: "materials", label: "Materials", color: "#c084fc" },
  real_estate: { id: "real_estate", label: "Real estate", color: "#38bdf8" },
  communication: {
    id: "communication",
    label: "Communication services",
    color: "#e879f9",
  },
  utilities: { id: "utilities", label: "Utilities", color: "#2dd4bf" },
  digital_assets: {
    id: "digital_assets",
    label: "Digital assets",
    color: "#f59e0b",
  },
  cash: { id: "cash", label: "Cash", color: "#71717a" },
  collectables: {
    id: "collectables",
    label: "Collectables",
    color: "#d4d4d8",
  },
  other: { id: "other", label: "Other", color: "#a1a1aa" },
};

/** Ticker → sector (uppercased keys; .AX ASX and US common names). */
const TICKER_SECTOR: Record<string, SectorId> = {
  // AU banks / financials
  "CBA.AX": "financials",
  "NAB.AX": "financials",
  "WBC.AX": "financials",
  "ANZ.AX": "financials",
  "MQG.AX": "financials",
  "QBE.AX": "financials",
  "IAG.AX": "financials",
  "SOL.AX": "financials",
  JPM: "financials",
  BAC: "financials",
  WFC: "financials",
  GS: "financials",
  MS: "financials",
  V: "financials",
  MA: "financials",
  BRK: "financials",
  "BRK-B": "financials",
  "BRK.B": "financials",
  SCHW: "financials",
  AXS: "financials",
  // AU miners / materials
  "BHP.AX": "materials",
  "RIO.AX": "materials",
  "FMG.AX": "materials",
  "NCM.AX": "materials",
  "S32.AX": "materials",
  "MIN.AX": "materials",
  "PLS.AX": "materials",
  "LYC.AX": "materials",
  FCX: "materials",
  NEM: "materials",
  GOLD: "materials",
  // Energy
  "WDS.AX": "energy",
  "STO.AX": "energy",
  "ORG.AX": "energy",
  XOM: "energy",
  CVX: "energy",
  COP: "energy",
  OXY: "energy",
  BP: "energy",
  SHEL: "energy",
  // Healthcare
  "CSL.AX": "healthcare",
  "COH.AX": "healthcare",
  "RMD.AX": "healthcare",
  "SHL.AX": "healthcare",
  JNJ: "healthcare",
  UNH: "healthcare",
  LLY: "healthcare",
  PFE: "healthcare",
  ABBV: "healthcare",
  MRK: "healthcare",
  TMO: "healthcare",
  // Technology
  "XRO.AX": "technology",
  "WTC.AX": "technology",
  "APT.AX": "technology",
  "CPU.AX": "technology",
  AAPL: "technology",
  MSFT: "technology",
  GOOGL: "technology",
  GOOG: "technology",
  AMZN: "consumer_discretionary",
  META: "communication",
  NVDA: "technology",
  AMD: "technology",
  AVGO: "technology",
  ORCL: "technology",
  CRM: "technology",
  ADBE: "technology",
  CSCO: "technology",
  INTC: "technology",
  IBM: "technology",
  TSLA: "consumer_discretionary",
  MSTR: "technology", // MicroStrategy — software / BTC treasury (TV often Tech)
  COIN: "financials",
  SQ: "technology",
  XYZ: "technology", // Block Inc.
  SHOP: "technology",
  NET: "technology",
  SNOW: "technology",
  PLTR: "technology",
  // Consumer
  "WOW.AX": "consumer_staples",
  "COL.AX": "consumer_staples",
  "WES.AX": "consumer_staples",
  "JBH.AX": "consumer_discretionary",
  "HVN.AX": "consumer_discretionary",
  "ALL.AX": "consumer_discretionary",
  WMT: "consumer_staples",
  COST: "consumer_staples",
  PG: "consumer_staples",
  KO: "consumer_staples",
  PEP: "consumer_staples",
  MCD: "consumer_discretionary",
  NKE: "consumer_discretionary",
  SBUX: "consumer_discretionary",
  HD: "consumer_discretionary",
  DIS: "communication",
  NFLX: "communication",
  // Industrials / transport / utilities / RE
  "TLS.AX": "communication",
  "TCL.AX": "industrials",
  "QAN.AX": "industrials",
  "BXB.AX": "industrials",
  "SYD.AX": "industrials",
  "GMG.AX": "real_estate",
  "SCG.AX": "real_estate",
  "DXS.AX": "real_estate",
  "GPT.AX": "real_estate",
  "MGR.AX": "real_estate",
  "VCX.AX": "real_estate",
  "APA.AX": "utilities",
  "AGL.AX": "utilities",
  CAT: "industrials",
  BA: "industrials",
  HON: "industrials",
  GE: "industrials",
  UPS: "industrials",
  NEE: "utilities",
  DUK: "utilities",
  AMT: "real_estate",
  PLD: "real_estate",
  O: "real_estate",
  // ETFs — map by underlying theme where known
  QQQ: "technology",
  SPY: "other",
  VOO: "other",
  IVV: "other",
  VTI: "other",
  IWM: "other",
  DIA: "other",
  XLF: "financials",
  XLK: "technology",
  XLE: "energy",
  XLV: "healthcare",
  XLI: "industrials",
  XLP: "consumer_staples",
  XLY: "consumer_discretionary",
  XLU: "utilities",
  XLRE: "real_estate",
  XLB: "materials",
  XLC: "communication",
  ARKK: "technology",
  BOTZ: "technology",
  HACK: "technology",
  VNQ: "real_estate",
  GLD: "materials",
  IAU: "materials",
  SLV: "materials",
  "VAS.AX": "other",
  "STW.AX": "other",
  "IOZ.AX": "other",
  "NDQ.AX": "technology",
  "IVV.AX": "other",
  "VGS.AX": "other",
  "BBOZ.AX": "other",
  "A200.AX": "other",
  "ETHI.AX": "other",
  "RARI.AX": "other",
  "GOLD.AX": "materials",
  "PMGOLD.AX": "materials",
  // Crypto (Yahoo *-USD and common aliases)
  "BTC-USD": "digital_assets",
  BTC: "digital_assets",
  BITCOIN: "digital_assets",
  "ETH-USD": "digital_assets",
  ETH: "digital_assets",
  "SOL-USD": "digital_assets",
  SOL: "digital_assets",
  "XRP-USD": "digital_assets",
  XRP: "digital_assets",
  "ADA-USD": "digital_assets",
  "DOGE-USD": "digital_assets",
  "AVAX-USD": "digital_assets",
  "DOT-USD": "digital_assets",
  "LINK-USD": "digital_assets",
  "BNB-USD": "digital_assets",
  "MATIC-USD": "digital_assets",
  "ATOM-USD": "digital_assets",
  "LTC-USD": "digital_assets",
  "BCH-USD": "digital_assets",
  "USDT-USD": "digital_assets",
  "USDC-USD": "digital_assets",
  GBTC: "digital_assets",
  ETHE: "digital_assets",
  BITB: "digital_assets",
  IBIT: "digital_assets",
  FBTC: "digital_assets",
  ARKB: "digital_assets",
};

/** Heuristic extras when ticker not in the static map. */
function inferSectorHeuristic(ticker: string): SectorId {
  const t = ticker.toUpperCase();
  if (
    t.endsWith("-USD") ||
    t.endsWith("-AUD") ||
    /^(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|AVAX|DOT|LINK|LTC|BCH|MATIC|ATOM)(-|$)/.test(
      t,
    )
  ) {
    return "digital_assets";
  }
  return "other";
}

export function sectorForHolding(h: {
  kind: string;
  ticker: string;
}): SectorId {
  if (h.kind === "collectable") return "collectables";
  const t = h.ticker.trim().toUpperCase();
  return TICKER_SECTOR[t] ?? inferSectorHeuristic(t);
}

export type SectorSlice = {
  id: string;
  sectorId: SectorId;
  label: string;
  color: string;
  value: number;
  pct: number;
  start: number;
  holdingCount: number;
};

export function buildSectorSlices(
  holdings: HoldingLive[],
  cashAud: number,
): SectorSlice[] {
  const totals = new Map<
    SectorId,
    { value: number; count: number; color: string; label: string }
  >();

  const bump = (id: SectorId, value: number, count = 1) => {
    const meta = SECTOR_META[id];
    const cur = totals.get(id) ?? {
      value: 0,
      count: 0,
      color: meta.color,
      label: meta.label,
    };
    cur.value += value;
    cur.count += count;
    totals.set(id, cur);
  };

  for (const h of holdings) {
    const value = h.marketValueAud;
    if (value == null || !(value > 0)) continue;
    bump(sectorForHolding(h), value, 1);
  }

  const cash = cashAud > 0 ? cashAud : 0;
  if (cash > 0) bump("cash", cash, 1);

  const total = [...totals.values()].reduce((s, x) => s + x.value, 0);
  if (total <= 0) return [];

  // Stable-ish order: largest first, Cash/Other/Collectables last among ties via label sort.
  const ordered = [...totals.entries()].sort((a, b) => {
    if (b[1].value !== a[1].value) return b[1].value - a[1].value;
    return a[1].label.localeCompare(b[1].label);
  });

  let start = 0;
  return ordered.map(([sectorId, row]) => {
    const pct = (row.value / total) * 100;
    const slice: SectorSlice = {
      id: `sector:${sectorId}`,
      sectorId,
      label: row.label,
      color: row.color,
      value: row.value,
      pct,
      start,
      holdingCount: row.count,
    };
    start += pct;
    return slice;
  });
}
