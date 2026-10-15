import Link from "next/link";
import { MarketStrip } from "@/components/MarketStrip";
import { BtcFourYearChart } from "@/components/BtcFourYearChart";
import { CycleStrip } from "@/components/cycles/CyclesHub";
import { HomeRiskGauge } from "@/components/home/HomeRiskGauge";
import { DataUpdated } from "@/components/home/DataUpdated";
import { DeskTag, HowDrawn } from "@/components/home/DeskTag";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        A research desk for market cycles.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Charts and cycle ideas I made for myself, shared for anyone curious.
        Educational only — not financial advice (NFA).
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
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
      <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted">
        <DeskTag kind="live" /> = real market data ·
        <DeskTag kind="theory" /> = a cycle idea for context, not a forecast
      </p>

      <HomeRiskGauge />

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Cycle theories for context (not forecasts)</h2>
          <Link href="/cycles" className="text-xs font-medium text-accent hover:underline">
            Open cycles hub →
          </Link>
        </div>
        <CycleStrip />
        <HowDrawn>
          theory shapes, not prices. The dot marks today’s date on each one.
        </HowDrawn>
      </section>

      {/* Centrepiece: relative price chart */}
      <div className="mt-12 rounded-2xl border border-border bg-[#0d1218] p-4 sm:p-6">
        <BtcFourYearChart />
        <HowDrawn>
          every line starts at 0% at the start of the window. Sources: Coinbase, Yahoo Finance,
          FHFA, BIS and FRED® (Federal Reserve Bank of St. Louis).
        </HowDrawn>
        <MarketStrip />
      </div>

      <p className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="text-muted">More on the desk:</span>
        <Link href="/charts" className="text-accent hover:underline">Charts</Link>
        <Link href="/tools" className="text-accent hover:underline">Tools</Link>
        <Link href="/dashboard/btc-cycle" className="text-accent hover:underline">BTC cycle desk</Link>
        <Link href="/research" className="text-accent hover:underline">Research</Link>
      </p>

      <section className="mt-10 flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <p className="text-sm text-muted">Chart updates and cycle notes on X.</p>
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
