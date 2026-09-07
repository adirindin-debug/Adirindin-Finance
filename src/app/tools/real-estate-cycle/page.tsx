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

        {/* Richer schematic cycle chart — educational framing, not price data / not a forecast */}
        <svg
          viewBox="0 0 700 260"
          className="mt-6 h-auto w-full"
          role="img"
          aria-label="Schematic 18.6-year real estate cycle chart with phase bands, not historical prices or a forecast"
        >
          <defs>
            <linearGradient id="re-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4c9fff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#4c9fff" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="re-stroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3dcc9a" />
              <stop offset="22%" stopColor="#3dcc9a" />
              <stop offset="22%" stopColor="#4c9fff" />
              <stop offset="54%" stopColor="#4c9fff" />
              <stop offset="54%" stopColor="#d4a017" />
              <stop offset="75%" stopColor="#d4a017" />
              <stop offset="75%" stopColor="#ef6b6b" />
              <stop offset="100%" stopColor="#ef6b6b" />
            </linearGradient>
            <clipPath id="re-plot">
              <rect x="48" y="36" width="624" height="168" rx="4" />
            </clipPath>
          </defs>

          <rect width="700" height="260" fill="#0a0a0a" rx="8" />

          <text x="48" y="22" fill="#8b9bb4" fontSize="11" fontFamily="system-ui">
            Schematic cycle shape · not returns · not a forecast
          </text>

          {/* Soft phase background bands (years 0–4 / 4–10 / 10–14 / 14–18.6) */}
          <g clipPath="url(#re-plot)" opacity="0.9">
            <rect x="48" y="36" width="133.3" height="168" fill="#3dcc9a" opacity="0.1" />
            <rect x="181.3" y="36" width="200" height="168" fill="#4c9fff" opacity="0.1" />
            <rect x="381.3" y="36" width="133.3" height="168" fill="#d4a017" opacity="0.1" />
            <rect x="514.6" y="36" width="157.4" height="168" fill="#ef6b6b" opacity="0.1" />
          </g>

          {/* Subtle horizontal grid */}
          {[60, 95, 130, 165, 200].map((y) => (
            <line
              key={y}
              x1="48"
              y1={y}
              x2="672"
              y2={y}
              stroke="#1a1a1a"
              strokeWidth="1"
            />
          ))}

          {/* Vertical dashed phase boundaries */}
          {[
            { x: 181.3, label: "Yr 4" },
            { x: 381.3, label: "Yr 10" },
            { x: 514.6, label: "Yr 14" },
          ].map((b) => (
            <g key={b.label}>
              <line
                x1={b.x}
                y1="36"
                x2={b.x}
                y2="204"
                stroke="#333"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            </g>
          ))}

          {/* Phase labels along top of plot */}
          {[
            { x: 114.65, label: "Recovery", color: "#3dcc9a" },
            { x: 281.3, label: "Mid upswing", color: "#4c9fff" },
            { x: 447.95, label: "Late boom", color: "#d4a017" },
            { x: 593.3, label: "Downturn", color: "#ef6b6b" },
          ].map((p) => (
            <text
              key={p.label}
              x={p.x}
              y="50"
              textAnchor="middle"
              fill={p.color}
              fontSize="10"
              fontFamily="system-ui"
              fontWeight="600"
              opacity="0.85"
            >
              {p.label}
            </text>
          ))}

          {/* Filled area under smooth cycle curve + stronger phase-tinted stroke.
              Path is a schematic educational shape only — not historical prices. */}
          <g clipPath="url(#re-plot)">
            <path
              d="M48 188
                 C 90 188, 120 175, 148 155
                 C 175 135, 200 110, 240 95
                 C 280 80, 310 72, 340 68
                 C 370 64, 400 58, 430 52
                 C 455 47, 475 48, 495 58
                 C 520 72, 545 105, 575 135
                 C 605 165, 640 185, 672 190
                 L 672 204 L 48 204 Z"
              fill="url(#re-area)"
            />
            <path
              d="M48 188
                 C 90 188, 120 175, 148 155
                 C 175 135, 200 110, 240 95
                 C 280 80, 310 72, 340 68
                 C 370 64, 400 58, 430 52
                 C 455 47, 475 48, 495 58
                 C 520 72, 545 105, 575 135
                 C 605 165, 640 185, 672 190"
              fill="none"
              stroke="url(#re-stroke)"
              strokeWidth="3.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* Peak & trough markers */}
          <g>
            {/* Start trough */}
            <circle cx="48" cy="188" r="5" fill="#0a0a0a" stroke="#3dcc9a" strokeWidth="2" />
            <text x="58" y="198" fill="#a8b4c8" fontSize="9" fontFamily="system-ui">
              Trough
            </text>
            {/* Mid-cycle structure (approaching late boom) */}
            <circle cx="340" cy="68" r="4" fill="#0a0a0a" stroke="#4c9fff" strokeWidth="1.75" />
            <text x="340" y="60" textAnchor="middle" fill="#a8b4c8" fontSize="9" fontFamily="system-ui">
              Mid peak
            </text>
            {/* Cycle peak in late boom */}
            <circle cx="430" cy="52" r="5.5" fill="#0a0a0a" stroke="#d4a017" strokeWidth="2.25" />
            <text x="430" y="42" textAnchor="middle" fill="#d4a017" fontSize="10" fontFamily="system-ui" fontWeight="600">
              Peak
            </text>
            {/* End trough */}
            <circle cx="672" cy="190" r="5" fill="#0a0a0a" stroke="#ef6b6b" strokeWidth="2" />
            <text x="662" y="208" textAnchor="end" fill="#a8b4c8" fontSize="9" fontFamily="system-ui">
              Trough
            </text>
          </g>

          {/* Baseline */}
          <line x1="48" y1="204" x2="672" y2="204" stroke="#2a2a2a" strokeWidth="1.25" />

          {/* Year axis 0 → 18.6 */}
          {[
            { yr: "0", x: 48 },
            { yr: "4", x: 181.3 },
            { yr: "8", x: 314.6 },
            { yr: "10", x: 381.3 },
            { yr: "14", x: 514.6 },
            { yr: "18.6", x: 672 },
          ].map((t) => (
            <g key={t.yr}>
              <line x1={t.x} y1="204" x2={t.x} y2="210" stroke="#555" strokeWidth="1" />
              <text
                x={t.x}
                y="224"
                textAnchor="middle"
                fill="#8b9bb4"
                fontSize="10"
                fontFamily="ui-monospace, monospace"
              >
                {t.yr}
              </text>
            </g>
          ))}
          <text
            x="360"
            y="246"
            textAnchor="middle"
            fill="#6b7a90"
            fontSize="10"
            fontFamily="system-ui"
          >
            Cycle years (schematic · ≈ 18.6)
          </text>
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
