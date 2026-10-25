/**
 * US spot crypto ETF net creations / redemptions — QUARTERLY, SEC EDGAR only.
 *
 * Live: data.sec.gov XBRL companyfacts per trust (10-Q / 10-K), with a declared User-Agent
 * per SEC fair-access policy. Fallback: dated snapshot (src/data/etf-flows-sec-snapshot.json)
 * per fund if EDGAR is unreachable. Never invents figures; non-derivable funds are listed.
 */
import snapshot from "@/data/etf-flows-sec-snapshot.json";
import { SEC_SOURCE_URL, type EtfFlowsPayload, type EtfFund, type EtfOmitted } from "@/lib/etfFlows";
import { buildSecPayloadParts } from "@/lib/etfFlowsSec";

export const runtime = "nodejs";
export const revalidate = 43200;
export const maxDuration = 30;

const snap = snapshot as unknown as { asOf: string; funds: EtfFund[]; omitted: EtfOmitted[] };

export async function GET() {
  let body: EtfFlowsPayload;
  try {
    const { funds, omitted, failed } = await buildSecPayloadParts();
    const errors: string[] = [];
    for (const m of failed) {
      const s = snap.funds.find((f) => f.cik === m.cik);
      if (s) {
        funds.push({ ...s, snapshot: true });
        errors.push(`${m.ticker}: EDGAR unreachable — stored copy (${snap.asOf})`);
      } else {
        const o = snap.omitted.find((f) => f.ticker === m.ticker);
        omitted.push(o ?? { ticker: m.ticker, name: m.name, asset: m.asset, reason: "EDGAR unreachable" });
      }
    }
    if (!funds.length) throw new Error("no funds");
    body = {
      ok: true,
      asOf: new Date().toISOString().slice(0, 10),
      unit: "USD",
      frequency: "quarterly",
      source: "SEC EDGAR (10-Q / 10-K XBRL)",
      sourceUrl: SEC_SOURCE_URL,
      funds,
      omitted,
      snapshot: failed.length === SEC_FUNDS_LEN ? true : undefined,
      errors: errors.length ? errors : undefined,
    };
  } catch (e) {
    body = {
      ok: true,
      asOf: snap.asOf,
      unit: "USD",
      frequency: "quarterly",
      source: "SEC EDGAR (10-Q / 10-K XBRL)",
      sourceUrl: SEC_SOURCE_URL,
      funds: snap.funds.map((f) => ({ ...f, snapshot: true })),
      omitted: snap.omitted,
      snapshot: true,
      errors: [`EDGAR live fetch failed (${e instanceof Error ? e.message : "error"}) — stored copy ${snap.asOf}`],
    };
  }
  return Response.json(body, {
    headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" },
  });
}

const SEC_FUNDS_LEN = 27;
