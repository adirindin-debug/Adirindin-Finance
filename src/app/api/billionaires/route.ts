/**
 * Top 10 richest people on the planet for /tools/power-level.
 * Primary: Forbes Real-Time Billionaires (public JSON behind forbes.com/real-time-billionaires),
 * cached for an hour. Fallback: a dated snapshot of the same list saved on 7 Oct 2026 AEDT
 * (src/data/billionaires-snapshot.json) — labelled as a snapshot on the page. Figures are
 * never invented or adjusted. Educational — NFA.
 */

import { NextResponse } from "next/server";
import snapshot from "@/data/billionaires-snapshot.json";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindinfinance.com)";
const FETCH_MS = 8_000;
const API =
  "https://www.forbes.com/forbesapi/person/rtb/0/position/true.json?fields=rank,uri,personName,finalWorth,timestamp,source,countryOfCitizenship&limit=10";
const CACHE = "public, s-maxage=1800, stale-while-revalidate=7200";

export type Billionaire = {
  rank: number;
  name: string;
  /** Net worth in US$ millions, as published. */
  netWorthUsdM: number;
  wealthSource: string | null;
  country: string | null;
};

export type BillionairesPayload = {
  ok: boolean;
  live: boolean;
  source: string;
  sourceUrl: string;
  /** When the source last updated the figures (ISO). */
  asOf: string;
  people: Billionaire[];
  note?: string;
  error?: string;
};

type RtbRow = {
  rank?: number;
  personName?: string;
  finalWorth?: number;
  timestamp?: number;
  source?: string;
  countryOfCitizenship?: string;
};

async function fromForbes(): Promise<BillionairesPayload> {
  const res = await fetch(API, {
    signal: AbortSignal.timeout(FETCH_MS),
    headers: { Accept: "application/json", "User-Agent": UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Forbes HTTP ${res.status}`);
  const j = (await res.json()) as { personList?: { personsLists?: RtbRow[] } };
  const rows = j.personList?.personsLists;
  if (!Array.isArray(rows)) throw new Error("Forbes: unexpected shape");
  const people: Billionaire[] = [];
  let ts = 0;
  for (const r of rows) {
    if (typeof r.personName !== "string" || typeof r.finalWorth !== "number" || !Number.isFinite(r.finalWorth) || r.finalWorth <= 0)
      continue;
    people.push({
      rank: typeof r.rank === "number" ? r.rank : people.length + 1,
      name: r.personName,
      netWorthUsdM: r.finalWorth,
      wealthSource: r.source ?? null,
      country: r.countryOfCitizenship ?? null,
    });
    if (typeof r.timestamp === "number" && r.timestamp > ts) ts = r.timestamp;
  }
  people.sort((a, b) => a.rank - b.rank);
  if (people.length < 10) throw new Error(`Forbes: only ${people.length} rows`);
  return {
    ok: true,
    live: true,
    source: "Forbes Real-Time Billionaires",
    sourceUrl: "https://www.forbes.com/real-time-billionaires/",
    asOf: ts > 0 ? new Date(ts).toISOString() : new Date().toISOString(),
    people: people.slice(0, 10),
  };
}

export async function GET() {
  try {
    const body = await fromForbes();
    return NextResponse.json(body, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    const body: BillionairesPayload = {
      ok: true,
      live: false,
      source: `${snapshot.source} (saved snapshot)`,
      sourceUrl: snapshot.sourceUrl,
      asOf: snapshot.asOf,
      people: snapshot.people,
      note: snapshot.note,
      error: e instanceof Error ? e.message : String(e),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  }
}
