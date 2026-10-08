import type { Metadata } from "next";
import Link from "next/link";
import { CyclesBackLink } from "@/components/cycles/CyclesBackLink";
import GoldCycleChart from "@/components/GoldCycleChart";
import {
  GOLD_PEAK_ANCHORS,
  GOLD_CYCLE_YEARS,
  GOLD_DECLINE_YEARS,
  GOLD_RANGE_YEARS,
  GOLD_TROUGH_OFFSET_YEARS,
} from "@/lib/goldCommodityCycle";
import { MobileViewHint } from "@/components/ui/MobileViewHint";

const DROP_Y = "4–" + GOLD_DECLINE_YEARS;
const RANGE_Y = Math.round(GOLD_RANGE_YEARS);

export const metadata: Metadata = {
  title: "46-year gold-led commodity cycle sketch",
  description:
    "Observational study of a ~46-year gold-led commodity cycle with peak-zone markers at Jan 1934, 1980, 2026 and 2072, drawn as one repeating lap shape. The long-run USD gold price chart lives in Charts → Commodity charts. Educational only — not a predictive model, not Kondratiev-as-law, not financial advice.",
};

const PHASES = [
  {
    name: "Post-peak decline",
    years: `Peak zone → peak + ${GOLD_DECLINE_YEARS}y · ~${DROP_Y} years`,
    color: "#b8333d",
    summary:
      "The first ~4–8 years after each peak-zone marker: the silhouette's sharp drop from the top (about the first 4 years) and the early part of the drift, up to peak + 8 years. A sketch boundary, not a forecast.",
  },
  {
    name: "Range-bound zone",
    years: `Drift into the trough zone · ~${RANGE_Y}y`,
    color: "#9a8fb8",
    summary:
      "Most of the drawdown: an extended down-sideways drift with a rebound hump and a smaller later hump, grinding into a trough zone about 20 years after the peak (~1954, ~2000, ~2046*, ~2092*). The 1934→1954 stretch sits in the US$35 peg era, so it is a model position, not a market low.",
  },
  {
    name: "Advance from trough",
    years: "Trough zone → mid-run correction · ~17y",
    color: "#3dcc9a",
    summary:
      "The main multi-year advance in the gold-led commodity story, ending in a sharp mid-run correction (shoulder) in the third quarter of the lap. Historically this is where free-market gold made its large secular moves — still an observation, not a signal.",
  },
  {
    name: "Final run → peak zone",
    years: "Into the next Jan marker · ~9y",
    color: "#f0c14a",
    summary:
      "Final advance into the next peak-zone calendar marker. 2026 is under study as a zone, not a guaranteed top; 2072 is theoretical from the ~46-year spacing.",
  },
] as const;

