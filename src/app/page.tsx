import Link from "next/link";
import { MarketStrip } from "@/components/MarketStrip";
import { BtcFourYearChart } from "@/components/BtcFourYearChart";
import { CycleStrip } from "@/components/cycles/CyclesHub";
import { HomeRiskGauge } from "@/components/home/HomeRiskGauge";
import { DataUpdated } from "@/components/home/DataUpdated";

const DESK_LINKS = [
  { href: "/cycles", title: "Market cycles", blurb: "Bitcoin, real estate, bond yield and gold cycle tiles with Live markers." },
  { href: "/charts", title: "Charts", blurb: "Fear & greed, global equities, ETF flows, seasonality and more." },
  { href: "/tools", title: "Tools", blurb: "Risk & sentiment gauge, cycle desks, compound interest and other calculators." },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        A personal research desk for market cycles.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        I built these charts and cycle frameworks for my own use and share them
        for anyone interested. Educational only — not financial advice (NFA).
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/cycles" className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white">
          Explore market cycles
        </Link>
        <Link
          href="/portfolio"
          className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent hover:text-accent"
        >
          View portfolio
        </Link>
        <DataUpdated />
      </div>

      <HomeRiskGauge />

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Where are we in the cycle?</h2>
          <Link href="/cycles" className="text-xs font-medium text-accent hover:underline">
            Open cycles hub →
          </Link>
        </div>
        <CycleStrip />
        <p className="mt-2 text-xs text-muted">
          Theory silhouettes with a Live marker for where the calendar sits on each loop · educational · NFA
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Explore the desk</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {DESK_LINKS.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="group rounded-xl border border-border bg-card p-5 transition hover:border-accent hover:bg-accent/5"
            >
              <h3 className="font-semibold text-foreground group-hover:text-accent">{d.title} →</h3>
              <p className="mt-1 text-sm text-muted">{d.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      <MarketStrip />

      {/* Chart desk — relative returns overview */}
      <BtcFourYearChart />

      <section className="mt-12 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-foreground">Follow along</h2>
          <p className="mt-1 text-sm text-muted">I post chart updates and cycle notes on X.</p>
        </div>
        <a
          href="https://x.com/Dirindin533"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent hover:text-accent"
        >
          @Dirindin533 on X
        </a>
      </section>
    </div>
  );
}
