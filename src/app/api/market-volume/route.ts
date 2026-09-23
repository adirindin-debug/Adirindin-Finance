/**
 * Total crypto market volume as a 7-day moving average.
 * Prefer CoinGecko global / market_cap_chart daily volume when available;
 * otherwise CoinMetrics major-asset sum (history proxy) with full pagination
 * + corrupt-print / relative-outlier hygiene, or DefiLlama DEX as last resort.
 * Always label the underlying source — do not present a proxy as CoinGecko.
 * Not The Block spot exchange desk — link out to compare. Educational.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VolPoint = { t: number; volumeUsd: number; rawVolumeUsd?: number };

const UA =
  "Mozilla/5.0 (compatible; AdirindinFinance/1.0; educational; +https://adirindin.finance)";

const MA_WINDOW = 7;

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

/**
 * Single-asset daily spot volume above this is treated as corrupt upstream data
 * (seen on CoinMetrics USDC prints at 1e36–1e55). No credible asset clears $500B/day.
 */
const MAX_ASSET_DAY_USD = 5e11;

/** Drop a single-asset day if it exceeds this multiple of that asset's median. */
const RELATIVE_OUTLIER_MULT = 25;

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": UA,
      ...(init?.headers || {}),
    },
  });
  return { res, json: res.ok ? await res.json() : null };
}

/** CoinGecko chart days query accepts a fixed enum (plus max). */
function coinGeckoDaysParam(days: number): string {
  const allowed = [7, 14, 30, 90, 180, 365];
  if (days > 365) return "max";
  const hit = allowed.find((d) => d >= days);
  return String(hit ?? 365);
}

/**
 * Trailing 7-day moving average over daily volume.
 * Emits a point only when a full window of 7 consecutive daily prints is available
 * (no partial windows). volumeUsd is the MA; rawVolumeUsd is that day's raw print.
 */
function computeSevenDayMA(raw: VolPoint[]): VolPoint[] {
  if (raw.length < MA_WINDOW) return [];
  const out: VolPoint[] = [];
  for (let i = MA_WINDOW - 1; i < raw.length; i++) {
    let sum = 0;
    let ok = true;
    for (let j = i - (MA_WINDOW - 1); j <= i; j++) {
      const v = raw[j]!.volumeUsd;
      if (!Number.isFinite(v) || v <= 0) {
        ok = false;
        break;
      }
      sum += v;
    }
    if (!ok) continue;
    const day = raw[i]!;
    out.push({
      t: day.t,
      volumeUsd: sum / MA_WINDOW,
      rawVolumeUsd: day.volumeUsd,
    });
  }
  return out;
}

async function fetchCoinGeckoHistory(days: number): Promise<{
  points: VolPoint[];
  source: string;
} | null> {
  const daysParam = coinGeckoDaysParam(days);
  const url = `https://api.coingecko.com/api/v3/global/market_cap_chart?days=${daysParam}&vs_currency=usd`;
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
      .filter(
        (p) =>
          Number.isFinite(p.volumeUsd) &&
          p.volumeUsd > 0 &&
          p.volumeUsd <= MAX_ASSET_DAY_USD * 4,
      );
    if (points.length < 2) return null;
    return {
      points: dedupeDaily(points),
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
    const data = (
      json as {
        data?: {
          total_volume?: { usd?: number };
          total_market_cap?: { usd?: number };
        };
      }
    ).data;
    const volumeUsd = data?.total_volume?.usd;
    if (volumeUsd == null || !Number.isFinite(volumeUsd) || volumeUsd <= 0) {
      return null;
    }
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
    const { res, json } = await fetchJson(
      "https://api.coinpaprika.com/v1/global",
      { next: { revalidate: 3600 } },
    );
    if (!res.ok || !json) return null;
    const row = json as {
      volume_24h_usd?: number;
      market_cap_usd?: number;
    };
    if (
      row.volume_24h_usd == null ||
      !Number.isFinite(row.volume_24h_usd) ||
      row.volume_24h_usd <= 0
    ) {
      return null;
    }
    return {
      volumeUsd: row.volume_24h_usd,
      marketCapUsd: row.market_cap_usd ?? null,
      source: "CoinPaprika /v1/global (volume_24h_usd)",
    };
  } catch {
    return null;
  }
}

type CmRow = {
  time: string;
  asset?: string;
  volume_reported_spot_usd_1d?: string | null;
};

