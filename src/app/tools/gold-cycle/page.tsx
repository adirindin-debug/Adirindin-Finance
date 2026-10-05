import type { Metadata } from "next";
import { CyclesBackLink } from "@/components/cycles/CyclesBackLink";
import GoldCommodityCycleChart from "@/components/GoldCommodityCycleChart";
import { GOLD_PEAK_ANCHORS, GOLD_CYCLE_YEARS } from "@/lib/goldCommodityCycle";

export const metadata: Metadata = {
  title: "46-year gold-led commodity cycle sketch",
  description:
    "Anthony / Adirindin observational sketch of a ~46-year gold-led commodity cycle with peak-zone markers at Jan 1934, 1980, 2026 and 2072, overlaid on long-run USD gold (log). Educational only — not Kondratiev-as-law, not a price target, not financial advice.",
};

const PHASES = [
  {
    name: "Post-peak settle",
    years: "Early years after a peak zone",
    width: "14%",
    color: "#ef6b6b",
    summary:
      "After a peak-zone marker the sketch lets price settle from the prior crest toward a quiet base. Timing and depth vary by era — this is shape language, not a measured drawdown rule.",
  },
  {
    name: "Flat base",
    years: "Long quiet stretch",
    width: "28%",
    color: "#8a97a8",
    summary:
      "Years of relatively flat or range-bound behaviour (including peg-era official prices before free float). The 1934→1970s stretch is a policy/peg story as much as a market cycle.",
  },
  {
    name: "Primary run",
    years: "Huge multi-year advance",
    width: "26%",
    color: "#3dcc9a",
    summary:
      "The main multi-year advance in the gold-led commodity story. Historically this is where free-market gold made its large secular moves — still an observation, not a signal.",
  },
  {
    name: "Third-quarter pause",
    years: "Mid/late-cycle digest",
    width: "14%",
    color: "#d4a017",
    summary:
      "A pause or digest after the primary run — sideways to mildly lower — before any final push. Placement is schematic (~third quarter of the ~46-year lap).",
  },
  {
    name: "Final run → peak zone",
    years: "Into the next Jan marker",
    width: "18%",
    color: "#f0c14a",
    summary:
      "Final advance into the next peak-zone calendar marker. 2026 is under study as a zone, not a guaranteed top; 2072 is theoretical from the ~46-year spacing.",
  },
] as const;

export default function GoldCyclePage() {
  const anchors = GOLD_PEAK_ANCHORS.join(" · ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <CyclesBackLink category="Gold · commodities" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        46-year gold-led commodity cycle sketch
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Anthony / Adirindin observational sketch of a roughly{" "}
        <strong className="font-medium text-foreground">{GOLD_CYCLE_YEARS}-year</strong>{" "}
        gold-led commodity rhythm. Peak-zone markers sit at{" "}
        <strong className="font-medium text-foreground">Jan {anchors}</strong>
        . The primary series is long-run gold in US dollars (log scale). Kondratiev /
        long-wave literature is context only — this page is{" "}
        <strong className="font-medium text-foreground">
          not “the Kondratiev law”
        </strong>
        , not a valuation model, and not a timing signal.
      </p>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Shape per lap: flat for years → huge multi-year run → third-quarter pause →
        final run into the peak zone. Anchors are easy to retune in one lib file after
        this first preview.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-black p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Gold + theory silhouette
          </h2>
          <span className="font-mono text-xs text-muted">
            ≈ {GOLD_CYCLE_YEARS}y · sketch · NFA
          </span>
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
          <span>Settle → flat</span>
          <span>Primary run → pause</span>
          <span>Final run → peak zone</span>
        </div>

        <GoldCommodityCycleChart />

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
              from the ~{GOLD_CYCLE_YEARS}-year spacing. The blue silhouette is shape
              language scaled to the chart — not a USD price path.
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
          This page does not claim a new natural law. It records Anthony&apos;s
          gold-led, ~{GOLD_CYCLE_YEARS}-year observational sketch used for study at
          Adirindin. Longer-wave writers (including Kondratiev and later long-wave
          interpreters) are cited only as{" "}
          <strong className="font-medium text-foreground">context</strong> — different
          clocks, different claims. We do not clone third-party paid cycle product art.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Series: long-run USD gold from the public{" "}
          <code className="text-xs text-foreground/80">datasets/gold-prices</code>{" "}
          monthly file (historical / official prints in the peg era; market prints
          thereafter), refreshed with Yahoo Finance <code className="text-xs text-foreground/80">GC=F</code>{" "}
          where available. Peg steps such as ~$20.67 and ~$35 are documented public
          series values — not invented. Educational study aid only · not financial advice.
        </p>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · no price targets or
        forecasts · @Dirindin533 / Adirindin Finance. Past patterns do not guarantee
        future results.
      </p>
    </div>
  );
}
