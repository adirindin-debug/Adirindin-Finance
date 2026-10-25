// Regenerate src/data/etf-flows-sec-snapshot.json from SEC EDGAR companyfacts.
// Run: npx tsx scripts/build-etf-sec-snapshot.mts
import { writeFileSync } from "node:fs";
import { buildSecPayloadParts } from "../src/lib/etfFlowsSec";
const p = await buildSecPayloadParts();
if (p.failed.length) throw new Error(`fetch failed: ${p.failed.map((f) => f.ticker).join(", ")}`);
const asOf = new Date().toISOString().slice(0, 10);
writeFileSync(
  new URL("../src/data/etf-flows-sec-snapshot.json", import.meta.url),
  JSON.stringify({ asOf, funds: p.funds, omitted: p.omitted }, null, 0) + "\n",
);
console.log(asOf, p.funds.length, "funds", p.omitted.length, "omitted");
