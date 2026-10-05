/**
 * US spot crypto ETF net flows (daily USD).
 *
 * BTC / ETH: Farside Investors all-data HTML tables (US$m totals → USD).
 * SOL: Farside /sol/ table (US$m; shorter history — no all-data page yet).
 * ZCSH: public ZecZcash CSV export (SoSoValue-backed settled daily flows).
 *
 * Order: live scrape → last-good in-memory cache → dated snapshot.
 * Never invents figures. ZCSH may return status "pending" if scrape fails.
 * Educational · NFA.
 */

import snapshot from "@/data/etf-flows-snapshot.json";
import {
  ETF_ASSETS,
  type EtfAssetId,
  type EtfAssetSeries,
  type EtfDay,
  type EtfFlowsPayload,
} from "@/lib/etfFlows";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindin.finance)";
const FETCH_MS = 18_000;

const FARSIDE: Record<
  Exclude<EtfAssetId, "zcsh">,
  { url: string; label: string; source: string }
> = {
  btc: {
    url: "https://farside.co.uk/bitcoin-etf-flow-all-data/",
    label: "Bitcoin",
    source: "Farside Investors (US spot Bitcoin ETF flow, US$m totals)",
  },
  eth: {
    url: "https://farside.co.uk/ethereum-etf-flow-all-data/",
    label: "Ethereum",
    source: "Farside Investors (US spot Ethereum ETF flow, US$m totals)",
  },
  sol: {
    url: "https://farside.co.uk/sol/",
    label: "Solana",
    source: "Farside Investors (US spot Solana ETF flow, US$m totals)",
  },
};

const ZCSH_CSV = "https://zeczcash.com/etf/zcsh/export.csv";
const ZCSH_PAGE = "https://zeczcash.com/etf/zcsh";

type SnapAsset = {
  label: string;
  source: string;
  sourceUrl: string;
  status: string;
  firstDate: string | null;
  lastDate: string | null;
  days: EtfDay[];
};
type Snapshot = {
  asOf: string;
  unit: string;
  assets: Record<EtfAssetId, SnapAsset>;
};
const SNAP = snapshot as unknown as Snapshot;

const lastGood: Partial<Record<EtfAssetId, EtfAssetSeries>> = {};

const MONTHS: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\u00a0/g, " ").trim();
}

function parseFarsideNum(raw: string): number | null {
  const s = stripTags(raw).replace(/,/g, "");
  if (!s || s === "-" || s === "–") return null;
  const neg = s.startsWith("(") && s.endsWith(")");
  const body = neg ? s.slice(1, -1) : s;
  const v = Number(body);
  if (!Number.isFinite(v)) return null;
  return neg ? -v : v;
}

