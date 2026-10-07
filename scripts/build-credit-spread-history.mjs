/**
 * Build src/data/credit-spread-history.json — the static monthly reference
 * history for the gauge's credit spreads input (Jan 1925 → Dec 1985), before
 * FRED's daily BAA10Y series begins (2 Jan 1986).
 *
 *   spread = Moody's Seasoned Baa Corporate Bond Yield (FRED BAA, monthly average)
 *            − long-term US Treasury yield (FRED LTGOVTBD to Mar 1953, GS10 from Apr 1953)
 *
 * From Jan 1986 the route uses monthly means of daily BAA10Y instead. History is
 * final (no revisions expected), so this file only needs rebuilding if FRED revises.
 *   node scripts/build-credit-spread-history.mjs
 * Educational only · NFA. Data: Moody's via FRED (Federal Reserve Bank of St. Louis).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/credit-spread-history.json");
const FRED_UA = "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";

async function fredMonthly(id) {
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, {
    headers: { "User-Agent": FRED_UA },
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`FRED ${id} HTTP ${r.status}`);
  const m = new Map();
  for (const line of (await r.text()).trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(",");
    const n = Number(v);
    if (d && v !== "." && Number.isFinite(n)) m.set(d.slice(0, 7), n);
  }
  return m;
}

const [baa, lt, gs10] = await Promise.all([fredMonthly("BAA"), fredMonthly("LTGOVTBD"), fredMonthly("GS10")]);
const months = [];
for (const [k, b] of [...baa.entries()].sort()) {
  if (k < "1925-01" || k > "1985-12") continue;
  const t = k <= "1953-03" ? lt.get(k) : gs10.get(k);
  if (t == null) continue;
  months.push([k, Math.round((b - t) * 100) / 100]);
}
if (months.length !== 732) throw new Error(`expected 732 months, got ${months.length}`);
writeFileSync(
  OUT,
  JSON.stringify({
    _note:
      "Monthly Moody's BAA minus long-term Treasury yield (pp), Jan 1925 – Dec 1985. Reference history for the credit spreads input before FRED BAA10Y daily (Jan 1986 →). Source: Moody's via FRED (BAA, LTGOVTBD to Mar 1953, GS10 after). Educational only · NFA.",
    built: new Date().toISOString(),
    months,
  }),
);
console.log(`wrote ${months.length} months → ${OUT} (first ${months[0]}, last ${months.at(-1)})`);