/** Follow CoinMetrics next_page_url so major assets are not truncated mid-series. */
async function fetchCoinMetricsRows(
  days: number,
): Promise<{ rows: CmRow[]; pages: number } | null> {
  try {
    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    let url: string | null =
      `https://community-api.coinmetrics.io/v4/timeseries/asset-metrics` +
      `?assets=${CM_ASSETS}&metrics=volume_reported_spot_usd_1d` +
      `&start_time=${startStr}&end_time=${endStr}&frequency=1d&page_size=10000`;

    const rows: CmRow[] = [];
    let pages = 0;
    while (url && pages < 25) {
      const { res, json } = await fetchJson(url, {
        next: { revalidate: 3600 },
      });
      if (!res.ok || !json) {
        if (pages === 0) return null;
        break;
      }
      const body = json as {
        data?: CmRow[];
        next_page_url?: string | null;
      };
      const chunk = body.data ?? [];
      rows.push(...chunk);
      pages += 1;
      url = body.next_page_url ?? null;
      if (!chunk.length) break;
    }
    if (!rows.length) return null;
    return { rows, pages };
  } catch {
    return null;
  }
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function dedupeDaily(points: VolPoint[]): VolPoint[] {
  const byDay = new Map<string, VolPoint>();
  for (const p of points) {
    const day = new Date(p.t * 1000).toISOString().slice(0, 10);
    byDay.set(day, p);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, p]) => p);
}

async function fetchCoinMetricsHistory(days: number): Promise<{
  points: VolPoint[];
  source: string;
  droppedCorrupt: number;
  pages: number;
  assetDaysKept: number;
} | null> {
  const fetched = await fetchCoinMetricsRows(days);
  if (!fetched) return null;
  const { rows, pages } = fetched;

  // Collect finite positive prints per asset (pre absolute-cap) for medians.
  const byAssetValues = new Map<string, number[]>();
  for (const row of rows) {
    const asset = (row.asset ?? "").toLowerCase();
    const v = row.volume_reported_spot_usd_1d;
    if (!asset || v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n > MAX_ASSET_DAY_USD) continue;
    const list = byAssetValues.get(asset) ?? [];
    list.push(n);
    byAssetValues.set(asset, list);
  }
  const assetMedian = new Map<string, number>();
  for (const [asset, vals] of byAssetValues) {
    if (vals.length >= 7) assetMedian.set(asset, median(vals));
  }

  const byDay = new Map<string, number>();
  const assetsPerDay = new Map<string, number>();
  let droppedCorrupt = 0;
  let assetDaysKept = 0;

  for (const row of rows) {
    const day = row.time.slice(0, 10);
    const asset = (row.asset ?? "").toLowerCase();
    const v = row.volume_reported_spot_usd_1d;
    if (v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;

    // Absolute corrupt-print filter (e.g. USDC 1e55).
    if (n > MAX_ASSET_DAY_USD) {
      droppedCorrupt += 1;
      continue;
    }

    // Relative outlier vs that asset's own median (keeps series denser than dropping assets wholesale).
    const med = assetMedian.get(asset);
    if (med != null && med > 0 && n > RELATIVE_OUTLIER_MULT * med) {
      droppedCorrupt += 1;
      continue;
    }

    byDay.set(day, (byDay.get(day) ?? 0) + n);
    assetsPerDay.set(day, (assetsPerDay.get(day) ?? 0) + 1);
    assetDaysKept += 1;
  }

  // Prefer days with at least a few contributing majors so sparse partial pages don't spike.
  const MIN_ASSETS = 5;
  const points: VolPoint[] = [...byDay.entries()]
    .filter(([day]) => (assetsPerDay.get(day) ?? 0) >= MIN_ASSETS)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, volumeUsd]) => ({
      t: Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 1000),
      volumeUsd,
    }))
    .filter((p) => p.volumeUsd > 0);

  if (points.length < 2) return null;

  return {
    points,
    droppedCorrupt,
    pages,
    assetDaysKept,
    source:
      "CoinMetrics community volume_reported_spot_usd_1d (paginated sum of major assets) — total market volume proxy",
  };
}

/**
 * DefiLlama aggregate daily DEX volume — honest last-resort series when
 * CoinGecko + CoinMetrics history are unavailable. Not CEX spot volume.
 */
