/**
 * US stock market Fear & Greed Index — CNN dataviz (server fetch, ~1h cache).
 * Undocumented CNN production.dataviz endpoint; educational only — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CnnHistPoint = {
  x: number;
  y: number;
  rating?: string;
};

type FngPoint = {
  t: number;
  value: number;
  classification: string;
};

const CNN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const CNN_URL =
  "https://production.dataviz.cnn.io/index/fearandgreed/graphdata/2021-02-01";
const SOURCE = "CNN Fear & Greed Index (US stocks)";
const SOURCE_URL = "https://www.cnn.com/markets/fear-and-greed";

function classificationColor(c: string): string {
  const s = c.toLowerCase();
  if (s.includes("extreme fear")) return "#ef4444";
  if (s.includes("fear")) return "#f97316";
  if (s.includes("extreme greed")) return "#22c55e";
  if (s.includes("greed")) return "#84cc16";
  return "#94a3b8";
}

/** Title-case CNN ratings like "extreme fear" → "Extreme Fear". */
function titleCaseRating(rating: string): string {
  return rating
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function GET() {
  try {
    const res = await fetch(CNN_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": CNN_UA,
        Origin: "https://www.cnn.com",
        Referer: "https://www.cnn.com/",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `CNN Fear & Greed HTTP ${res.status}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      fear_and_greed?: {
        score?: number;
        rating?: string;
        timestamp?: string;
      };
      fear_and_greed_historical?: {
        data?: CnnHistPoint[];
      };
    };

    const hist = json.fear_and_greed_historical?.data ?? [];
    const points: FngPoint[] = [];
    for (const row of hist) {
      const value = Number(row.y);
      const ms = Number(row.x);
      if (!Number.isFinite(value) || !Number.isFinite(ms)) continue;
      const classification = titleCaseRating(String(row.rating ?? "neutral"));
      points.push({
        t: Math.floor(ms / 1000),
        value,
        classification,
      });
    }
    points.sort((a, b) => a.t - b.t);

    if (!points.length) {
      return Response.json(
        { ok: false, error: "No Fear & Greed data" },
        { status: 502 },
      );
    }

    const fg = json.fear_and_greed;
    const latest = points[points.length - 1];
    const score =
      fg?.score != null && Number.isFinite(Number(fg.score))
        ? Number(fg.score)
        : latest.value;
    const classification = titleCaseRating(
      String(fg?.rating ?? latest.classification),
    );
    let t = latest.t;
    if (fg?.timestamp) {
      const parsed = Date.parse(fg.timestamp);
      if (Number.isFinite(parsed)) t = Math.floor(parsed / 1000);
    }

    const current = {
      value: score,
      classification,
      color: classificationColor(classification),
      t,
    };

    return Response.json(
      {
        ok: true,
        name: "Fear and Greed Index",
        current,
        points,
        source: SOURCE,
        sourceUrl: SOURCE_URL,
        asOf: new Date().toISOString(),
        note: "Educational sentiment gauge only — not financial advice (NFA).",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Fear & Greed fetch failed",
      },
      { status: 502 },
    );
  }
}
