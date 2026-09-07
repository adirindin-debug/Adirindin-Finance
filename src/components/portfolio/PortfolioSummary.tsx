type Props = {
  portfolioName: string;
  hasHoldings: boolean;
};

export function PortfolioSummary({ portfolioName, hasHoldings }: Props) {
  return (
    <section className="px-1" aria-label="Portfolio summary">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Portfolio</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {portfolioName || "Add portfolio name"}
            <span className="ml-1 text-zinc-600">▾</span>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          A$—
          <span className="ml-2 text-sm font-normal text-zinc-500">AUD</span>
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          {hasHoldings ? (
            <span className="text-emerald-400">+— · —%</span>
          ) : (
            <span>+— · —%</span>
          )}
          <span className="ml-2 text-xs text-zinc-600">empty · not live</span>
        </p>
      </div>
    </section>
  );
}