async function fetchDefiLlamaDexHistory(days: number): Promise<{
  points: VolPoint[];
  source: string;
} | null> {
  try {
    const { res, json } = await fetchJson(
      "https://api.llama.fi/overview/dexs?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume",
      { next: { revalidate: 3600 } },
    );
    if (!res.ok || !json) return null;
    const chart = (json as { totalDataChart?: [number, number][] })
      .totalDataChart;
    if (!chart?.length) return null;
    const tMin = Math.floor(Date.now() / 1000) - days * 86400;
    const points: VolPoint[] = chart
      .map(([t, v]) => ({
        t: typeof t === "number" && t > 1e12 ? Math.floor(t / 1000) : t,
        volumeUsd: v,
      }))
      .filter(
        (p) =>
          p.t >= tMin &&
          Number.isFinite(p.volumeUsd) &&
          p.volumeUsd > 0 &&
          p.volumeUsd <= MAX_ASSET_DAY_USD * 4,
      );
    if (points.length < 2) return null;
    return {
      points: dedupeDaily(points),
      source:
        "DefiLlama DEX aggregate dailyVolume (DEX only — not CEX / total market spot)",
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
    const p = points[i]!;
    if (!out.length || out[out.length - 1]!.t !== p.t) out.push(p);
  }
  return out;
}

function withMaSourceLabel(baseSource: string, isProxy: boolean): string {
  const ma = `${baseSource} · ${MA_WINDOW}-day moving average (full window only)`;
  if (!isProxy) return ma;
  return `${ma} — fallback (not CoinGecko)`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const daysRaw = Number(searchParams.get("days") ?? "365");
  // Requested MA series length (client may ask up to ~10y).
  const days = Number.isFinite(daysRaw)
    ? Math.min(Math.max(Math.floor(daysRaw), 7), 3700)
    : 365;
  // Extra raw days so the first MA point still lands inside the requested window.
  const rawDays = Math.min(days + (MA_WINDOW - 1), 3706);

  const errors: string[] = [];

  const [cgCurrent, paprikaCurrent, cgHistory] = await Promise.all([
    fetchCoinGeckoCurrent(),
    fetchCoinPaprikaCurrent(),
    fetchCoinGeckoHistory(rawDays),
  ]);

  const snapshot = cgCurrent ?? paprikaCurrent;
  if (!snapshot) errors.push("Could not load current total market volume snapshot");

  let rawHistory: {
    points: VolPoint[];
    source: string;
    droppedCorrupt: number;
  } | null = cgHistory
    ? { ...cgHistory, droppedCorrupt: 0 }
    : null;
  let historyIsProxy = false;

  if (!rawHistory) {
    errors.push(
      "CoinGecko global market_cap_chart unavailable (rate limit or Pro-only)",
    );
    const cm = await fetchCoinMetricsHistory(rawDays);
    if (cm) {
      rawHistory = cm;
      historyIsProxy = true;
      if (cm.pages > 1) {
        errors.push(
          `CoinMetrics history fetched across ${cm.pages} pages (${cm.assetDaysKept} asset-days kept)`,
        );
      }
    } else {
      errors.push("CoinMetrics history unavailable");
      const llama = await fetchDefiLlamaDexHistory(rawDays);
      if (llama) {
        rawHistory = { ...llama, droppedCorrupt: 0 };
        historyIsProxy = true;
        errors.push("Fell back to DefiLlama DEX daily volume (labelled)");
      } else {
        errors.push("DefiLlama DEX history unavailable");
      }
    }
  }

  if (!snapshot && !rawHistory) {
    return Response.json(
      { ok: false, error: "No volume data", errors },
      { status: 502 },
    );
  }

  const maPoints = rawHistory ? computeSevenDayMA(rawHistory.points) : [];
  if (rawHistory && maPoints.length < 2) {
    errors.push(
      `Need at least ${MA_WINDOW} daily prints for a full-window ${MA_WINDOW}-day MA`,
    );
  }

  // Keep near-daily resolution so client window filters (7D/30D) still have enough ticks.
  const points = maPoints.length >= 2 ? downsample(maPoints, 2000) : [];
  const latestMa = points.length ? points[points.length - 1]! : null;

  const droppedCorrupt = rawHistory?.droppedCorrupt ?? 0;
  if (droppedCorrupt > 0) {
    errors.push(
      `Dropped ${droppedCorrupt} corrupt/outlier single-asset daily prints before summing`,
    );
  }

  const historySource = rawHistory
    ? withMaSourceLabel(rawHistory.source, historyIsProxy)
    : null;

  // Headline matches chart end: latest 7DMA when available.
  const currentVolumeUsd = latestMa?.volumeUsd ?? null;
  const currentSource = latestMa
    ? historySource
    : snapshot
      ? `${snapshot.source} — raw 24h (no ${MA_WINDOW}-day MA history)`
      : null;

  const disclaimer = historyIsProxy
    ? `Chart shows a ${MA_WINDOW}-day moving average of a labelled public proxy (CoinGecko’s global daily volume history was unavailable). Levels will not match CoinGecko total-market volume or The Block’s spot exchange desk — use the compare link for The Block reference.`
    : `Chart shows CoinGecko total-market volume as a ${MA_WINDOW}-day moving average (full 7-day window only). Dollar levels will not match The Block’s spot exchange desk series — use the compare link for that reference.`;

  return Response.json(
    {
      ok: true,
      currency: "USD",
      maWindow: MA_WINDOW,
      seriesKind: latestMa ? "7dma" : snapshot ? "raw_24h" : null,
      currentVolumeUsd:
        currentVolumeUsd ?? snapshot?.volumeUsd ?? null,
      currentMarketCapUsd: snapshot?.marketCapUsd ?? null,
      rawCurrentVolumeUsd: snapshot?.volumeUsd ?? latestMa?.rawVolumeUsd ?? null,
      currentSource,
      points,
      historySource,
      historyIsProxy,
      droppedCorrupt: droppedCorrupt || undefined,
      theBlockUrl:
        "https://www.theblock.co/data/crypto-markets/spot/total-exchange-volume-daily",
      disclaimer,
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
