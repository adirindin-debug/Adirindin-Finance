/**
 * Server-side: derive quarterly net creations/redemptions per US spot crypto ETF trust
 * from SEC EDGAR XBRL companyfacts (https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json).
 * SEC: "Information presented on www.sec.gov is considered public information and may be
 * copied or further distributed by users of the web site without the SEC's permission."
 */
import type { EtfAssetId, EtfFund, EtfFundQuarter, EtfOmitted } from "@/lib/etfFlows";

export const SEC_UA = "AdirindinFinance/1.0 research (contact: admin@adirindinfinance.com)";

export const SEC_FUNDS: { ticker: string; name: string; asset: EtfAssetId; cik: number }[] = [
  { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", asset: "btc", cik: 1980994 },
  { ticker: "FBTC", name: "Fidelity Wise Origin Bitcoin Fund", asset: "btc", cik: 1852317 },
  { ticker: "GBTC", name: "Grayscale Bitcoin Trust ETF", asset: "btc", cik: 1588489 },
  { ticker: "BTC", name: "Grayscale Bitcoin Mini Trust ETF", asset: "btc", cik: 2015034 },
  { ticker: "ARKB", name: "ARK 21Shares Bitcoin ETF", asset: "btc", cik: 1869699 },
  { ticker: "BITB", name: "Bitwise Bitcoin ETF", asset: "btc", cik: 1763415 },
  { ticker: "HODL", name: "VanEck Bitcoin ETF", asset: "btc", cik: 1838028 },
  { ticker: "BRRR", name: "CoinShares Bitcoin ETF", asset: "btc", cik: 1841175 },
  { ticker: "EZBC", name: "Franklin Bitcoin ETF", asset: "btc", cik: 1992870 },
  { ticker: "BTCO", name: "Invesco Galaxy Bitcoin ETF", asset: "btc", cik: 1855781 },
  { ticker: "BTCW", name: "WisdomTree Bitcoin Fund", asset: "btc", cik: 1850391 },
  { ticker: "MSBT", name: "Morgan Stanley Bitcoin Trust", asset: "btc", cik: 2103612 },
  { ticker: "ETHA", name: "iShares Ethereum Trust ETF", asset: "eth", cik: 2000638 },
  { ticker: "FETH", name: "Fidelity Ethereum Fund", asset: "eth", cik: 2000046 },
  { ticker: "ETHE", name: "Grayscale Ethereum Staking ETF", asset: "eth", cik: 1725210 },
  { ticker: "ETH", name: "Grayscale Ethereum Staking Mini ETF", asset: "eth", cik: 2020455 },
  { ticker: "ETHW", name: "Bitwise Ethereum ETF", asset: "eth", cik: 2013744 },
  { ticker: "ETHV", name: "VanEck Ethereum ETF", asset: "eth", cik: 1860788 },
  { ticker: "QETH", name: "Invesco Galaxy Ethereum ETF", asset: "eth", cik: 1995569 },
  { ticker: "EZET", name: "Franklin Ethereum Trust", asset: "eth", cik: 2011535 },
  { ticker: "TETH", name: "21Shares Ethereum ETF", asset: "eth", cik: 1992508 },
  { ticker: "BSOL", name: "Bitwise Solana Staking ETF", asset: "sol", cik: 2045872 },
  { ticker: "GSOL", name: "Grayscale Solana Staking ETF", asset: "sol", cik: 1896677 },
  { ticker: "SOEZ", name: "Franklin Solana Trust", asset: "sol", cik: 2057388 },
  { ticker: "FSOL", name: "Fidelity Solana Fund", asset: "sol", cik: 2063380 },
  { ticker: "VSOL", name: "VanEck Solana ETF", asset: "sol", cik: 2028541 },
  { ticker: "TSOL", name: "21Shares Solana ETF", asset: "sol", cik: 2028834 },
];

/** First quarter shown: US spot BTC ETFs launched 11 Jan 2024. */
const FIRST_Q = "2024Q1";
/** First quarter as a US spot ETF (earlier quarters are seed capital or pre-conversion trust activity). */
const FROM_Q: Record<string, string> = {
  BTC: "2024Q3", ETHA: "2024Q3", FETH: "2024Q3", ETHE: "2024Q3", ETH: "2024Q3", ETHW: "2024Q3",
  ETHV: "2024Q3", QETH: "2024Q3", EZET: "2024Q3", TETH: "2024Q3",
  BSOL: "2025Q4", GSOL: "2025Q4", SOEZ: "2025Q4", FSOL: "2025Q4", VSOL: "2025Q4", TSOL: "2025Q4",
};

// Partnership-style tags first (Bitwise also tags a small, unrelated StockIssued… value).
const CREATE = [
  "PartnersCapitalAccountSaleOfUnits",
  "TemporaryEquityStockIssuedDuringPeriodValueNewIssues",
  "StockIssuedDuringPeriodValueNewIssues",
];
const REDEEM = [
  "PartnersCapitalAccountRedemptions",
  "TemporaryEquityStockRedeemedDuringPeriodValue",
  "StockRedeemedOrCalledDuringPeriodValue",
];
/** Reported net change from capital-share transactions (creations − redemptions). */
const NET = ["TemporaryEquityIssuePeriodIncreaseOrDecrease"];

type Fact = { start?: string; end: string; val: number; filed: string; form: string };
type CompanyFacts = { facts?: Record<string, Record<string, { units?: Record<string, Fact[]> }>> };

const DAY = 86400_000;
const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

function isQuarterEnd(iso: string): boolean {
  return ["03-31", "06-30", "09-30", "12-31"].includes(iso.slice(5));
}
function qKey(end: string): string {
  return `${end.slice(0, 4)}Q${Math.ceil(Number(end.slice(5, 7)) / 3)}`;
}
function prevQuarterEnd(end: string): string {
  const y = Number(end.slice(0, 4));
  const m = end.slice(5, 7);
  return m === "03" ? `${y - 1}-12-31` : m === "06" ? `${y}-03-31` : m === "09" ? `${y}-06-30` : `${y}-09-30`;
}

/** Quarterly values (keyed by quarter end) for the first concept present, from 3-month facts or YTD differences. */
function quarterly(cf: CompanyFacts, names: string[]): Map<string, number> | null {
  const g = cf.facts?.["us-gaap"] ?? {};
  for (const n of names) {
    const facts = g[n]?.units?.USD?.filter((f) => f.start && (f.form.startsWith("10-Q") || f.form.startsWith("10-K")));
    if (!facts?.length) continue;
    // latest filed value per (start,end)
    const by = new Map<string, Fact>();
    for (const f of facts) {
      const k = `${f.start}|${f.end}`;
      const cur = by.get(k);
      if (!cur || f.filed > cur.filed) by.set(k, f);
    }
    const out = new Map<string, number>();
    const vals = [...by.values()];
    const sv = (f: Fact) => (n === NET[0] ? f.val : Math.abs(f.val));
    const ends = [...new Set(vals.map((f) => f.end).filter(isQuarterEnd))].sort();
    // Cumulative from start S to quarter end E, using a fact or (earlier) derived quarters.
    const cum = (S: string, E: string): number | undefined => {
      const f = by.get(`${S}|${E}`);
      if (f) return sv(f);
      if (t(E) <= t(S)) return 0;
      const q = out.get(E);
      if (q == null) return undefined;
      const prev = cum(S, prevQuarterEnd(E));
      return prev == null ? undefined : prev + q;
    };
    for (const end of ends) {
      const same = vals.filter((f) => f.end === end);
      const direct = same.find((f) => t(end) - t(f.start!) <= 100 * DAY);
      if (direct) {
        out.set(end, sv(direct));
        continue;
      }
      for (const f of same) {
        const prev = cum(f.start!, prevQuarterEnd(end));
        if (prev != null) {
          out.set(end, sv(f) - prev);
          break;
        }
      }
    }
    if (out.size) return out;
  }
  return null;
}

export function deriveFund(
  meta: (typeof SEC_FUNDS)[number],
  cf: CompanyFacts,
): { fund: EtfFund | null; reason?: string } {
  const c = quarterly(cf, CREATE);
  const r = quarterly(cf, REDEEM);
  const net = quarterly(cf, NET);
  const ends = new Set<string>([...(net?.keys() ?? []), ...(c && r ? [...c.keys()].filter((e) => r.has(e)) : [])]);
  const quarters: EtfFundQuarter[] = [];
  for (const end of [...ends].sort()) {
    const q = qKey(end);
    if (q < (FROM_Q[meta.ticker] ?? FIRST_Q)) continue;
    const cv = c?.get(end);
    const rv = r?.get(end);
    const nv = net?.get(end) ?? (cv != null && rv != null ? cv - rv : undefined);
    if (nv == null || !Number.isFinite(nv)) continue;
    quarters.push({ q, end, netUsd: nv, ...(cv != null ? { createdUsd: cv } : {}), ...(rv != null ? { redeemedUsd: rv } : {}) });
  }
  if (!quarters.length) {
    const reason = !c && !r && !net
      ? "no creation/redemption values tagged in XBRL"
      : !net && (!c || !r)
        ? `only ${c ? "creations" : "redemptions"} tagged in XBRL — net can't be derived`
        : "no usable creation/redemption values in XBRL for Q1 2024 onwards";
    return { fund: null, reason };
  }
  return {
    fund: {
      ticker: meta.ticker,
      name: meta.name,
      asset: meta.asset,
      cik: meta.cik,
      quarters,
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${meta.cik}&type=10-&dateb=&owner=include&count=40`,
    },
  };
}

export async function fetchCompanyFacts(cik: number): Promise<CompanyFacts> {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, "0")}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": SEC_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 43_200 },
  });
  if (res.status === 404) return {};
  if (!res.ok) throw new Error(`EDGAR CIK ${cik} HTTP ${res.status}`);
  return (await res.json()) as CompanyFacts;
}

export async function buildSecPayloadParts(): Promise<{
  funds: EtfFund[];
  omitted: EtfOmitted[];
  failed: (typeof SEC_FUNDS)[number][];
}> {
  const funds: EtfFund[] = [];
  const omitted: EtfOmitted[] = [];
  const failed: (typeof SEC_FUNDS)[number][] = [];
  // EDGAR fair access: ≤10 req/s — small batches.
  for (let i = 0; i < SEC_FUNDS.length; i += 5) {
    const batch = SEC_FUNDS.slice(i, i + 5);
    const res = await Promise.allSettled(batch.map((m) => fetchCompanyFacts(m.cik)));
    res.forEach((r, j) => {
      const m = batch[j]!;
      if (r.status === "rejected") return failed.push(m);
      const d = deriveFund(m, r.value);
      if (d.fund) funds.push(d.fund);
      else omitted.push({ ticker: m.ticker, name: m.name, asset: m.asset, reason: d.reason ?? "not derivable" });
    });
  }
  return { funds, omitted, failed };
}
