import type { Metadata } from "next";
import { ChartsBackLink } from "@/components/charts/ChartsBackLink";
import { FactoryMonitorPanel } from "@/components/charts/FactoryMonitorPanel";

export const metadata: Metadata = {
  title: "Philly Fed Manufacturing",
  description:
    "Philadelphia Fed Manufacturing Business Outlook Survey (current general activity, via FRED) with research reference levels — not the ISM Manufacturing PMI. Educational only (NFA).",
};

export default function FactoryMonitorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ChartsBackLink category="Macro" />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Philly Fed Manufacturing
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        US factory monitor built on the Philadelphia Fed manufacturing survey ·
        monthly · not ISM. Research tool only — not financial advice (NFA).
      </p>

      <div className="mt-8">
        <FactoryMonitorPanel />
      </div>
    </div>
  );
}
