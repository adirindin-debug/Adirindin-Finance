import Link from "next/link";

type ChartsBackLinkProps = {
  category?: string;
};

/**
 * Obvious back control for chart detail pages — pill above the H1,
 * not buried in a muted uppercase eyebrow.
 */
export function ChartsBackLink({ category }: ChartsBackLinkProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <Link
        href="/charts"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-accent/60 bg-accent/10 px-3.5 py-1.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent/20 hover:text-foreground"
      >
        ← Back to Charts
      </Link>
      {category ? (
        <span className="text-xs font-medium text-muted">{category}</span>
      ) : null}
    </div>
  );
}
