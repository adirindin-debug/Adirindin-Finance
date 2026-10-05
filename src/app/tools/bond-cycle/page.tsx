import type { Metadata } from "next";
import Link from "next/link";
import { CyclesBackLink } from "@/components/cycles/CyclesBackLink";
import BondYieldCycleChart from "@/components/BondYieldCycleChart";

export const metadata: Metadata = {
  title: "US 10 Year Bond Yield Cycle theory",
  description:
    "Educational sketch of the US 10-year Treasury yield secular regimes: decades of rising long rates into 1981, decades of falling long rates into 2020, drawn as a stylised ~40-year up / ~40-year down mountain with a theoretical ~2060 peak-zone marker. Regime direction only — no yield targets. Not a model or financial advice.",
};

/**
 * Phase strip / cards for the US long-rate secular regime sketch.
 * Narrative from Anthony's research pack (1 Oct 2026). Study aids only — not a timing model.
 */
const PHASES = [
  {
    name: "Trough regime",
    years: "~1940 zone · ~2020 zone",
    width: "10%",
    color: "#2fd67b",
    summary:
      "Long rates bottom out across a broad zone rather than on a single day. The sketch marks Jan-dated trough zones at 1940 and 2020; the actual low on FRED DGS10 printed in Aug 2020. The 2020 zone is where the current lap starts on the chart.",
  },
  {
    name: "Rising-rate regime",
    years: "~40 years up · 1940s → 1981",
    width: "40%",
    color: "#3dcc9a",
    summary:
      "From the 1940s into 1981, US long rates rose for decades — an era driven by inflation. Since 2020, yields have sat in a higher range, but that is not yet a proven 40-year uptrend. The Live marker sits early on this slope as a calendar position only, not a call on yields.",
  },
  {
    name: "Peak regime",
    years: "~1980 zone · ~2060* theoretical",
    width: "10%",
    color: "#ff4d4d",
    summary:
      "The 1980 zone captures the secular high; the actual DGS10 high printed in Sep 1981. The ~2060 peak-zone marker is a theoretical sketch from the observed ~40-year half-swings — regime direction only, with no yield print and no target attached.",
  },
  {
    name: "Falling-rate regime",
    years: "~40 years down · 1981 → 2020",
    width: "40%",
    color: "#ef6b6b",
    summary:
      "From 1981 to 2020, long rates fell for decades as disinflation, QE and demographics pulled yields lower. The ~2060 → ~2100 descent on the chart simply mirrors that observed half-swing; it is a sketch, not a forecast.",
  },
] as const;

export default function BondCyclePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <CyclesBackLink category="Bond yields" />
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        US 10 Year Bond Yield Cycle theory
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        US long rates rose for decades into 1981 and then fell for decades into 2020. This page sketches
        that as a stylised mountain: a trough zone, roughly{" "}
        <strong className="font-medium text-foreground">40 years of rising rates</strong> to a peak zone,
        then roughly <strong className="font-medium text-foreground">40 years of falling rates</strong> back
        to a trough zone. The focus is the US 10-year Treasury because the US dollar has been the reserve
        currency for a long time, so its long rate is the reference point here.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Treat it as an{" "}
        <strong className="font-medium text-foreground">observation and study sketch</strong>, not a new
        named law, a valuation model or a signal. Future markers are theoretical and show regime direction
        only — there is no yield target for any future date.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-black p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Secular regime diagram
          </h2>
          <span className="font-mono text-xs text-muted">≈ 40y up · 40y down · sketch · NFA</span>
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
          <span>Trough → rising (green)</span>
          <span>Peak zone (centre)</span>
          <span>Falling → trough (red)</span>
        </div>

        <BondYieldCycleChart />

        <aside
          className="mt-5 rounded-lg border border-[#3a4558] bg-[#121820] px-4 py-3"
          role="note"
          aria-label="Theoretical sketch disclaimer"
        >
          <p className="text-sm font-semibold text-[#d0d8e4]">Theoretical sketch on the same loop</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[#9eb0c8] sm:text-sm">
            The mountain is a stylised ~80-year loop built from the{" "}
            <strong className="font-medium text-[#d0d8e4]">observed ~40-year half-swings</strong>{" "}
            (1940 trough zone → 1980 peak zone → 2020 trough zone). Bold yellow years are the active lap
            (2020 → ~2060* → ~2100*); muted years are the previous and next laps. Starred markers are{" "}
            <strong className="font-medium text-[#d0d8e4]">theoretical</strong> — regime direction only,
            with <strong className="font-medium text-[#d0d8e4]">no yield target</strong>. After Jan 2100
            the green Live marker resets onto the same loop and the yellow highlight switches to the next
            lap automatically. Live is calendar-dated on the path (not a decorative tour). This clock is
            separate from the BTC and real estate cycles — they are not merged into one super-cycle. This is{" "}
            <strong className="font-medium text-[#d0d8e4]">not a model</strong>,{" "}
            <strong className="font-medium text-[#d0d8e4]">not a signal</strong> and not for market timing;
            research / educational purposes only. Not financial advice (NFA).
          </p>
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
              <span className="ml-auto font-mono text-[10px] text-muted sm:text-xs">{p.years}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{p.summary}</p>
          </article>
        ))}
      </div>

      <aside
        className="mt-8 rounded-xl border border-border bg-card px-5 py-4"
        role="note"
        aria-label="AI and robotics hypothesis"
      >
        <p className="text-sm font-semibold text-foreground">
          Hypothesis · AI / robotics{" "}
          <span className="ml-1 rounded border border-[#8a6a20] px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d4a017]">
            hypothesis
          </span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          One hypothesis overlay, not part of the observed pattern: an AI / robotics buildout and the
          issuance that funds it could lift long yields early, while productivity gains and fiscal
          collateral effects could pull them lower later. Research disagrees on the sign for the 10-year.
          A useful lens is <strong className="font-medium text-foreground">g vs r</strong> (growth vs
          rates). This page does not pick a side and draws no yield path from it.
        </p>
      </aside>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Attribution &amp; sources</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          This page does not introduce a new named theory. It sketches an observation — US long rates rose
          for decades into 1981 and fell for decades into 2020 — and sits alongside related long-horizon
          frameworks: Kondratiev long waves (~45–60 years), Sidney Homer &amp; Richard Sylla&apos;s{" "}
          <em>A History of Interest Rates</em>, and Ray Dalio&apos;s long-term debt cycle (~75–100 years).
          Those frameworks use different clocks; they are cited for context, not combined into one cycle.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Series: US 10-year Treasury constant-maturity yield, FRED DGS10 / Federal Reserve H.15. The only
          yield figures on this page are the two historical prints in the hover cards (Sep 1981 high, Aug
          2020 low). US-only by design — no global averages. Educational study aid only · not financial
          advice.
        </p>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · no yield targets or forecasts · @Dirindin533 /
        Adirindin Finance. Past patterns do not guarantee future results.
      </p>
    </div>
  );
}
