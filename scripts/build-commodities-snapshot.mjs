#!/usr/bin/env node
/**
 * Builds src/data/commodities-snapshot.json — the dated fallback for
 * /api/commodities when live sources fail. Same public sources as the live
 * route (gold has its own snapshot: src/data/gold-history-snapshot.json):
 *   silver SI=F / copper HG=F (Yahoo Finance daily closes)
 *   nickel PNICK / iron ore PIORECR / lithium PLITH (IMF PCPS monthly)
 * Usage: node scripts/build-commodities-snapshot.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA = "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const IMF_URL = "https://data.imf.org/en/datasets/IMF.RES:PCPS";

const round = (c) => (c >= 1000 ? Math.round(c * 100) / 100 : Math.round(c * 10000) / 10000);
const midMonth = (y, m) => Math.floor(Date.UTC(y, m - 1, 15, 12) / 1000);

async function text(url, accept) {
  const res = await fetch(url, { headers: { Accept: accept, "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function yahoo(symbol) {
  const p1 = Math.floor(Date.UTC(2000, 0, 1) / 1000);
  const p2 = Math.floor(Date.now() / 1000);
  const j = JSON.parse(
    await text(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${p1}&period2=${p2}`,
      "application/json",
    ),
  );
  const r = j.chart.result[0];
  const closes = r.indicators.quote[0].close;
  return r.timestamp
    .map((t, i) => ({ t, c: closes[i] }))
    .filter((p) => typeof p.c === "number" && p.c > 0)
    .map((p) => ({ t: p.t, c: round(p.c) }));
}

async function imf(code) {
  const csv = await text(
    `https://api.imf.org/external/sdmx/2.1/data/IMF.RES,PCPS/G001.${code}.USD.M?detail=dataonly`,
    "application/vnd.sdmx.data+csv;version=1.0.0",
  );
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0].split(",");
  const iT = head.indexOf("TIME_PERIOD");
  const iV = head.indexOf("OBS_VALUE");
  return lines
    .slice(1)
    .map((l) => l.split(","))
    .map((c) => ({ m: (c[iT] || "").match(/^(\d{4})-M(\d{2})$/), v: Number(c[iV]) }))
    .filter((x) => x.m && x.v > 0)
    .map((x) => ({ t: midMonth(Number(x.m[1]), Number(x.m[2])), c: round(x.v) }))
    .sort((a, b) => a.t - b.t);
}

const asOf = new Date().toISOString();
const base = (o) => ({ ...o, asOf });
const series = {
  silver: base({
    id: "silver", label: "Silver", unit: "USD/oz", frequency: "daily",
    source: "Yahoo Finance · SI=F (COMEX silver futures, front month)",
    sourceUrl: "https://finance.yahoo.com/quote/SI%3DF/",
    benchmark: "COMEX silver futures, continuous front month, daily close",
    points: await yahoo("SI=F"),
  }),
  copper: base({
    id: "copper", label: "Copper", unit: "USD/lb", frequency: "daily",
    source: "Yahoo Finance · HG=F (COMEX copper futures, front month)",
    sourceUrl: "https://finance.yahoo.com/quote/HG%3DF/",
    benchmark: "COMEX high-grade copper futures, continuous front month, daily close",
    points: await yahoo("HG=F"),
  }),
  nickel: base({
    id: "nickel", label: "Nickel", unit: "USD/t", frequency: "monthly",
    source: "IMF Primary Commodity Prices (PCPS) · PNICK", sourceUrl: IMF_URL,
    benchmark: "Nickel, melting grade, LME spot, CIF European ports · monthly average",
    points: await imf("PNICK"),
  }),
  ironOre: base({
    id: "ironOre", label: "Iron ore", unit: "USD/t", frequency: "monthly",
    source: "IMF Primary Commodity Prices (PCPS) · PIORECR", sourceUrl: IMF_URL,
    benchmark: "China import iron ore fines 62% Fe spot, CFR Tianjin · monthly average",
    points: await imf("PIORECR"),
  }),
  lithium: base({
    id: "lithium", label: "Lithium", unit: "USD/t", frequency: "monthly",
    source: "IMF Primary Commodity Prices (PCPS) · PLITH", sourceUrl: IMF_URL,
    benchmark: "Lithium metal ≥99%, battery grade (IMF benchmark) · monthly average",
    points: await imf("PLITH"),
  }),
};

for (const [k, s] of Object.entries(series)) {
  if (s.points.length < 24) throw new Error(`${k}: too few points`);
  const f = new Date(s.points[0].t * 1000).toISOString().slice(0, 10);
  const l = new Date(s.points.at(-1).t * 1000).toISOString().slice(0, 10);
  console.log(`${k}: ${s.points.length} pts ${f} → ${l}`);
}

const out = join(root, "src/data/commodities-snapshot.json");
writeFileSync(out, JSON.stringify({ asOf, series }) + "\n");
console.log(`wrote ${out}`);
