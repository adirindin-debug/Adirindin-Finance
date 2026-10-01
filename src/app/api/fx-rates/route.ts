/**
 * Display-currency FX for /portfolio: units of each currency per 1 AUD.
 * Primary: ECB euro foreign exchange reference rates via Frankfurter (free, no
 * key; rates fall under the ECB's terms — reuse allowed with the source cited).
 * Fallback: ExchangeRate-API open access endpoint (free, no key; attribution
 * link required, which the page shows when this source is used). Last resort: a
 * dated ECB snapshot, labelled as such. Cached; reference rates update once per
 * working day. Educational — NFA.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const FETCH_MS = 8_000;
const QUOTES = ["USD", "EUR", "GBP", "JPY", "CAD", "CHF", "NZD", "CNY"] as const;
type Quote = (typeof QUOTES)[number];
type Rates = Record<Quote, number>;

export type FxRatesPayload = {
  ok: boolean;
  base: "AUD";
  /** Units of each currency per 1 AUD. */
  rates: Rates;
  /** Rate date (YYYY-MM-DD). */
  asOf: string;
  source: "ecb-frankfurter" | "exchangerate-api" | "snapshot";
  sourceLabel: string;
  sourceUrl: string;
  error?: string;
};

/** ECB reference rates (via Frankfurter), base AUD, for 1 Oct 2026. */
const SNAPSHOT: { asOf: string; rates: Rates } = {
  asOf: "2026-10-01",
  rates: {
    USD: 0.69505,
    EUR: 0.6152,
    GBP: 0.52521,
    JPY: 109.81,
    CAD: 0.99016,
    CHF: 0.58056,
    NZD: 1.2378,
    CNY: 4.66,
  },
};

function complete(r: Partial<Record<string, number>>): Rates | null {
  const out = {} as Rates;
  for (const q of QUOTES) {
    const v = r[q];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
    out[q] = v;
  }
  return out;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_MS),
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fromFrankfurter(): Promise<{ rates: Rates; asOf: string }> {
  const rows = (await getJson(
    `https://api.frankfurter.dev/v2/providers/ecb/rates?base=AUD&quotes=${QUOTES.join(",")}`,
  )) as { date?: string; quote?: string; rate?: number }[];
  if (!Array.isArray(rows)) throw new Error("Frankfurter: unexpected shape");
  const map: Record<string, number> = {};
  let asOf = "";
  for (const r of rows) {
    if (r.quote && typeof r.rate === "number") map[r.quote] = r.rate;
    if (r.date && r.date > asOf) asOf = r.date;
  }
  const rates = complete(map);
  if (!rates || !asOf) throw new Error("Frankfurter: missing currencies");
  return { rates, asOf };
}

async function fromExchangeRateApi(): Promise<{ rates: Rates; asOf: string }> {
  const j = (await getJson("https://open.er-api.com/v6/latest/AUD")) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_unix?: number;
  };
  if (j.result !== "success" || !j.rates) throw new Error("ExchangeRate-API: error");
  const rates = complete(j.rates);
  if (!rates) throw new Error("ExchangeRate-API: missing currencies");
  const asOf = j.time_last_update_unix
    ? new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return { rates, asOf };
}

export async function GET() {
  const errors: string[] = [];
  let payload: FxRatesPayload | null = null;
  try {
    const { rates, asOf } = await fromFrankfurter();
    payload = {
      ok: true,
      base: "AUD",
      rates,
      asOf,
      source: "ecb-frankfurter",
      sourceLabel: "ECB reference rates via Frankfurter",
      sourceUrl: "https://frankfurter.dev",
    };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  if (!payload) {
    try {
      const { rates, asOf } = await fromExchangeRateApi();
      payload = {
        ok: true,
        base: "AUD",
        rates,
        asOf,
        source: "exchangerate-api",
        sourceLabel: "Rates By Exchange Rate API",
        sourceUrl: "https://www.exchangerate-api.com",
      };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (!payload) {
    payload = {
      ok: true,
      base: "AUD",
      rates: SNAPSHOT.rates,
      asOf: SNAPSHOT.asOf,
      source: "snapshot",
      sourceLabel: "ECB reference rates (dated snapshot)",
      sourceUrl: "https://frankfurter.dev",
      error: errors.join(" · "),
    };
  }
  const sMaxAge = payload.source === "snapshot" ? 300 : 3600;
  return NextResponse.json(payload, {
    headers: { "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=86400` },
  });
}
