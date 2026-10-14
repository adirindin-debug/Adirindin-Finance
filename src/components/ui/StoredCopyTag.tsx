const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-12" → "12 Oct 2026" (date-only, no time zone shift). */
export function fmtStoredDate(d: string | null | undefined): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  return `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}`;
}

/** Grey tag shown instead of LIVE when a live feed failed and a saved copy is displayed. */
export function StoredCopyTag({ to, className = "" }: { to?: string | null; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[#3a4558] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted ${className}`}
      title="The live source was unavailable, so a stored copy is shown. Figures are not invented."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#64748b]" aria-hidden />
      Stored copy{to ? ` to ${fmtStoredDate(to)}` : ""}
    </span>
  );
}
