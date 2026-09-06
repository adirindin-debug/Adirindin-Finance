import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cycle Desk",
  description:
    "Educational cycle tools: Bitcoin 4-year cycle map and ~18.6y real estate cycle framing. Not financial advice.",
};

const tools = [
  {
    href: "/dashboard/btc-cycle",
    title: "BTC + MSTR 4-Year Cycle Map",
    blurb:
      "Live Bitcoin price with halving-anchored cycle framing and an optional Strategy (MSTR) overlay. Observation-only chart for study — not a forecast.",
    meta: "Live feeds · black theme · @Dirindin533",
    cta: "Open BTC cycle map",
  },
  {
    href: "/tools/real-estate-cycle",
    title: "18.6y Real Estate Cycle",
    blurb:
      "Classic ~18.6-year land / property cycle phases used in research communities, with an Australian investor lens. Framework and observation — not a prediction model.",
    meta: "Phase timeline · AU lens · educational",
    cta: "Open RE cycle desk",
  },
];

export default function DashboardHubPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Tools</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Cycle desk</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Educational cycle maps for study. Framing only — not investment advice, not personal recommendations, and not a promise of returns.
        Anthony / Adirindin (@Dirindin533).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex flex-col rounded-xl border border-border bg-card p-6 transition hover:border-accent/50"
          >
            <h2 className="text-lg font-semibold text-foreground group-hover:text-accent">{t.title}</h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{t.blurb}</p>
            <p className="mt-4 text-xs text-muted/80">{t.meta}</p>
            <span className="mt-4 inline-flex text-sm font-medium text-accent">{t.cta} →</span>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted">
        Prefer the standalone chart?{" "}
        <Link href="/btc-cycle-map.html" className="text-accent hover:underline">
          Open full-page BTC cycle map
        </Link>
        .
      </p>
    </div>
  );
}
