import type { Metadata } from "next";
import { ToolsBackLink } from "@/components/tools/ToolsBackLink";
import { RiskSentimentPanel } from "@/components/tools/RiskSentimentPanel";
import { COMPONENTS, MIN_WEIGHT_FOR_SCORE, ZONES } from "@/lib/riskSentiment";

export const metadata: Metadata = {
  title: "Market risk & sentiment gauge (preview)",
  description:
    "Transparent 0–100 blend of public price-risk, volatility, sentiment, search-attention and cycle-calendar inputs — from washout to euphoria-leaning. Theoretical study aid only, not a signal. Not financial advice (NFA).",
};

const COVERAGE: { input: string; from: string; note: string }[] = [
  {
    input: "MSCI World drawdown, daily + weekly RSI (primary)",
    from: "Jan 1990 (history from Jan 1985 for warm-up)",
    note: "Yahoo Finance ^990100-USD-STRD — the MSCI World Standard (price) index in US dollars, the same series as the homepage MSCI World line (delayed, third-party). Developed markets only, price index — no dividends, not ACWI, not net total return.",
  },
  {
    input: "S&P 500 drawdown, daily + weekly RSI (confirmation)",
    from: "Jan 1990 (history from Jan 1985 for warm-up)",
    note: "Yahoo Finance ^GSPC daily close (delayed, third-party). Price index — no dividends. Steps up to the full equity weight on any day MSCI World has no data.",
  },
  { input: "VIX 5-year percentile", from: "Jan 1990", note: "Cboe VIX close via FRED VIXCLS. First 5 years use the history available so far." },
  { input: "US stocks Fear & Greed", from: "Jan 2016", note: "FearGreedChart.com public API — independent methodology, not CNN's index." },
  { input: "Crypto Fear & Greed", from: "Feb 2018", note: "Alternative.me public API." },
  { input: 'Google Trends "bitcoin"', from: "Jan 2013", note: "Monthly, worldwide. Dated snapshot (unofficial endpoint, refreshed by hand — never scraped from production)." },
  { input: "BTC 4y + real estate 18y calendar", from: "Jan 2013", note: "Positions on the Adirindin theory silhouettes (Market cycles). Calendar frameworks, not data." },
];

const SKIPPED: { what: string; why: string }[] = [
  { what: 'Google Trends "stock market"', why: "Tested. It spikes in crashes (2008, Mar 2020) as well as booms, so its direction is ambiguous — left out rather than forced." },
  { what: "Reddit / X (Twitter) chatter", why: "Firehose access needs keys or paid APIs. Not scraped." },
  { what: "CNN Fear & Greed", why: "No documented public feed. The independent FearGreedChart.com series is used instead." },
  { what: "US 10-year bond secular regime", why: "A ~40-year regime is effectively constant across any window shown here, so it would only add a flat offset. Kept as context on Market cycles, not in the blend." },
];

