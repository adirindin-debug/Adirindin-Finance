import Link from "next/link";
import { MarketStrip } from "@/components/MarketStrip";
import { BtcFourYearChart } from "@/components/BtcFourYearChart";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Adirindin Finance
      </p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        A research desk for cycles, relative returns, and the book.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Bitcoin against the indices, the live portfolio, and Australian property
        prints — process over noise. Educational only; not personal financial
        advice (NFA).
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/portfolio" className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white">
          View portfolio
        </Link>
      </div>

      <MarketStrip />

      {/* Chart desk — BTC returns overview */}
      <BtcFourYearChart />
    </div>
  );
}
