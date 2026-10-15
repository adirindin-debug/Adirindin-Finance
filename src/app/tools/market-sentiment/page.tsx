import Link from "next/link";
import type { Metadata } from "next";
import { MarketSentimentPanel } from "@/components/tools/MarketSentimentPanel";
import { HYSTERESIS_PTS, INPUTS, MIN_WEIGHT, STRETCH_AT, STRETCH_NEEDED, VALUATION_CAP, WATCH_CONDITIONS, WATCH_NEEDED, WATCH_SCORE, ZONES, zoneLine } from "@/lib/marketSentiment";
import { SEASON_HEADWIND_AT, SEASON_TAILWIND_AT } from "@/lib/riskSentiment";
import { MobileViewHint } from "@/components/ui/MobileViewHint";

export const metadata: Metadata = {
  title: "Market sentiment gauge",
  description:
    "A calm 0–100 overview of market sentiment built only from public sources — OFR Financial Stress Index, Chicago Fed NFCI, St. Louis Fed financial stress, Alternative.me Crypto Fear & Greed, OECD global breadth and seasonality. Rough backdrop reading, not a signal. ",
};

export default function RiskSentimentPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <MobileViewHint />
      <div className="mb-3">
        <Link href="/" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 px-3.5 py-1.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent/20 hover:text-foreground">
          ← Back to Home
        </Link>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Market sentiment gauge</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        A rough overview of the market backdrop on one 0–100 scale: higher means calmer financial conditions and firmer
        risk appetite, lower means more stress. It is built only from public sources that can be shown openly, and it
        moves slowly on purpose — a ~2-month average by default, so it shows the broad mood rather than day-to-day noise.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        <strong className="font-medium text-foreground">Study aid only.</strong> In past testing it showed no edge for
        calling market direction — it describes a rough versus calm backdrop.
      </p>
      <p id="disclaimer" className="mt-2 max-w-3xl scroll-mt-24 text-xs leading-relaxed text-muted">This information is general in nature and does not take into account your objectives, financial situation or needs. Consider whether it is appropriate for you and seek independent advice before acting.</p>

      <div className="mt-8">
        <MarketSentimentPanel />
      </div>

      <section className="mt-10 rounded-xl border border-border bg-card p-6" aria-labelledby="how-built">
        <h2 id="how-built" className="text-lg font-semibold text-foreground">
          How it’s drawn
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Each input becomes a 0–100 sub-score where higher = calmer / hotter. Stress and financial-conditions indices are
          ranked against their own prior history (5 years for the daily OFR series, 10 years for the weekly Fed series)
          using only values before each date, then flipped so low stress reads high. The score is the weighted average of
          the inputs with data that day; missing inputs drop out and the others re-scale. Nothing is filled in, and no score
          is shown if less than {MIN_WEIGHT}% of the weight has data.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="font-medium text-foreground">Smoothing.</strong> The big number and line show a ~2-month
          (42-session) exponential average of the daily blend by default; a 10-day average and the raw daily blend are one
          tap away. The zone label only changes once the score is {HYSTERESIS_PTS} points past a zone line, so it doesn’t
          flick back and forth near a boundary. Over the last three years this cut day-to-day movement by about half and
          zone changes by about a third versus the previous design.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="font-medium text-foreground">Seasonality.</strong> This month’s historical average S&amp;P 500
          return and green-month odds versus an average month, in standard errors, using only months completed before the
          date. The tag reads Historically stronger month at {SEASON_TAILWIND_AT}+ and Historically weaker month at {SEASON_HEADWIND_AT} or
          below (Historically average month in between). Past monthly averages only, not a forecast.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="font-medium text-foreground">Valuation cap.</strong> Rich equity valuations on their own
          should not push the score toward Euphoria-leaning. The equity-valuation sub-score is capped at {VALUATION_CAP} unless
          at least {STRETCH_NEEDED} of volatility, credit, NFCI and breadth also read {STRETCH_AT} or more.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="font-medium text-foreground">Complacency watch (info only).</strong> A plain grey note shown only when the
          score is {WATCH_SCORE} or more and at least {WATCH_NEEDED} of these hold: {WATCH_CONDITIONS.map((c) => c.label.charAt(0).toLowerCase() + c.label.slice(1)).join("; ")}.
          It describes a calm, stretched backdrop for information only — in testing it was not a reliable top signal. Global breadth carries 5% because its monthly, lagged data added little at turning points.
        </p>
        <p className="mt-2 font-mono text-xs text-[#c8d0dc]">score = Σ (weightᵢ × subᵢ) ÷ Σ weightᵢ &nbsp;(over inputs with data)</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#1d2633]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#0b1017] text-[10px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Input</th>
                <th className="px-3 py-2 text-right font-semibold">Weight</th>
                <th className="px-3 py-2 font-semibold">Sub-score rule</th>
              </tr>
            </thead>
            <tbody>
              {INPUTS.map((c) => (
                <tr key={c.key} className="border-t border-[#141c27] align-top">
                  <td className="px-3 py-2 text-foreground">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                    {c.label}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">{c.weight}%</td>
                  <td className="px-3 py-2 leading-relaxed text-muted">{c.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">Zones describe conditions, not signals to buy or sell.</p>
        <ul className="mt-2 grid gap-1.5 text-xs text-muted sm:grid-cols-2">
          {ZONES.map((z) => (
            <li key={z.key} className="flex items-start gap-2">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: z.color }} aria-hidden />
              <span>
                <span className="font-medium" style={{ color: z.color }}>
                  {z.label}
                </span>{" "}
                ({z.min}–{z.max}): {zoneLine(z)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6" aria-labelledby="sources">
        <h2 id="sources" className="text-lg font-semibold text-foreground">
          Sources and credits
        </h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-[#1d2633]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#0b1017] text-[10px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Input</th>
                <th className="px-3 py-2 font-semibold">Source</th>
                <th className="px-3 py-2 font-semibold">Licence / use</th>
                <th className="px-3 py-2 font-semibold">Credit</th>
              </tr>
            </thead>
            <tbody>
              {INPUTS.map((c) => (
                <tr key={c.key} className="border-t border-[#141c27] align-top">
                  <td className="px-3 py-2 text-foreground">{c.short}</td>
                  <td className="px-3 py-2">
                    <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {c.source}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-muted">{c.licence}</td>
                  <td className="px-3 py-2 text-muted">{c.credit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          <strong className="font-medium text-foreground">Base chart (context only).</strong> The faint S&amp;P 500,
          Nasdaq Composite or URTH line under the score is delayed third-party daily price data. Source:{" "}
          <a href="https://finance.yahoo.com/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Yahoo Finance
          </a>{" "}
          (^GSPC, ^IXIC, URTH daily closes). It is not part of the score and is off by default; turn it on with the base-chart toggle.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          FRED® series are retrieved from FRED, Federal Reserve Bank of St. Louis. This site is not endorsed by the Federal
          Reserve Bank of St. Louis, the Federal Reserve Bank of Chicago, the Office of Financial Research, the OECD or Alternative.me.
          Not used any more: VIX (Cboe licence), Moody’s BAA spreads (Moody’s licence), US stocks Fear &amp; Greed, Google
          Trends and the cycle-calendar inputs (theory, kept on the cycle pages).
        </p>
      </section>
    </div>
  );
}
