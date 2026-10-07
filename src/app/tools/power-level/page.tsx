import type { Metadata } from "next";
import { ToolsBackLink } from "@/components/tools/ToolsBackLink";
import { PowerLevelPanel, PowerTop10 } from "@/components/tools/PowerLevelPanel";
import { E_CAP, INCOME_YEARS, PERSONAS, TIERS, computePower, displayReading, readingFromE, tierFor } from "@/lib/powerLevel";

export const metadata: Metadata = {
  title: "Power Level",
  description:
    "A light-hearted scouter-style power level for your standard of living, 0–100,000 — net worth, runway, savings rate and income on a log scale, plus the planet's top 10. Runs in your browser; nothing is stored or sent. For fun — not financial advice.",
};

const fmt = (n: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(n);

export default function PowerLevelPage() {
  const personaRows = PERSONAS.map((p) => {
    const r = computePower(p.inputs);
    return { id: p.id, label: p.label, display: r.display, tier: tierFor(r.display).name };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ToolsBackLink category="Just for fun" />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Power Level</h1>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d4a017]/40 bg-[#d4a017]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#e8b84a]"
          data-badge="Beta"
          title="Beta — the scoring scale may still be tuned"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#e8b84a]" aria-hidden />
          Beta
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
        Point the scouter at your finances. Your standard of living gets a power level from 0 to 100,000, built from net
        worth, runway (months of spending your cash and investments cover), savings rate and income, on a log scale. Try a
        quick-fill example or punch in your own numbers.
      </p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
        <strong className="font-medium text-foreground">Private by design.</strong> Every calculation runs in your browser.
        Nothing you type is stored or sent anywhere.
      </p>

      <div className="mt-8">
        <PowerLevelPanel />
      </div>

      <details className="group mt-8 rounded-xl border border-border bg-card p-5 sm:p-6" data-how-scored>
        <summary className="cursor-pointer list-none text-lg font-semibold text-foreground">
          <span className="mr-2 inline-block text-accent transition group-open:rotate-90">▸</span>
          How it&apos;s scored
        </summary>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <span className="text-foreground">Net worth</span> = cash + investments + home value (if you own) − mortgage
              + car − car loan − other debts.
            </li>
            <li>
              <span className="text-foreground">Shared households:</span> net worth and after-tax income are divided by
              √(household size), the OECD square-root scale — four people sharing $200k live differently to one.
            </li>
            <li>
              <span className="text-foreground">Effective wealth</span> = net worth + {INCOME_YEARS} × after-tax income
              (income as earning power), floored at zero. Gross income is converted with 2026–27 Australian resident tax
              rates, the low income tax offset and the Medicare levy, as one taxpayer — a rough estimate.
            </li>
            <li>
              <span className="text-foreground">Habits</span> nudge it by up to about ±10–15%: runway (0 months ×0.85 →
              10+ years ×1.15, on a log curve), savings rate (×0.85 at −50% or worse → ×1.18 at 60%+), and optional body
              fat % (blank = no change; peaks near ×1.10 around 12–18%; very high or extremely low holds back modestly
              toward ×0.90). Body fat is a rough lifestyle nudge only — not medical or health advice.
            </li>
            <li>
              <span className="text-foreground">One smooth curve:</span> effective wealth goes through a single
              continuous curve on a log scale — a gentle logistic climb centred around A$1.4M plus a softplus tail. No
              kinks or jumps: the climb is steepest around A$1–1.5M (about 13,000 points per doubling) and eases to about
              7,500 points per ×10 at the top, reaching 100,000 at A${fmt(E_CAP / 1e9)} billion (about US$400B+). The
              screen caps at 99,999 — 100,000 is the theoretical maximum.
            </li>
          </ol>
          <div className="space-y-1 font-mono text-xs text-[#c8d0dc]">
            <p>
              E = max(0, NW + {INCOME_YEARS}·income) ÷ √n × M<sub>runway</sub> × M<sub>savings</sub> × M<sub>bf</sub>
            </p>
            <p>
              raw(x) = 60,000 ÷ (1 + e<sup>−3.3(x − 6.15)</sup>) + 9,600 · 0.53 · ln(1 + e<sup>(x − 4.65)/0.53</sup>), x =
              log<sub>10</sub>(1 + E)
            </p>
            <p>P = 100,000 × (raw(x) − raw(0)) ÷ (raw at A$600B − raw(0))</p>
          </div>
          <div>
            <p className="text-foreground">Effective wealth → reading:</p>
            <ul className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-5">
              {[0, 5e4, 3e5, 6e5, 1e6, 2e6, 1e7, 1e8, 1e9, 6e11].map((e) => (
                <li key={e} className="flex justify-between gap-2 border-b border-border/40 py-1">
                  <span>{e >= 1e9 ? `A$${fmt(e / 1e9)}B` : e >= 1e6 ? `A$${fmt(e / 1e6)}M` : e >= 1e3 ? `A$${fmt(e / 1e3)}k` : "A$0"}</span>
                  <span className="font-mono tabular-nums text-foreground">{fmt(displayReading(readingFromE(e)))}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-foreground">Calibration with the illustrative examples:</p>
            <ul className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {personaRows.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 border-b border-border/40 py-1">
                  <span>{r.label}</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {fmt(r.display)} <span className="text-muted">· {r.tier}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p>
            Tiers: {TIERS.map((t) => `${t.name} (${fmt(t.min)}+)`).join(" · ")}. Names are our own, just for fun.
          </p>
        </div>
      </details>

      <div className="mt-8">
        <PowerTop10 />
      </div>

      <aside className="mt-8 rounded-xl border border-[#3a4558] bg-[#121820] px-5 py-4" role="note" aria-label="Just for fun">
        <p className="text-sm font-semibold text-[#d0d8e4]">Just for fun — not a measure of anyone&apos;s worth</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-[#9eb0c8] sm:text-sm">
          <li>
            The power level is a playful, educational way to think about financial resilience. It is not a measure of
            personal worth, character or happiness — and plenty that matters most never shows up in a number.
          </li>
          <li>
            The formula is a simplified, made-up scale. It ignores many things (super preservation rules, tax on assets,
            cost of living where you are, family support) and the tax estimate is rough. Optional body fat is a playful
            lifestyle nudge only — not medical advice, not a diagnosis, and not a measure of fitness or health.
          </li>
          <li>
            Example personas are illustrative round numbers, not statistics. Billionaire net worths are third-party
            estimates from the stated source and change constantly.
          </li>
          <li>
            General information only — not personal financial advice (NFA). It does not consider your objectives,
            financial situation or needs. Consider advice from a licensed professional before acting.
          </li>
        </ul>
      </aside>

      <p className="mt-8 text-xs leading-relaxed text-muted">
        For fun and education only · not financial advice (NFA) · @Dirindin533 / Adirindin Finance.
      </p>
    </div>
  );
}
