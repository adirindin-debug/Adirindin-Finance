import Link from "next/link";
import { MarketStrip } from "@/components/MarketStrip";
import { BtcFourYearChart } from "@/components/BtcFourYearChart";
import { BtcCycleFrame } from "@/components/BtcCycleFrame";
import RealEstateCycleChart from "@/components/RealEstateCycleChart";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Markets research · Australia
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Clear thinking on markets for investors who read carefully.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Adirindin Finance publishes markets research and finance commentary — process over noise.
        Scroll the chart desk below for the live BTC overview, full cycle map, and real-estate cycle
        schematic. Educational content only; not personal financial advice.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/dashboard" className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white">
          Open cycle desk
        </Link>
        <Link
          href="/research"
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm text-foreground"
        >
          Research
        </Link>
        <Link
          href="/approach"
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm text-foreground"
        >
          Approach
        </Link>
      </div>

      <MarketStrip />

      {/* Chart desk — scrollable stack of all current maps */}
      <BtcFourYearChart />

      <section className="mt-14" aria-label="BTC cycle map">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            BTC + MSTR cycle map
          </h2>
          <p className="text-xs text-muted">
            Full tops &amp; bottoms · interactive ·{" "}
            <Link href="/dashboard/btc-cycle" className="text-accent hover:underline">
              open desk
            </Link>
          </p>
        </div>
        <BtcCycleFrame compact />
      </section>

      <section className="mt-14" aria-label="Real estate cycle">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
            ~18 / 18.6y real estate cycle
          </h2>
          <p className="text-xs text-muted">
            Schematic study frame ·{" "}
            <Link href="/tools/real-estate-cycle" className="text-accent hover:underline">
              full RE page
            </Link>
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-black p-4 sm:p-6">
          <RealEstateCycleChart />
        </div>
        <p className="mt-3 text-xs text-muted">
          Classic land / property cycle framing used in research communities — educational observation
          only, not a forecast. NFA.
        </p>
      </section>
    </div>
  );
}
