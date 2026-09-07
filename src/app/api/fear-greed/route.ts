/**
 * Crypto Fear & Greed Index — Alternative.me (server fetch, ~1h cache).
 * Educational only — NFA.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FngRow = {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
};

type FngPoint = {
  t: number;
  value: number;
  classification: string;
};

function classificationColor(c: string): string {
  const s = c.toLowerCase();
  if (s.includes("extreme fear")) return "#ef4444";
  if (s.includes("fear")) return "#f97316";
  if (s.includes("extreme greed")) return "#22c55e";
  if (s.includes("greed")) return "#84cc16";
  return "#94a3b8";
}

export async function GET() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=0", {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `Alternative.me HTTP ${res.status}` },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      name?: string;
      data?: FngRow[];
      metadata?: { error?: string | null };
    };
    if (json.metadata?.error) {
      return Response.json(
        { ok: false, error: String(json.metadata.error) },
        { status: 502 },
      );
    }
    const rows = json.data ?? [];
    if (!rows.length) {
      return Response.json(
        { ok: false, error: "No Fear & Greed data" },
        { status: 502 },
      );
    }

    // API returns newest-first
    const points: FngPoint[] = [];
    for (const row of rows) {
      const value = Number(row.value);
      const t = Number(row.timestamp);
      if (!Number.isFinite(value) || !Number.isFinite(t)) continue;
      points.push({
        t,
        value,
        classification: row.value_classification,
      });
    }
    points.sort((a, b) => a.t - b.t);

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
        name: json.name ?? "Fear and Greed Index",
        current,
        points,
        source: "Alternative.me Crypto Fear & Greed Index",
        sourceUrl: "https://alternative.me/crypto/fear-and-greed-index/",
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
