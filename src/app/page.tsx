import Link from "next/link";
import { MarketStrip } from "@/components/MarketStrip";
import { BtcFourYearChart } from "@/components/BtcFourYearChart";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Markets research
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Clear thinking on markets for investors who read carefully.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Adirindin Finance publishes markets research and finance commentary — process over noise.
        Scroll below for the live market strip and BTC returns chart, or explore the portfolio.
        Educational content only; not personal financial advice.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/portfolio" className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white">
          View portfolio
        </Link>
        <Link
          href="/research"
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm text-foreground"
        >
          Research
        </Link>
      </div>

      <MarketStrip />

      {/* Chart desk — BTC returns overview */}
      <BtcFourYearChart />
    </div>
  );
}
