import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "18.6y Real Estate Cycle",
  description:
    "Educational ~18.6-year real estate / land cycle phase framing for Australian investors. Observation framework — not a forecast or financial advice.",
};

/** Classic research-community phase labels for an ~18.6y land cycle framing. Durations are approximate study aids only. */
const PHASES = [
  {
    name: "Recovery",
    years: "~0–4",
    width: "22%",
    color: "#3dcc9a",
    summary:
      "Credit repairs, builders restart, sentiment still cautious. Prices often feel “cheap” relative to late-boom memory.",
  },
  {
    name: "Mid upswing",
    years: "~4–10",
    width: "32%",
    color: "#4c9fff",
    summary:
      "Broader participation, rising construction, and improving liquidity. AU cities often see migration and credit growth amplify this phase.",
  },
  {
    name: "Late boom",
    years: "~10–14",
    width: "21%",
    color: "#d4a017",
    summary:
      "Speculation, FOMO, and stretched valuations. New supply ramps; narratives of “this time is different” get louder.",
  },
  {
    name: "Downturn / reset",
    years: "~14–18.6",
    width: "25%",
    color: "#ef6b6b",
    summary:
      "Credit tightens, transactions slow, and excesses unwind. Timing and depth vary by city, rate path, and policy — not a calendar certainty.",
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
        ~18.6-year real estate cycle
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        A classic land / property cycle framing used in research communities (sometimes linked to long lunar nodal
        periodicity). Treat it as a <strong className="font-medium text-foreground">study framework and historical
        observation</strong> — not a prediction engine, valuation model, or timing signal.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-black p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">Phase timeline</h2>
          <span className="font-mono text-xs text-muted">≈ 18.6 years · schematic</span>
        </div>

        <div className="mt-5 flex h-14 w-full overflow-hidden rounded-lg border border-[#222]">
          {PHASES.map((p) => (
            <div
              key={p.name}
              title={`${p.name} (${p.years})`}
              style={{ width: p.width, background: `linear-gradient(180deg, ${p.color}55, ${p.color}22)` }}
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
          <span>Cycle start (recovery)</span>
          <span>≈ mid cycle</span>
          <span>Late boom → reset</span>
        </div>

        {/* Lightweight SVG wave — schematic, not price data */}
        <svg viewBox="0 0 600 120" className="mt-6 h-auto w-full" role="img" aria-label="Schematic cycle wave, not historical prices">
          <rect width="600" height="120" fill="#0a0a0a" rx="8" />
          <text x="12" y="18" fill="#8b9bb4" fontSize="10" fontFamily="system-ui">
            Schematic wave (not returns / not a forecast)
          </text>
          <path
            d="M20 85 C 80 85, 100 70, 140 55 S 220 25, 280 30 S 360 50, 400 40 S 480 20, 520 55 S 560 90, 580 95"
            fill="none"
            stroke="#4c9fff"
            strokeWidth="2.5"
          />
          <line x1="20" y1="100" x2="580" y2="100" stroke="#222" strokeWidth="1" />
          {[
            { x: 90, label: "Recovery" },
            { x: 230, label: "Upswing" },
            { x: 400, label: "Late boom" },
            { x: 530, label: "Reset" },
          ].map((m) => (
            <g key={m.label}>
              <line x1={m.x} y1="28" x2={m.x} y2="100" stroke="#333" strokeDasharray="3 3" />
              <text x={m.x} y="112" textAnchor="middle" fill="#8b9bb4" fontSize="9" fontFamily="system-ui">
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PHASES.map((p) => (
          <article key={p.name} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
              <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
              <span className="ml-auto font-mono text-xs text-muted">{p.years}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{p.summary}</p>
          </article>
        ))}
      </div>

      <section className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">Australian investor lens</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            National averages hide city cycles: Sydney, Melbourne, Brisbane, and regional markets can sit in different
            phases at the same calendar date.
          </li>
          <li>
            Rate settings, APRA credit guidance, migration, and housing supply pipelines often matter more month-to-month
            than a long-cycle cartoon.
          </li>
          <li>
            Owner-occupier vs investor, land tax / stamp duty, and SMSF rules change effective outcomes — this page does
            not model tax or cash-flow.
          </li>
          <li>
            Use the timeline as a vocabulary for discussion (where might we be in a long credit/land story?), not as a
            buy/sell calendar.
          </li>
        </ul>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        Educational content only · not financial advice (NFA) · no fake returns shown · @Dirindin533 / Adirindin Finance.
        Past patterns do not guarantee future results.{" "}
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