function parseFarsideDate(raw: string): string | null {
  const s = stripTags(raw);
  const m = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(s);
  if (!m) return null;
  const mon = MONTHS[m[2]!];
  if (!mon) return null;
  const d = Number(m[1]);
  const y = Number(m[3]);
  if (!Number.isFinite(d) || !Number.isFinite(y)) return null;
  return `${y}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parse Farside table.etf rows → daily net flow in USD (from US$m Total column). */
function parseFarsideHtml(html: string): EtfDay[] {
  const by = new Map<string, number>();
  const re =
    /<tr>\s*<td><span class="tabletext">([^<]*)<\/span><\/td>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const date = parseFarsideDate(match[1] ?? "");
    if (!date) continue;
    const cells = [
      ...(match[2] ?? "").matchAll(/<span class="tabletext">([\s\S]*?)<\/span>/gi),
    ].map((c) => c[1] ?? "");
    if (!cells.length) continue;
    const totalM = parseFarsideNum(cells[cells.length - 1]!);
    if (totalM == null) continue;
    by.set(date, Math.round(totalM * 1_000_000 * 100) / 100);
  }
  return [...by.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, netFlowUsd]) => ({ date, netFlowUsd }));
}

/** Parse ZecZcash CSV (SoSoValue-backed). net_inflow_usd column. */
function parseZcshCsv(text: string): EtfDay[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("settlement_date");
  const netIdx = header.indexOf("net_inflow_usd");
  if (dateIdx < 0 || netIdx < 0) return [];
  const by = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",");
    const date = (cols[dateIdx] ?? "").trim();
    const net = Number((cols[netIdx] ?? "").trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(net)) continue;
    by.set(date, net);
  }
  return [...by.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, netFlowUsd]) => ({ date, netFlowUsd }));
}

function seriesFromDays(
  days: EtfDay[],
  meta: { label: string; source: string; sourceUrl: string },
  snapshot = false,
): EtfAssetSeries {
  return {
    label: meta.label,
    source: meta.source,
    sourceUrl: meta.sourceUrl,
    status: days.length ? "ok" : "error",
    firstDate: days[0]?.date ?? null,
    lastDate: days[days.length - 1]?.date ?? null,
    days,
    snapshot: snapshot || undefined,
  };
}

function fromSnapshot(id: EtfAssetId): EtfAssetSeries {
  const s = SNAP.assets[id];
  const days = Array.isArray(s?.days) ? s.days : [];
  return {
    label: s?.label ?? id,
    source: s?.source ?? "Dated snapshot",
    sourceUrl: s?.sourceUrl ?? "",
    status: days.length ? "ok" : "pending",
    pendingReason: days.length
      ? undefined
      : "No snapshot rows for this asset",
    firstDate: s?.firstDate ?? days[0]?.date ?? null,
    lastDate: s?.lastDate ?? days[days.length - 1]?.date ?? null,
    days,
    snapshot: true,
  };
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "text/html,text/csv,*/*",
        "User-Agent": UA,
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadFarside(
  id: Exclude<EtfAssetId, "zcsh">,
  errors: string[],
): Promise<EtfAssetSeries> {
  const meta = FARSIDE[id];
  try {
    const html = await fetchText(meta.url);
    const days = parseFarsideHtml(html);
    if (!days.length) throw new Error(`No flow rows parsed from ${meta.url}`);
    const series = seriesFromDays(days, {
      label: meta.label,
      source: meta.source,
      sourceUrl: meta.url,
    });
    lastGood[id] = series;
    return series;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`${id}: ${msg}`);
    if (lastGood[id]) return { ...lastGood[id]!, snapshot: true };
    return fromSnapshot(id);
  }
}

async function loadZcsh(errors: string[]): Promise<EtfAssetSeries> {
  const meta = {
    label: "Zcash (ZCSH)",
    source: "ZecZcash export (SoSoValue-backed settled daily flows)",
    sourceUrl: ZCSH_PAGE,
  };
  try {
    const csv = await fetchText(ZCSH_CSV);
    const days = parseZcshCsv(csv);
    if (!days.length) throw new Error("ZCSH CSV parsed empty");
    const series = seriesFromDays(days, meta);
    lastGood.zcsh = series;
    return series;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`zcsh: ${msg}`);
    if (lastGood.zcsh) return { ...lastGood.zcsh, snapshot: true };
    const snap = fromSnapshot("zcsh");
    if (snap.days.length) return snap;
    return {
      label: meta.label,
      source: meta.source,
      sourceUrl: meta.sourceUrl,
      status: "pending",
      pendingReason:
        "ZCSH source pending — public SoSoValue-backed feed unavailable; figures not invented",
      firstDate: null,
      lastDate: null,
      days: [],
    };
  }
}

export async function GET() {
  const errors: string[] = [];
  const [btc, eth, sol, zcsh] = await Promise.all([
    loadFarside("btc", errors),
    loadFarside("eth", errors),
    loadFarside("sol", errors),
    loadZcsh(errors),
  ]);

  const assets: Record<EtfAssetId, EtfAssetSeries> = { btc, eth, sol, zcsh };
  const anyOk = ETF_ASSETS.some(
    (id) => assets[id].status === "ok" && assets[id].days.length > 0,
  );

  const asOf =
    ETF_ASSETS.map((id) => assets[id].lastDate)
      .filter(Boolean)
      .sort()
      .at(-1) ?? SNAP.asOf;

  const payload: EtfFlowsPayload = {
    ok: anyOk,
    asOf,
    unit: "USD",
    assets,
    errors: errors.length ? errors : undefined,
    disclaimer:
      "US spot crypto ETF net flows from public tables. Educational framing only — not financial advice (NFA).",
  };

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
