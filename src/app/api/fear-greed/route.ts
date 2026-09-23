/**
 * US stock market Fear & Greed Index — FearGreedChart.com public API (~1h cache).
 * Documented free JSON feed (no key). Independent methodology — not CNN.
 * Educational only — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HistRow = { date?: string; score?: number };
type FngPoint = {
  t: number;
  value: number;
  classification: string;
};

const HISTORY_URL = "https://feargreedchart.com/api/?action=history";
const SOURCE = "FearGreedChart.com Fear & Greed Index (US stocks, independent)";
const SOURCE_URL = "https://feargreedchart.com/";
const CNN_COMPARE_URL = "https://www.cnn.com/markets/fear-and-greed";

function classificationFromScore(score: number): string {
  if (score <= 20) return "Extreme Fear";
  if (score <= 40) return "Fear";
  if (score <= 60) return "Neutral";
  if (score <= 80) return "Greed";
  return "Extreme Greed";
}

function classificationColor(c: string): string {
  const s = c.toLowerCase();
  if (s.includes("extreme fear")) return "#ef4444";
  if (s.includes("fear")) return "#f97316";
  if (s.includes("extreme greed")) return "#22c55e";
  if (s.includes("greed")) return "#84cc16";
  return "#94a3b8";
}

/** Parse YYYY-MM-DD to unix seconds (UTC noon — stable daily stamp). */
function dateToUnix(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const ms = Date.UTC(y, mo - 1, d, 12, 0, 0);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

export async function GET() {
  try {
    const res = await fetch(HISTORY_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `FearGreedChart history HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const histJson = (await res.json()) as HistRow[];
    if (!Array.isArray(histJson) || !histJson.length) {
      return Response.json(
        { ok: false, error: "No Fear & Greed history" },
        { status: 502 },
      );
    }

    const points: FngPoint[] = [];
    for (const row of histJson) {
      const value = Number(row.score);
      const t = typeof row.date === "string" ? dateToUnix(row.date) : null;
      if (!Number.isFinite(value) || t == null) continue;
      points.push({
        t,
        value,
        classification: classificationFromScore(value),
      });
    }
    points.sort((a, b) => a.t - b.t);

    if (!points.length) {
      return Response.json(
        { ok: false, error: "No Fear & Greed data" },
        { status: 502 },
      );
    }

    const latest = points[points.length - 1];
    const current = {
      value: latest.value,
      classification: latest.classification,
      color: classificationColor(latest.classification),
      t: latest.t,
    };

    return Response.json(
      {
        ok: true,
        name: "Fear and Greed Index",
        current,
        points,
        source: SOURCE,
        sourceUrl: SOURCE_URL,
        compareUrl: CNN_COMPARE_URL,
        asOf: new Date().toISOString(),
        note:
          "Independent FearGreedChart.com public API (documented, no key) — not CNN’s index and not affiliated with CNN. Educational sentiment gauge only — not financial advice (NFA).",
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