export default function RiskSentimentPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolsBackLink category="Sentiment · preview" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Market risk &amp; sentiment gauge</h1>
        <span className="rounded border border-[#8a6a20] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d4a017]">
          Preview
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        One number for how hot or washed-out risk appetite looks, built from public price, volatility, sentiment and
        attention data plus a light touch of the Adirindin cycle calendars. Higher means hotter and more risk-on; lower
        means fear and washout. Scrub the history to see how past moods read.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        <strong className="font-medium text-foreground">Theoretical estimation and study aid only.</strong> Not a signal,
        not a timing model, and not financial advice (NFA).
      </p>

      <div className="mt-8">
        <RiskSentimentPanel />
      </div>

      <section className="mt-10 rounded-xl border border-border bg-card p-6" aria-labelledby="how-built">
        <h2 id="how-built" className="text-lg font-semibold text-foreground">
          How this is built
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Each input is turned into a 0–100 sub-score where higher = hotter. The composite is the weighted average of the
          sub-scores that have data on that day; missing inputs are dropped and the other weights re-scale to 100%. No
          gaps are filled with made-up values. If less than {MIN_WEIGHT_FOR_SCORE}% of the weight has data, no score is shown.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Equity price risk leans on <strong className="font-medium text-foreground">MSCI World</strong>, because it spans
          developed markets worldwide rather than the US alone. Each price measure is a pair: with both series available,
          MSCI World takes 80% of the pair and the S&amp;P 500 20% as a cross-check (all-time-high distance 20% + 5%,
          weekly RSI 12% + 3%, daily RSI 8% + 2%). On any day one series has no data, the other takes the pair&apos;s full
          share (25% / 15% / 10%), so the equity block stays at 50%.
        </p>
        <p className="mt-2 font-mono text-xs text-[#c8d0dc]">score = Σ (weightᵢ × subᵢ) ÷ Σ weightᵢ &nbsp;(over inputs with data)</p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-[#1d2633]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#0b1017] text-[10px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Input</th>
                <th className="px-3 py-2 font-semibold">Group</th>
                <th className="px-3 py-2 text-right font-semibold">Weight</th>
                <th className="px-3 py-2 font-semibold">Sub-score rule</th>
              </tr>
            </thead>
            <tbody>
              {COMPONENTS.map((c) => (
                <tr key={c.key} className="border-t border-[#141c27] align-top">
                  <td className="px-3 py-2 text-foreground">
                    <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden />
                    {c.label}
                  </td>
                  <td className="px-3 py-2 text-muted">{c.group}</td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {c.weight}%
                    {c.soloWeight ? (
                      <span className="block whitespace-nowrap text-[10px] font-normal text-muted">{c.soloWeight}% if alone</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 leading-relaxed text-muted">{c.how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Group totals: price risk 50% (MSCI World 40% · S&amp;P 500 10%) · volatility 15% · sentiment 20% · attention 5% ·
          cycle calendar 10% (kept light on purpose — frameworks, not measurements).
        </p>

        <h3 className="mt-6 text-sm font-semibold text-foreground">Zones</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-5">
          {ZONES.map((z) => (
            <div key={z.key} className="rounded-lg border border-[#1d2633] bg-black/40 p-3">
              <p className="text-sm font-semibold" style={{ color: z.color }}>
                {z.label}
              </p>
              <p className="font-mono text-[11px] text-muted">
                {z.min}–{z.max}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted">{z.blurb}</p>
            </div>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-semibold text-foreground">Mood arc</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          The arc is an Adirindin sketch of how crowd mood tends to loop: washout, repair, a grind higher, a hot market,
          euphoria-leaning, then cracks, cooling and an unwind. The dot&apos;s height is the score; it sits on the rising
          side when the score is at or above its level about three months earlier and on the falling side when below. It
          describes where readings are, not where they go next.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Sources &amp; coverage</h2>
          <ul className="mt-3 space-y-3">
            {COVERAGE.map((c) => (
              <li key={c.input} className="text-sm">
                <p className="text-foreground">
                  {c.input} <span className="font-mono text-[11px] text-muted">· from {c.from}</span>
                </p>
                <p className="text-xs leading-relaxed text-muted">{c.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Live feeds are cached for about an hour. Each feed falls back on its own to a dated snapshot bundled with the
            site; the chips under the chart show which is in use and how current it is.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Considered and left out</h2>
          <ul className="mt-3 space-y-3">
            {SKIPPED.map((s) => (
              <li key={s.what} className="text-sm">
                <p className="text-foreground">{s.what}</p>
                <p className="text-xs leading-relaxed text-muted">{s.why}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Known gaps: the blend has fewer inputs before 2016 (and before 2013 it is price and VIX only), so older
            readings are not like-for-like with recent ones. MSCI World covers developed markets only (no emerging markets)
            and, like the S&amp;P 500, is a price index without dividends. VIX and the US Fear &amp; Greed score are still
            US-centric. Trends data is monthly and lags by up to a month.
          </p>
        </div>
      </section>

      <aside className="mt-8 rounded-xl border border-[#3a4558] bg-[#121820] px-5 py-4" role="note" aria-label="Not financial advice">
        <p className="text-sm font-semibold text-[#d0d8e4]">Study aid, not a signal</p>
        <p className="mt-1.5 text-xs leading-relaxed text-[#9eb0c8] sm:text-sm">
          This gauge is a theoretical estimate assembled for research and education. Weights are judgement calls, the
          inputs overlap, and hot readings can stay hot (and washouts can deepen) for a long time. It does not tell anyone
          to buy, sell or hold anything. Past readings do not guarantee future results. Not financial advice (NFA).
          Fear &amp; Greed and index names belong to their owners; no affiliation or endorsement implied.
        </p>
      </aside>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · @Dirindin533 / Adirindin Finance.
      </p>
    </div>
  );
}
