import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "Research tools desk: portfolio tracker and Australian property prices. Educational only — not financial advice.",
};

const tools = [
  {
    href: "/portfolio",
    title: "Portfolio",
    blurb:
      "Personal holdings tracker that stays on your device. Track positions, returns and allocation for study — not a broker and not advice.",
    meta: "Local tracker · browser storage · educational",
    cta: "Open portfolio",
  },
  {
    href: "/property-prices",
    title: "Australian Property Prices",
    blurb:
      "Australian property price desk for observing metro and regional markets. Framing and data exploration only — not a valuation or recommendation.",
    meta: "AU property · price desk · educational",
    cta: "Open Australian Property Prices",
  },
];

export default function ToolsHubPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Tools</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Research tools</h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Desk for trackers and Australian property tools. Cycle theories live in the top nav (BTC
        cycle, RE cycle). Educational framing only — not personal financial advice, not a
        recommendation, and not a promise of returns. Anthony / Adirindin (@Dirindin533).
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

      <p className="mt-8 text-xs text-muted">More tools can be added over time.</p>
    </div>
  );
}
