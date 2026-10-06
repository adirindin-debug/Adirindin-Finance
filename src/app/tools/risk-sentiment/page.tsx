import type { Metadata } from "next";
import { ToolsBackLink } from "@/components/tools/ToolsBackLink";
import { RiskSentimentPanel } from "@/components/tools/RiskSentimentPanel";
import {
  COMPONENTS,
  MIN_WEIGHT_FOR_SCORE,
  SEASON_HEADWIND_AT,
  SEASON_MIN_YEARS,
  SEASON_POINTS_PER_SE,
  SEASON_TAILWIND_AT,
  ZONES,
  type ComponentMeta,
} from "@/lib/riskSentiment";

export const metadata: Metadata = {
  title: "Market risk & sentiment gauge",
  description:
    "Transparent 0–100 blend of public price-risk, volatility, sentiment, search-attention, cycle-calendar and seasonality inputs — from washout to euphoria-leaning. Theoretical study aid only, not a signal. Not financial advice (NFA).",
};

const COVERAGE: { input: string; from: string; note: string }[] = [
  {
    input: "URTH drawdown, daily + weekly RSI (primary)",
    from: "Jan 2012 (URTH listing)",
    note: "Yahoo Finance URTH adjusted close — the iShares MSCI World ETF, used as a developed-markets proxy (same pattern as global equities / seasonality). Not the licensed MSCI index series. Dividends reinvested, after ETF fees.",
  },
  {
    input: "S&P 500 drawdown, daily + weekly RSI (confirmation)",
    from: "Jan 1990 (history from Jan 1985 for warm-up)",
    note: "Yahoo Finance ^GSPC daily close (delayed, third-party). Price index — no dividends. Steps up to the full equity weight on any day URTH has no data (including before URTH history ~Jan 2012).",
  },
  {
    input: "Nasdaq Composite (base chart only)",
    from: "Jan 1990",
    note: "Yahoo Finance ^IXIC daily close (delayed, third-party). Price index — no dividends. Drawn as an optional base chart under the score; not an input to the score.",
  },
  { input: "VIX 5-year percentile", from: "Jan 1990", note: "Cboe VIX close via FRED VIXCLS. First 5 years use the history available so far." },
  { input: "US stocks Fear & Greed", from: "Jan 2016", note: "FearGreedChart.com public API — independent methodology, not CNN's index." },
  { input: "Crypto Fear & Greed", from: "Feb 2018", note: "Alternative.me public API." },
  { input: 'Google Trends "bitcoin"', from: "Jan 2013", note: "Monthly, worldwide. Dated snapshot (unofficial endpoint, refreshed by hand — never scraped from production)." },
  { input: "BTC 4y + real estate 18y calendar", from: "Jan 2013", note: "Positions on the Adirindin theory silhouettes (Market cycles). Calendar frameworks, not data." },
  {
    input: "Seasonality (calendar month)",
    from: "Jan 1990 (month history from Jan 1950)",
    note: "Derived from the equity base above — URTH adjusted-close monthly returns from Feb 2012, S&P 500 (^GSPC) before that. S&P month-ends before 1985 come from the Seasonality page's dataset (Yahoo ^GSPC from Dec 1949). Expanding window: each date only sees months completed before it.",
  },
];

/** Weight per group, e.g. price risk 45. */
function groupTotals(): Array<{ group: ComponentMeta["group"]; weight: number }> {
  const out: Array<{ group: ComponentMeta["group"]; weight: number }> = [];
  for (const c of COMPONENTS) {
    const g = out.find((x) => x.group === c.group);
    if (g) g.weight += c.weight;
    else out.push({ group: c.group, weight: c.weight });
  }
  return out.map((g) => ({ ...g, weight: Math.round(g.weight * 10) / 10 }));
}

const SKIPPED: { what: string; why: string }[] = [
  { what: 'Google Trends "stock market"', why: "Tested. It spikes in crashes (2008, Mar 2020) as well as booms, so its direction is ambiguous — left out rather than forced." },
  { what: "Reddit / X (Twitter) chatter", why: "Firehose access needs keys or paid APIs. Not scraped." },
  { what: "CNN Fear & Greed", why: "No documented public feed. The independent FearGreedChart.com series is used instead." },
  { what: "US 10-year bond secular regime", why: "A ~40-year regime is effectively constant across any window shown here, so it would only add a flat offset. Kept as context on Market cycles, not in the blend." },
];