export default function GoldCyclePage() {
  const anchors = GOLD_PEAK_ANCHORS.join(" · ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <MobileViewHint />
      <CyclesBackLink category="Gold" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        46-year gold-led commodity cycle sketch
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Observational study of a roughly{" "}
        <strong className="font-medium text-foreground">{GOLD_CYCLE_YEARS}-year</strong>{" "}
        gold-led commodity rhythm, reading public gold history alongside a repeating
        illustrative silhouette. Peak-zone markers sit at{" "}
        <strong className="font-medium text-foreground">Jan {anchors}</strong>
        . The long-run gold price in US dollars (log scale) now sits on{" "}
        <Link href="/charts/commodities" className="text-accent hover:underline">
          Commodity charts
        </Link>
        . Kondratiev /
        long-wave literature is context only — this page is{" "}
        <strong className="font-medium text-foreground">
          not “the Kondratiev law”
        </strong>
        ,{" "}
        <strong className="font-medium text-foreground">not a predictive model</strong>
        , not a valuation model, and not a timing signal.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        One silhouette repeats on every ~{GOLD_CYCLE_YEARS}-year lap, like the bond,
        real estate and Bitcoin cycle charts: peak zone → post-peak decline (~{DROP_Y} years)
        → range-bound zone (~{RANGE_Y}y) → trough zone (~{GOLD_TROUGH_OFFSET_YEARS}y after the
        peak) → advance with a mid-run correction → final run into the next peak zone. The Live marker moves with today’s
        date — observation of the charts, not a forecast.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-black p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Classic cycle diagram
          </h2>
          <span className="font-mono text-xs text-muted">
            ≈ {GOLD_CYCLE_YEARS} years · schematic · NFA
          </span>
        </div>

        <GoldCycleChart />

        <p className="mt-4 text-xs text-muted sm:text-sm">
          Looking for the gold price itself (with the 15 Aug 1971 marker)? See{" "}
          <Link href="/charts/commodities" className="text-accent hover:underline">
            Charts → Commodity charts
          </Link>{" "}
          — gold, silver, copper, nickel, lithium and iron ore from public sources.
        </p>

        <aside
          className="mt-5 rounded-lg border border-[#3a4558] bg-[#121820] px-4 py-3"
          role="note"
          aria-label="Sketch disclaimer"
        >
          <p className="text-sm font-semibold text-[#d0d8e4]">
            Observational sketch — caveats
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#9eb0c8] sm:text-sm">
            <li>
              <strong className="font-medium text-[#d0d8e4]">1934</strong> is a
              revaluation / policy-era marker (US official price to $35/oz), not a
              free-market peak like 1980.
            </li>
            <li>
              <strong className="font-medium text-[#d0d8e4]">2026</strong> is a calendar
              peak-<em>zone</em> marker under study — not a guaranteed top.
            </li>
            <li>
              <strong className="font-medium text-[#d0d8e4]">2072*</strong> is theoretical
              from the ~{GOLD_CYCLE_YEARS}-year spacing. The silhouette is shape language
              only — not a USD price path.
            </li>
            <li>
              <strong className="font-medium text-[#d0d8e4]">15 Aug 1971</strong> marks the
              Nixon Shock — end of Bretton Woods dollar convertibility into gold (the usual
              public date for the US leaving the gold standard). Historical context only; not
              a cycle peak or trough zone.
            </li>
            <li>
              <strong className="font-medium text-[#d0d8e4]">Trough zones</strong> (~1954,
              ~2000, ~2046*, ~2092*) come from the repeating shape (~{GOLD_TROUGH_OFFSET_YEARS}y after
              each peak), not separate anchors. ~2000 lines up with the 1999–2001 low; ~1954
              is peg-era model position only.
            </li>
            <li>
              Research / educational purposes only.{" "}
              <strong className="font-medium text-[#d0d8e4]">Not financial advice (NFA)</strong>.
            </li>
          </ul>
        </aside>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PHASES.map((p) => (
          <article key={p.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: p.color }}
                aria-hidden
              />
              <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
              <span className="ml-auto font-mono text-[10px] text-muted sm:text-xs">
                {p.years}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{p.summary}</p>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Attribution &amp; sources</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This page does not claim a new natural law. It is an observational study of
          public gold history with a repeating illustrative ~{GOLD_CYCLE_YEARS}-year
          silhouette, used for study at Adirindin. Longer-wave writers (including
          Kondratiev and later long-wave interpreters) are cited only as{" "}
          <strong className="font-medium text-foreground">context</strong> — different
          clocks, different claims. We do not clone third-party paid cycle product art.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Gold price series (now on{" "}
          <Link href="/charts/commodities" className="text-accent hover:underline">
            Commodity charts
          </Link>
          ): long-run USD gold from the public{" "}
          <code className="text-xs text-foreground/80">datasets/gold-prices</code>{" "}
          monthly file (historical / official prints in the peg era; market prints
          thereafter), refreshed with Yahoo Finance <code className="text-xs text-foreground/80">GC=F</code>{" "}
          where available. Peg steps such as ~$20.67 and ~$35 are documented public
          series values — not invented. That chart updates as new price data comes in.
          Educational study aid only · not a predictive model · not financial advice.
        </p>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · not a predictive model
        · no price targets or forecasts · @Dirindin533 / Adirindin Finance. Past
        patterns do not guarantee future results.
      </p>
    </div>
  );
}
