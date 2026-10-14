/** Small consistent block tag: "Live data" (green dot) vs "Theory" (outlined). */
export function DeskTag({ kind }: { kind: "live" | "theory" }) {
  if (kind === "live") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
        Live data
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
      Theory
    </span>
  );
}

/** One-line "How it's drawn" note under a block. */
export function HowDrawn({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-xs text-muted">
      <span className="font-medium text-foreground/80">How it’s drawn:</span> {children}
    </p>
  );
}
