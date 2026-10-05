import Link from "next/link";

type CyclesBackLinkProps = {
  category?: string;
};

/**
 * Obvious back control for Market cycles detail pages — pill above the H1,
 * matching ChartsBackLink on chart desks.
 */
export function CyclesBackLink({ category }: CyclesBackLinkProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <Link
        href="/cycles"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 px-3.5 py-1.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent/20 hover:text-foreground"
      >
        ← Back to Market cycles
      </Link>
      {category ? (
        <span className="text-xs font-medium text-muted">{category}</span>
      ) : null}
    </div>
  );
}
