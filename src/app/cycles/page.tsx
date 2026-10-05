import type { Metadata } from "next";
import { CyclesHub } from "@/components/cycles/CyclesHub";

export const metadata: Metadata = {
  title: "Market cycles",
  description:
    "Market cycles hub: Bitcoin 4-year cycle theory, Anderson ~18-year real estate cycle, and US 10-year bond yield secular regime sketch — educational schematic tiles with Live markers. Not financial advice (NFA).",
};

export default function CyclesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Desk · Market cycles
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        Market cycles
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Theory silhouettes with a Live marker for where the calendar sits on each
        loop. Tap a tile for the full desk. Educational content only — not
        financial advice (NFA).
      </p>

      <CyclesHub />

      <p className="mt-8 max-w-3xl text-xs leading-relaxed text-muted">
        Silhouettes reuse each cycle chart’s theory curve and Live timing — never
        invented dates or percentages. Framing for study only · not financial
        advice (NFA) · Adirindin Finance / Anthony.
      </p>
    </div>
  );
}
