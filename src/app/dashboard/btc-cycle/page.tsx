import type { Metadata } from "next";
import Link from "next/link";
import BtcFourYearCycleChart from "@/components/BtcFourYearCycleChart";

export const metadata: Metadata = {
  title: "BTC 4 year cycle theory",
  description:
    "Educational Bitcoin 4-year cycle theory schematic: protocol halvings (~every 210,000 blocks / historically ~every 4 years), rough ~3-year up / ~1-year down observation, Live-dot wrap onto the next lap, and an open question on causality. Not a predictive model or financial advice.",
};

/**
 * Phase strip / segment cards for the rough 4-year Bitcoin cycle framing.
 * Durations are approximate study aids only — not a timing model.
 */
const PHASES = [
  {
    name: "~3-year bull",
    years: "~3 years · expansion stretch",
    width: "55%",
    color: "#3dcc9a",
    summary:
      "Historically, risk-on stretches after major bottoms have often lasted on the order of a few years — roughly framed as about ~3 years of expansion before a larger reset. Liquidity, leverage, and sentiment usually amplify the later part of this stretch. Treat the length as an approximate study aid, not a stopwatch.",
  },
  {
    name: "~1-year bear",
    years: "~1 year · drawdown / reset",
    width: "22%",
    color: "#ef6b6b",
    summary:
      "Historically the market has often spent on the order of ~365 days in a broader drawdown / reset after a major cycle high — a rough framing only. Depth, shape, and calendar length vary by cycle; this is observation language for study, not a forecast of the next decline.",
  },
  {
    name: "Halving epoch",
    years: "~210,000 blocks · ~4 years",
    width: "23%",
    color: "#d4a017",
    summary:
      "The Bitcoin protocol cuts the block subsidy roughly every 210,000 blocks (historically about every four years). That supply-epoch event is the usual anchor of “4-year cycle” talk — an educational reference point on the chart, not a trade signal or a promise that price must rhyme with the next cut.",
  },
] as const;

const SEGMENTS = [
  ...PHASES.map(({ name, years, color, summary }) => ({
    name,
    duration: years,
    color,
    summary,
  })),
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
        The “why” is still debated; the diagram below is observation and framing for study.
      </p>

      <p className="mt-4">
        <Link
          href="/charts/btc-cycle-map"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          Open live BTC cycle map →
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-border bg-black p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Classic cycle diagram
          </h2>
          <span className="font-mono text-xs text-muted">≈ 4 years · schematic · NFA</span>
        </div>

        <div className="mt-5 flex h-14 w-full overflow-hidden rounded-lg border border-[#222]">
          {PHASES.map((p) => (
            <div
              key={p.name}
              title={`${p.name} (${p.years})`}
              style={{
                width: p.width,
                background: `linear-gradient(180deg, ${p.color}55, ${p.color}22)`,
              }}
              className="relative flex items-end border-r border-[#222] last:border-r-0"
            >
              <span
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: p.color }}
                aria-hidden
              />
              <span className="w-full truncate px-2 pb-2 text-[11px] font-medium text-[#e8eef7] sm:text-xs">
                {p.name}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-between font-mono text-[10px] text-muted sm:text-xs">
          <span>Cycle low → early / mid bull</span>
          <span>Halving zone → late bull → peak</span>
          <span>Bear → next low</span>
        </div>

        <BtcFourYearCycleChart />

        <aside
          className="mt-5 rounded-lg border border-[#3a4558] bg-[#121820] px-4 py-3"
          role="note"
          aria-label="Theory overlay disclaimer"
        >
          <p className="text-sm font-semibold text-[#d0d8e4]">
            Next-lap theory overlay on the same cycle loop
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#9eb0c8] sm:text-sm">
            Muted markers (~2027 early bull → ~2028 mid / halving zone → ~2029 theory top →
            ~2030 theory low) are mapped onto the classic schematic as the{" "}
            <strong className="font-medium text-[#d0d8e4]">next lap of the same loop</strong>
            {" "}(reset / wrap after the framework ~Jul 2026 low), not a linear runway.
            They are a{" "}
            <strong className="font-medium text-[#d0d8e4]">
              rough guide based on 4-year cycle theory
            </strong>
            . This is <strong className="font-medium text-[#d0d8e4]">not a predictive model</strong>,{" "}
            <strong className="font-medium text-[#d0d8e4]">
              not to be relied on for market timing
            </strong>
            , and is for{" "}
            <strong className="font-medium text-[#d0d8e4]">
              research / educational purposes only
            </strong>
            . The green Live marker is calendar-dated on the path (Melbourne timezone; not a
            decorative tour). No dollar prices on this schematic. Not financial advice (NFA).
          </p>
        </aside>
      </div>

      <p className="mt-4 max-w-3xl text-xs leading-relaxed text-muted">
        This page is a{" "}
        <strong className="font-medium text-foreground">schematic theory diagram</strong>
        {" "}— not live prices. For the live price map (spot + 50w/200w MAs + desk tops/bottoms),
        open the{" "}
        <Link href="/charts/btc-cycle-map" className="text-accent hover:underline">
          Charts · BTC cycle map
        </Link>
        . Cycle peaks/troughs on that map are desk markers for study, not exchange-certified
        events. @Dirindin533 · educational only — NFA.
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
          This desk page does not pick a winner — it keeps the schematic as a study frame and
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
