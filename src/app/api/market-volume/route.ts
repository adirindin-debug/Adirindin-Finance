/**
 * Total crypto market volume (public feeds).
 * Prefer CoinGecko global / market_cap_chart when available;
 * otherwise CoinPaprika (latest) + CoinMetrics major-asset sum (history proxy).
 * Not The Block spot exchange desk — link out for that. Educational — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VolPoint = { t: number; volumeUsd: number };

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindin.finance)";

const CM_ASSETS = [
  "btc",
  "eth",
  "usdt",
  "usdc",
  "sol",
  "xrp",
  "bnb",
  "ada",
  "doge",
  "trx",
  "avax",
  "link",
  "dot",
  "ltc",
  "bch",
].join(",");

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Accept: "application/json", "User-Agent": UA, ...(init?.headers || {}) },
  });
  return { res, json: res.ok ? await res.json() : null };
}

async function fetchCoinGeckoHistory(days: number): Promise<{
  points: VolPoint[];
  source: string;
} | null> {
  const url = `https://api.coingecko.com/api/v3/global/market_cap_chart?days=${days}&vs_currency=usd`;
  try {
    const { res, json } = await fetchJson(url, { next: { revalidate: 3600 } });
    if (!res.ok || !json) return null;
    const vol = (
      json as {
        market_cap_chart?: { volume?: [number, number][] };
      }
    ).market_cap_chart?.volume;
    if (!vol?.length) return null;
    const points: VolPoint[] = vol
      .map(([ms, v]) => ({
        t: Math.floor(ms / 1000),
        volumeUsd: v,
      }))
      .filter((p) => Number.isFinite(p.volumeUsd) && p.volumeUsd > 0);
    if (points.length < 2) return null;
    return {
      points,
      source: "CoinGecko /global/market_cap_chart (total_volume, USD)",
    };
  } catch {
    return null;
  }
}

async function fetchCoinGeckoCurrent(): Promise<{
  volumeUsd: number;
  marketCapUsd: number | null;
  source: string;
} | null> {
  try {
    const { res, json } = await fetchJson(
      "https://api.coingecko.com/api/v3/global",
      { next: { revalidate: 3600 } },
    );
    if (!res.ok || !json) return null;
    const data = (json as { data?: { total_volume?: { usd?: number }; total_market_cap?: { usd?: number } } })
      .data;
    const volumeUsd = data?.total_volume?.usd;
    if (volumeUsd == null || !Number.isFinite(volumeUsd)) return null;
    return {
      volumeUsd,
      marketCapUsd: data?.total_market_cap?.usd ?? null,
      source: "CoinGecko /global (total_volume.usd)",
    };
  } catch {
    return null;
  }
}

async function fetchCoinPaprikaCurrent(): Promise<{
  volumeUsd: number;
  marketCapUsd: number | null;
  source: string;
} | null> {
  try {
    const { res, json } = await fetchJson("https://api.coinpaprika.com/v1/global", {
      next: { revalidate: 3600 },
    });
    if (!res.ok || !json) return null;
    const row = json as {
      volume_24h_usd?: number;
      market_cap_usd?: number;
    };
    if (row.volume_24h_usd == null || !Number.isFinite(row.volume_24h_usd)) return null;
    return {
      volumeUsd: row.volume_24h_usd,
      marketCapUsd: row.market_cap_usd ?? null,
      source: "CoinPaprika /v1/global (volume_24h_usd)",
    };
  } catch {
    return null;
  }
}

async function fetchCoinMetricsHistory(days: number): Promise<{
  points: VolPoint[];
  source: string;
} | null> {
  try {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const url =
      `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics` +
      `?assets=${CM_ASSETS}&metrics=volume_reported_spot_usd_1d` +
      `&start_time=${startStr}&end_time=${endStr}&frequency=1d&page_size=10000`;
    const { res, json } = await fetchJson(url, { next: { revalidate: 3600 } });
    if (!res.ok || !json) return null;
    const rows = (json as { data?: Array<{ time: string; volume_reported_spot_usd_1d?: string | null }> })
      .data;
    if (!rows?.length) return null;
    const byDay = new Map<string, number>();
    for (const row of rows) {
      const day = row.time.slice(0, 10);
      const v = row.volume_reported_spot_usd_1d;
      if (v == null) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      byDay.set(day, (byDay.get(day) ?? 0) + n);
    }
    const points: VolPoint[] = [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, volumeUsd]) => ({
        t: Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 1000),
        volumeUsd,
      }))
      .filter((p) => p.volumeUsd > 0);
    if (points.length < 2) return null;
    return {
      points,
      source:
        "CoinMetrics community volume_reported_spot_usd_1d (sum of major assets) — total market volume proxy",
    };
  } catch {
    return null;
  }
}

function downsample(points: VolPoint[], maxPts: number): VolPoint[] {
  if (points.length <= maxPts) return points;
  const out: VolPoint[] = [];
  const lastIdx = points.length - 1;
  for (let k = 0; k < maxPts; k++) {
    const i = Math.round((k * lastIdx) / (maxPts - 1));
    const p = points[i];
    if (!out.length || out[out.length - 1].t !== p.t) out.push(p);
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const daysRaw = Number(searchParams.get("days") ?? "365");
  const days = Number.isFinite(daysRaw)
    ? Math.min(Math.max(Math.floor(daysRaw), 30), 1825)
    : 365;

  const errors: string[] = [];

  const [cgCurrent, paprikaCurrent, cgHistory] = await Promise.all([
    fetchCoinGeckoCurrent(),
    fetchCoinPaprikaCurrent(),
    fetchCoinGeckoHistory(days),
  ]);

  const current = cgCurrent ?? paprikaCurrent;
  if (!current) errors.push("Could not load current total market volume");

  let history = cgHistory;
  let historyIsProxy = false;
  if (!history) {
    errors.push("CoinGecko global market_cap_chart unavailable (rate limit or Pro-only)");
    history = await fetchCoinMetricsHistory(days);
    historyIsProxy = !!history;
    if (!history) errors.push("CoinMetrics history unavailable");
  }

  if (!current && !history) {
    return Response.json(
      { ok: false, error: "No volume data", errors },
      { status: 502 },
    );
  }

  const points = history ? downsample(history.points, 400) : [];
  const latestFromHistory = points.length ? points[points.length - 1].volumeUsd : null;

  return Response.json(
    {
      ok: true,
      currency: "USD",
      currentVolumeUsd: current?.volumeUsd ?? latestFromHistory,
      currentMarketCapUsd: current?.marketCapUsd ?? null,
      currentSource: current?.source ?? null,
      points,
      historySource: history?.source ?? null,
      historyIsProxy,
      theBlockUrl:
        "https://www.theblock.co/data/crypto-markets/spot/total-exchange-volume-daily",
      disclaimer:
        "Our chart is total crypto market volume from a public feed (or a major-asset volume proxy when CoinGecko’s global history endpoint is unavailable). It is not The Block’s spot exchange volume desk — use the link for that reference. Educational only — not financial advice (NFA).",
      errors: errors.length ? errors : undefined,
      asOf: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    },
  );
}
