#!/usr/bin/env node
/**
 * Refresh src/data/risk-sentiment-snapshot.json — the dated build-time fallback
 * for /api/risk-sentiment (Tools → Market risk & sentiment gauge).
 *
 * Every number comes from a public feed; nothing is invented. If a source fails
 * the previous snapshot block for that source is kept (and the script says so).
 *
 *   node scripts/build-risk-sentiment-snapshot.mjs
 *
 * Sources:
 *  - URTH (iShares MSCI World ETF) adjusted close — Yahoo Finance chart API
 *    (delayed, third-party). Primary equity input; same pattern as global
 *    equities / seasonality. Developed-markets proxy, not the licensed MSCI index.
 *  - S&P 500 (^GSPC) daily close — Yahoo Finance chart API (delayed, third-party)
 *  - Nasdaq Composite (^IXIC) daily close — Yahoo Finance chart API. Base chart
 *    overlay only, not a score input
 *  - VIX close — FRED VIXCLS (CSV, citation required)
 *  - US stocks Fear & Greed — FearGreedChart.com public API (independent, not CNN)
 *  - Crypto Fear & Greed — Alternative.me public API
 *  - Google Trends "bitcoin" worldwide monthly interest (unofficial web endpoint;
 *    fetched here at refresh time only, never from production) — partial month dropped
 * Educational only · NFA.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/risk-sentiment-snapshot.json");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FRED_UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const SPX_FROM = Date.UTC(1985, 0, 1) / 1000;

const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(40_000) });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

async function yahooDaily(symbol, label, { period1 = SPX_FROM, adj = false, minRows = 9000 } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const events = adj ? "&events=div%7Csplit" : "";
  const j = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${now}&interval=1d${events}`,
  );
  const r = j.chart.result[0];
  const close = adj
    ? (r.indicators.adjclose?.[0]?.adjclose ?? r.indicators.quote[0].close)
    : r.indicators.quote[0].close;
  const rows = [];
  const seen = new Set();
  r.timestamp.forEach((t, i) => {
    const v = close[i];
    if (v == null || !(v > 0)) return;
    const d = new Date(t * 1000).toISOString().slice(0, 10);
    if (seen.has(d)) return;
    seen.add(d);
    rows.push([d, Math.round(v * 100) / 100]);
  });
  // A frozen snapshot should hold closes only: drop a bar for today's New York
  // session while it is still in progress (URTH / US equity session).
  const nyNow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (t) => nyNow.find((p) => p.type === t).value;
  const nyDate = `${part("year")}-${part("month")}-${part("day")}`;
  if (rows.at(-1)?.[0] === nyDate && Number(part("hour")) < 18) rows.pop();
  if (rows.length < minRows) throw new Error(`${symbol} short (${rows.length})`);
  return { asOf: rows.at(-1)[0], source: label, rows };
}

const spx = () => yahooDaily("^GSPC", "Yahoo Finance ^GSPC daily close (delayed)");
const ixic = () =>
  yahooDaily("^IXIC", "Yahoo Finance ^IXIC daily close (delayed) — Nasdaq Composite, base chart overlay only");
/** URTH listing ~12 Jan 2012 (same period1 as global equities). */
const URTH_FROM = 1325376000;
const world = () =>
  yahooDaily(
    "URTH",
    "Yahoo Finance URTH adjusted close — iShares MSCI World ETF (developed-markets proxy, delayed)",
    { period1: URTH_FROM, adj: true, minRows: 1000 },
  );

async function vix() {
  const r = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS", {
    headers: { "User-Agent": FRED_UA },
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`FRED HTTP ${r.status}`);
  const rows = [];
  for (const line of (await r.text()).trim().split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(",");
    const n = Number(v);
    if (d && v !== "." && n > 0) rows.push([d, n]);
  }
  if (rows.length < 8000) throw new Error("VIX short");
  return { asOf: rows.at(-1)[0], source: "Cboe VIX close via FRED VIXCLS", rows };
}

async function cryptoFng() {
  const j = await getJson("https://api.alternative.me/fng/?limit=0", { Accept: "application/json" });
  const rows = (j.data ?? [])
    .map((x) => [new Date(Number(x.timestamp) * 1000).toISOString().slice(0, 10), Number(x.value)])
    .filter((x) => Number.isFinite(x[1]))
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (rows.length < 1000) throw new Error("Crypto F&G short");
  return { asOf: rows.at(-1)[0], source: "Alternative.me Crypto Fear & Greed Index", rows };
}

async function usFng() {
  const j = await getJson("https://feargreedchart.com/api/?action=history", { Accept: "application/json" });
  const rows = j
    .filter((x) => typeof x.date === "string" && Number.isFinite(Number(x.score)))
    .map((x) => [x.date, Number(x.score)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (rows.length < 1000) throw new Error("US F&G short");
  return { asOf: rows.at(-1)[0], source: "FearGreedChart.com Fear & Greed (US stocks, independent)", rows };
}

async function trendsBitcoin() {
  let cookie = "";
  const get = async (url) => {
    const r = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie }, signal: AbortSignal.timeout(30_000) });
    const sc = r.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    return r;
  };
  await get("https://trends.google.com/trends/explore?q=bitcoin");
  const req = { comparisonItem: [{ keyword: "bitcoin", geo: "", time: "all" }], category: 0, property: "" };
  const ex = await get(
    `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`,
  );
  if (!ex.ok) throw new Error(`Trends explore HTTP ${ex.status}`);
  const et = await ex.text();
  const widget = JSON.parse(et.slice(et.indexOf("{"))).widgets.find((w) => w.id === "TIMESERIES");
  const ml = await get(
    `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0&req=${encodeURIComponent(
      JSON.stringify(widget.request),
    )}&token=${widget.token}`,
  );
  if (!ml.ok) throw new Error(`Trends multiline HTTP ${ml.status}`);
  const mt = await ml.text();
  const tl = JSON.parse(mt.slice(mt.indexOf("{"))).default.timelineData;
  const rows = tl
    .filter((p) => !p.isPartial)
    .map((p) => [new Date(Number(p.time) * 1000).toISOString().slice(0, 7), p.value[0]]);
  if (rows.length < 100) throw new Error("Trends short");
  return {
    asOf: rows.at(-1)[0],
    source: 'Google Trends — "bitcoin", worldwide, monthly, relative interest (0–100)',
    note: "Partial current month dropped. Values are relative to the series peak, so only percentiles are used.",
    rows,
  };
}

const out = { _note: "", fetched: new Date().toISOString() };
for (const [key, fn] of Object.entries({ world, spx, ixic, vix, cryptoFng, usFng, trendsBitcoin })) {
  try {
    out[key] = await fn();
    console.log(`${key}: ${out[key].rows.length} rows, ${out[key].rows[0][0]} → ${out[key].asOf}`);
  } catch (e) {
    if (prev[key]) {
      out[key] = prev[key];
      console.warn(`${key}: FAILED (${e.message}) — kept previous snapshot block (asOf ${prev[key].asOf})`);
    } else {
      console.warn(`${key}: FAILED (${e.message}) — omitted`);
    }
  }
}
out._note =
  "Dated build-time fallback for /api/risk-sentiment. Public feeds only (see scripts/build-risk-sentiment-snapshot.mjs). Educational only · NFA.";
writeFileSync(OUT, JSON.stringify(out));
console.log(`wrote ${OUT}`);