export default function RiskSentimentPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolsBackLink category="Sentiment" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Market risk &amp; sentiment gauge</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        One number for how hot or washed-out risk appetite looks, built from public price, volatility, sentiment and
        attention data, a seasonality read on the calendar month, plus a light touch of the Adirindin cycle calendars. Higher means hotter and more risk-on; lower
        means fear and washout. Scrub the history to see how past moods read.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        <strong className="font-medium text-foreground">Theoretical estimation and study aid only.</strong> Not a signal,
        not a timing model, and not financial advice (NFA). Past readings and past performance do not predict future
        results.
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
          Equity price risk leans on <strong className="font-medium text-foreground">URTH</strong> (iShares MSCI World ETF
          proxy for developed markets) rather than the US alone — the same series as global equities and seasonality, not
          the licensed MSCI index. Each price measure is a pair: with both series available, URTH takes 80% of the pair and
          the S&amp;P 500 20% as a cross-check (all-time-high distance 18% + 4.5%, weekly RSI 10.8% + 2.7%, daily RSI 7.2%
          + 1.8%). On any day one series has no data (including before URTH history ~Jan 2012), the other takes the
          pair&apos;s full share (22.5% / 13.5% / 9%), so the equity block stays at 45%.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted" data-season-method>
          <strong className="font-medium text-foreground">Seasonality (10%).</strong> Some calendar months have
          historically been stronger than others. For each date the gauge takes that calendar month&apos;s average return
          and green-month odds on the same equity base — URTH monthly returns where URTH has them (from Feb 2012), the
          S&amp;P 500 before that, back to 1950 — using <em>only months completed before the date</em>, so history is
          never scored with hindsight. Each figure is compared with the average across all prior months and measured in
          standard errors, so a thin or noisy record counts for less: 50 is an average month, and each half (return,
          odds) moves {SEASON_POINTS_PER_SE} points per standard error, capped 0–100. A month needs at least{" "}
          {SEASON_MIN_YEARS} prior years before it is scored. The tag next to the score reads{" "}
          <span className="text-[#3dcc9a]">Seasonal tailwind</span> at {SEASON_TAILWIND_AT}+,{" "}
          <span className="text-[#f0883e]">Seasonal headwind</span> at {SEASON_HEADWIND_AT} or below, and seasonally
          neutral in between, with the points it adds or takes away vs an average month. Adding seasonality scaled every
          other weight by 0.9, so their ratios to each other are unchanged. Seasonal tendencies are averages across many
          years and any single month can buck them.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="font-medium text-foreground">Base chart.</strong> The line under the score history is a
          price overlay you can switch between the S&amp;P 500 (default), the Nasdaq Composite and URTH. Each is drawn on
          its own log scale for visual context. Switching it does not change the score or the weights above — the
          composite always uses the URTH / S&amp;P 500 pair as described.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          <strong className="font-medium text-foreground">Smoothing.</strong> The daily composite can jump a few points
          on one-day moves (a VIX pop, a Fear &amp; Greed swing), which made the mood zones twitchy. By default the
          score line, big number, zone and mood arc show a 10-trading-day exponential moving average (EMA) of the daily
          composite: recent days count most and older days fade out. 5- and 21-day versions are there too, and{" "}
          <em>Raw</em> shows each day exactly as computed. Over the last ten years the 10-day average cuts zone changes
          by roughly two-thirds and trails real turns by about three sessions. Smoothing is display-only — it does not
          change any input, weight or the day&apos;s raw blend, which the breakdown table always shows.
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
          Group totals:{" "}
          {groupTotals()
            .map((g) =>
              g.group === "Price risk"
                ? `price risk ${g.weight}% (URTH 36% · S&P 500 9%)`
                : `${g.group.toLowerCase()} ${g.weight}%`,
            )
            .join(" · ")}
          . Cycle calendars are kept light on purpose — frameworks, not measurements.
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
            readings are not like-for-like with recent ones. Before URTH (~Jan 2012) the equity block is S&amp;P-only via
            the pair logic. URTH is a developed-markets ETF proxy (no emerging markets; after fees, dividends reinvested)
            — not the licensed MSCI index series. VIX and the US Fear &amp; Greed score are still US-centric. Trends data
            is monthly and lags by up to a month. Seasonality is mostly S&amp;P 500 history (URTH only covers 2012 on),
            so it is US-leaning too.
          </p>
        </div>
      </section>

      <aside className="mt-8 rounded-xl border border-[#3a4558] bg-[#121820] px-5 py-4" role="note" aria-label="Not financial advice">
        <p className="text-sm font-semibold text-[#d0d8e4]">Study aid, not a signal · not financial advice</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#9eb0c8] sm:text-sm">
          <li>
            This gauge is a theoretical estimate assembled for research and education. It is not a buy, sell or hold
            signal, not a timing model and not a forecast of where markets go next.
          </li>
          <li>
            Weights are judgement calls, the inputs overlap, and hot readings can stay hot (and washouts can deepen) for a
            long time. A reading in any zone can be followed by gains or losses.
          </li>
          <li>
            Past readings and past performance are not reliable indicators of future performance. The base chart shows
            historical prices for context only.
          </li>
          <li>
            Data is delayed, third-party and may contain errors or gaps. Nothing here considers your objectives, financial
            situation or needs — it is general information only, not personal financial advice (NFA). Consider getting
            advice from a licensed professional before acting.
          </li>
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-[#7f8ea3]">
          Fear &amp; Greed, index and ETF names belong to their owners; no affiliation or endorsement implied.
        </p>
      </aside>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · @Dirindin533 / Adirindin Finance.
      </p>
    </div>
  );
}
