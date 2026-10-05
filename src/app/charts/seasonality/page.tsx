import { redirect } from "next/navigation";

/** The heatmap is split by market; the old combined URL lands on crypto. */
export default function SeasonalityIndex() {
  redirect("/charts/seasonality/crypto");
}
