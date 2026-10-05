import type { Metadata } from "next";
import { ToolsBackLink } from "@/components/tools/ToolsBackLink";
import { CompoundInterestPanel } from "@/components/tools/CompoundInterestPanel";
import { DEFAULT_INFLATION_PCT } from "@/lib/compoundInterest";

export const metadata: Metadata = {
  title: "Compound interest calculator",
  description:
    "Project savings with an initial deposit and regular contributions at any rate — or at a real asset's historical growth rate (CAGR) from its ticker. Optional inflation view. Illustrative only, not financial advice (NFA).",
};

export default function CompoundInterestPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolsBackLink category="Calculators" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Compound interest calculator</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        See how a starting balance and regular contributions could grow over time. Type any annual rate — there is no
        cap — or pick a real asset by ticker and project with its actual historical growth rate. Leave any field blank
        and it simply counts as zero.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        <strong className="font-medium text-foreground">A rough gauge for study.</strong> Projections are illustrative,
        not a forecast and not financial advice (NFA). A ticker&apos;s growth rate is what it did in the past — not what
        it will do next.
      </p>

      <div className="mt-8">
        <CompoundInterestPanel />
      </div>

      <section className="mt-10 rounded-xl border border-border bg-card p-6" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-lg font-semibold text-foreground">
          How it works
        </h2>
        <div className="mt-3 grid gap-6 md:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Compounding</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Growth is credited monthly or yearly on the balance held through each period. Contributions land at the end
              of each weekly, fortnightly, monthly or annual period (so weekly deposits fall four or five to a month). A
              manual rate is treated like a bank rate — split evenly across compounding periods.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Asset ticker (historical CAGR)</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Daily adjusted closes from Yahoo Finance (dividends and splits included where Yahoo provides them; indices
              such as ^GSPC are price-only). CAGR = (last close ÷ first close in the window)
              <sup>1 ÷ years</sup> − 1. The lookback can&apos;t reach past the first date with real data for that ticker.
              The CAGR is applied as an effective yearly rate, so monthly compounding doesn&apos;t inflate it. Rates are in
              the asset&apos;s own currency.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Inflation (optional)</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Off by default. When on, each year&apos;s balance is divided by (1 + inflation)<sup>years</sup> to show
              roughly what it buys in today&apos;s dollars. The default {DEFAULT_INFLATION_PCT}% p.a. is the middle of the
              Reserve Bank of Australia&apos;s 2–3% target and close to Australia&apos;s average annual CPI since inflation
              targeting began in 1993 (ABS). Override it with any figure.
            </p>
          </div>
        </div>
        <p className="mt-4 font-mono text-xs text-[#c8d0dc]">
          balance<sub>k</sub> = balance<sub>k−1</sub> × (1 + i) + deposits<sub>k</sub> &nbsp;·&nbsp; i = rate ÷ n (manual) or
          (1 + CAGR)<sup>1/n</sup> − 1 (ticker)
        </p>
      </section>

      <aside className="mt-8 rounded-xl border border-[#3a4558] bg-[#121820] px-5 py-4" role="note" aria-label="Not financial advice">
        <p className="text-sm font-semibold text-[#d0d8e4]">Illustrative, not advice</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#9eb0c8] sm:text-sm">
          <li>
            This calculator is a theoretical, educational estimate. It assumes a smooth, constant rate every year, which
            real investments never deliver — markets fall as well as rise, sometimes for years.
          </li>
          <li>
            A ticker&apos;s CAGR is a historical figure for the window shown, not a forecast or an expected return. A
            different lookback can give a very different rate. Past performance is not a reliable indicator of future
            performance.
          </li>
          <li>
            Fees, taxes, currency moves, inflation (unless switched on) and the timing of contributions are simplified or
            not modelled. Ticker data is delayed, third-party and may contain errors.
          </li>
          <li>
            It does not tell anyone to buy, sell or hold anything and does not consider your objectives, financial
            situation or needs. General information only — not personal financial advice (NFA). Consider getting advice
            from a licensed professional before acting.
          </li>
        </ul>
      </aside>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · @Dirindin533 / Adirindin Finance.
      </p>
    </div>
  );
}
