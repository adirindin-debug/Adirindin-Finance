import Link from "next/link";
import { MarketStrip } from "@/components/MarketStrip";
import { BtcFourYearChart } from "@/components/BtcFourYearChart";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        A research desk for market cycles.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Relative returns across assets, macro regimes, and cycle frameworks —
        process over noise. Educational only; not personal financial advice
        (NFA).
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/portfolio" className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white">
          View portfolio
        </Link>
        <a
          href="https://x.com/Dirindin533"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:border-accent hover:text-accent"
        >
          @Dirindin533 on X
        </a>
      </div>

      <MarketStrip />

      {/* Chart desk — relative returns overview */}
      <BtcFourYearChart />
    </div>
  );
}
