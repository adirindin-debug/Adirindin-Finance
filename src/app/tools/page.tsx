import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "Research tools desk: portfolio tracker, Australian property prices, a market risk & sentiment gauge, a compound interest calculator with historical asset growth rates and a just-for-fun Power Level scouter. Educational and illustrative only — not financial advice.",
};

type ToolCard = { href: string; title: string; badge?: string; blurb: string; meta: string; cta: string };

const tools: ToolCard[] = [
  {
    href: "/portfolio",
    title: "Portfolio",
    blurb:
      "Personal holdings tracker that stays on your device. Track positions, returns and allocation for study — not a broker and not advice.",
    meta: "Local tracker · browser storage · educational",
    cta: "Open portfolio",
  },
  {
    href: "/tools/risk-sentiment",
    title: "Market risk & sentiment gauge",
    blurb:
      "One 0–100 reading from washout to euphoria-leaning, blended from public URTH and S&P 500 drawdown, RSI and 200-day trend, VIX, credit spreads (Moody's BAA − 10y via FRED), Fear & Greed, search attention, calendar-month seasonality and a light touch of the cycle calendars. Scrub the history over an S&P 500, Nasdaq or URTH base chart. Study aid — not a signal.",
    meta: "Composite · transparent weights · 3Y default · educational · NFA",
    cta: "Open the gauge",
  },
  {
    href: "/tools/compound-interest",
    title: "Compound interest calculator",
    blurb:
      "Project a starting balance plus regular contributions at any rate — no cap — or at a real asset's historical growth rate by ticker. Optional inflation view in today's dollars. Rough gauge only — historical rates are not a forecast.",
    meta: "Calculator · ticker CAGR · optional inflation · illustrative · NFA",
    cta: "Open the calculator",
  },
  {
    href: "/tools/power-level",
    title: "Power Level",
    badge: "Beta",
    blurb:
      "A scouter-style power level for your standard of living, 0–100,000. Net worth, runway, savings rate and income on a log scale, with quick-fill examples and the planet's top 10 from Forbes. Runs in your browser — nothing stored or sent. Just for fun.",
    meta: "Fun · log-scale score · client-side · not a measure of worth · NFA",
    cta: "Scan your power level",
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
        Desk for trackers, Australian property tools, a market risk &amp; sentiment gauge, a compound interest calculator and a just-for-fun Power Level scouter. Cycle theories live under{" "}
        <Link href="/cycles" className="text-accent hover:underline">
          Market cycles
        </Link>
        . Educational framing only — not personal financial advice, not a recommendation, and not a
        promise of returns. Anthony / Adirindin (@Dirindin533).
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex flex-col rounded-xl border border-border bg-card p-6 transition hover:border-accent/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground group-hover:text-accent">{t.title}</h2>
              {t.badge ? (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d4a017]/40 bg-[#d4a017]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#e8b84a]"
                  data-badge={t.badge}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#e8b84a]" aria-hidden />
                  {t.badge}
                </span>
              ) : null}
            </div>
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
