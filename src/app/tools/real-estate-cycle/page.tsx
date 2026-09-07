import type { Metadata } from "next";
import Link from "next/link";
import RealEstateCycleChart from "@/components/RealEstateCycleChart";

export const metadata: Metadata = {
  title: "18 Year Real Estate Cycle",
  description:
    "Educational ~18 / 18.6-year real estate / land cycle framing (classic Recovery → Mid-cycle → Land boom → Downturn schematic). Observation framework — not a forecast or financial advice.",
};

/**
 * Phase cards aligned to the classic Anthony-style diagram vocabulary.
 * Durations are approximate study aids only — not a timing model.
 */
const PHASES = [
  {
    name: "Recovery",
    years: "~0–4 · start of cycle",
    width: "22%",
    color: "#3dcc9a",
    summary:
      "Credit repairs, builders restart, sentiment still cautious. Prices often feel “cheap” relative to late-boom memory. Classic series troughs / restarts include 1975, 1994, 2012 (and the framework’s next restart marker around 2030).",
  },
  {
    name: "Mid-cycle",
    years: "~4–10 · peak then slowdown",
    width: "30%",
    color: "#4c9fff",
    summary:
      "Broader participation and rising construction, then a mid-cycle peak and short slowdown (classic markers: 1981→1982, 2000→2002, 2019→2022). AU cities often see migration and credit growth amplify this stretch.",
  },
  {
    name: "Land boom",
    years: "~10–14 · ascent to peak",
    width: "23%",
    color: "#d4a017",
    summary:
      "Sharp land-driven acceleration after the mid-cycle dip — speculation, FOMO, and stretched valuations. The gold marker on the chart (~2024 in the current framework series) sits on that ascending leg before the major peak.",
  },
  {
    name: "Downturn",
    years: "~14–18 · reset into next recovery",
    width: "25%",
    color: "#ef6b6b",
    summary:
      "Major land-driven downturn after the peak: credit tightens, transactions slow, excesses unwind. Timing and depth vary by city, rate path, and policy — framework years (e.g. 2026 / 2028 / 2030) are classic-series dates, not calendar certainties.",
  },
] as const;

export default function RealEstateCyclePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        <Link href="/dashboard" className="hover:underline">
          Cycle desk
        </Link>{" "}
        · Real estate
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        ~18 / 18.6-year real estate cycle
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        Classic land / property cycle framing used in research communities (often shown as an ~18-year
        Recovery → Mid-cycle slowdown → Land boom → Major peak → Downturn schematic, sometimes linked to
        long lunar-nodal periodicity ≈ 18.6y). Treat it as a{" "}
        <strong className="font-medium text-foreground">
          study framework and historical observation
        </strong>{" "}
        — not a prediction engine, valuation model, or timing signal.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-black p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            Classic cycle diagram
          </h2>
          <span className="font-mono text-xs text-muted">≈ 18 / 18.6 years · schematic · NFA</span>
        </div>

        {/* Compact phase strip matching card vocabulary */}
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
          <span>Recovery</span>
          <span>Mid-cycle → Land boom</span>
          <span>Peak → Downturn</span>
        </div>

        <RealEstateCycleChart />
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

      <section className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Australian investor lens</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            National averages hide city cycles: Sydney, Melbourne, Brisbane, and regional markets can sit in
            different phases at the same calendar date.
          </li>
          <li>
            Rate settings, APRA credit guidance, migration, and housing supply pipelines often matter more
            month-to-month than a long-cycle cartoon.
          </li>
          <li>
            Owner-occupier vs investor, land tax / stamp duty, and SMSF rules change effective outcomes — this
            page does not model tax or cash-flow.
          </li>
          <li>
            Use the diagram as a vocabulary for discussion (where might we be in a long credit/land story?),
            not as a buy/sell calendar. Underlined framework years are classic-series markers, not predictions.
          </li>
        </ul>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · no fake returns shown · @Dirindin533 /
        Adirindin Finance. Past patterns do not guarantee future results.{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Back to cycle desk
        </Link>
        {" · "}
        <Link href="/dashboard/btc-cycle" className="text-accent hover:underline">
          BTC cycle map
        </Link>
        .
      </p>
    </div>
  );
}
