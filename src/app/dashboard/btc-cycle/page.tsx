import type { Metadata } from "next";
import Link from "next/link";
import { BtcCycleFrame } from "@/components/BtcCycleFrame";

export const metadata: Metadata = {
  title: "BTC 4 year cycle theory",
  description:
    "Educational Bitcoin 4-year cycle theory framing: protocol halvings (~every 210,000 blocks / historically ~every 4 years), rough ~3-year up / ~1-year down observation, and an open question on causality. Not a predictive model or financial advice.",
};

/**
 * Segment cards for the rough 4-year Bitcoin cycle framing.
 * Durations are approximate study aids only — not a timing model.
 */
const SEGMENTS = [
  {
    name: "~3-year bull",
    duration: "~3 years · expansion stretch",
    color: "#3dcc9a",
    summary:
      "Historically, risk-on stretches after major bottoms have often lasted on the order of a few years — roughly framed as about ~3 years of expansion before a larger reset. Liquidity, leverage, and sentiment usually amplify the later part of this stretch. Treat the length as an approximate study aid, not a stopwatch.",
  },
  {
    name: "~1-year bear",
    duration: "~1 year · drawdown / reset",
    color: "#ef6b6b",
    summary:
      "Historically the market has often spent on the order of ~365 days in a broader drawdown / reset after a major cycle high — a rough framing only. Depth, shape, and calendar length vary by cycle; this is observation language for study, not a forecast of the next decline.",
  },
  {
    name: "Halving / supply epoch",
    duration: "~210,000 blocks · ~4 years",
    color: "#d4a017",
    summary:
      "The Bitcoin protocol cuts the block subsidy roughly every 210,000 blocks (historically about every four years). That supply-epoch event is the usual anchor of “4-year cycle” talk — an educational reference point on the chart, not a trade signal or a promise that price must rhyme with the next cut.",
  },
  {
    name: "Early vs late bull (rough)",
    duration: "within the ~3-year stretch",
    color: "#4c9fff",
    summary:
      "Within a bull stretch, observers often speak loosely of an earlier recovery / rebuild phase and a later, more crowded risk-on phase. Those labels are descriptive vocabulary only — this page does not invent precise split dates, returns, or “typical” drawdown percentages.",
  },
] as const;

export default function BtcCyclePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        <Link href="/dashboard" className="hover:underline">
          Cycle desk
        </Link>{" "}
        · BTC
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        BTC 4 year cycle theory
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Bitcoin&apos;s protocol cuts the block subsidy (the{" "}
        <strong className="font-medium text-foreground">halving</strong>) roughly every{" "}
        210,000 blocks — historically about every four years. That supply-epoch rhythm is
        the usual anchor when people talk about a “4-year cycle.” Treat it as{" "}
        <strong className="font-medium text-foreground">
          educational framing and historical observation
        </strong>
        , not a promise that the next epoch will rhyme on cue.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Historically the market has often{" "}
        <strong className="font-medium text-foreground">rhymed</strong> in roughly
        four-year cycles: about{" "}
        <strong className="font-medium text-foreground">~3 years up</strong> and{" "}
        <strong className="font-medium text-foreground">~1 year down</strong> as an
        approximate framing only. Lengths, depths, and calendar dates differ across
        cycles — use “historically / often / approximately,” not certainty.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        An interesting open question: nobody has a settled answer whether the rhythm is
        driven by the halving itself, liquidity, the business cycle, or something else.
        The “why” is still debated; the chart below is observation and framing for study.
      </p>

      <div className="mt-8">
        <BtcCycleFrame />
      </div>

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">
        Sources (inside the map): Bitcoin and MSTR history primarily via Yahoo Finance
        chart feeds (Stooq fallback); optional last print aligned to TradingView
        NASDAQ:MSTR for overlay stamp only. Cycle peaks/troughs are desk markers for
        study, not exchange-certified events. Map retains its own on-chart disclaimers.
        @Dirindin533 · educational only — NFA.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SEGMENTS.map((s) => (
          <article key={s.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
                aria-hidden
              />
              <h3 className="text-base font-semibold text-foreground">{s.name}</h3>
              <span className="ml-auto font-mono text-[10px] text-muted sm:text-xs">
                {s.duration}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{s.summary}</p>
          </article>
        ))}
      </div>

      <aside
        className="mt-8 rounded-xl border border-border bg-card px-5 py-4"
        role="note"
        aria-label="Open question on cycle causality"
      >
        <p className="text-sm font-semibold text-foreground">Open question · causality</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Does the roughly four-year rhyme come from the supply cut, from global
          liquidity and credit, from the broader business cycle, from behavioural
          crowding after each epoch, or from some mix? Research communities disagree.
          This desk page does not pick a winner — it keeps the map as a study frame and
          leaves the “why” as an open scientific question.
        </p>
      </aside>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · no forecasts or fake
        track records · @Dirindin533 / Adirindin Finance. Past patterns do not guarantee
        future results.
      </p>
    </div>
  );
}
