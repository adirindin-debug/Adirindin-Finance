// Builds src/data/global-liquidity-snapshot.json (month-end values) from FRED CSVs.
// Run: node scripts/build-global-liquidity-snapshot.mjs
import { writeFileSync } from "fs";
const IDS = ["WALCL", "WTREGEN", "RRPONTSYD", "ECBASSETSW", "DEXUSEU", "M2SL"];
const out = { fetched: new Date().toISOString(), series: {}, lastObs: {} };
for (const id of IDS) {
  const t = await (await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`)).text();
  const m = new Map();
  let lastD = "";
  for (const line of t.trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(",");
    if (!v || v === "." || !Number.isFinite(Number(v))) continue;
    m.set(d.slice(0, 7), Number(v));
    lastD = d;
  }
  out.series[id] = [...m.entries()].filter(([d]) => d >= "2002-01");
  out.lastObs[id] = lastD;
}
writeFileSync("src/data/global-liquidity-snapshot.json", JSON.stringify(out));
console.log(out.lastObs);
