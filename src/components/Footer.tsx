import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-charcoal">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
        <div className="flex max-w-xl items-start gap-2">
          <img
            src="https://unavatar.io/twitter/Dirindin533"
            alt=""
            width={28}
            height={28}
            className="mt-0.5 h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-border"
          />
          <div className="space-y-1.5">
            <p>Adirindin Finance — educational content only.</p>
            <p className="text-xs leading-relaxed">
              Not personal financial advice (NFA). Not a licensed Australian financial services
              business; nothing here is an AFSL product, recommendation, or solicitation. Index
              names, logos and trademarks remain with their owners. Chart data is attributed on
              each panel.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/portfolio" className="hover:text-accent">
            Portfolio
          </Link>
          <Link href="/property-prices" className="hover:text-accent">
            Property prices
          </Link>
          <Link href="/charts" className="hover:text-accent">
            Charts
          </Link>
          <Link href="/dashboard/btc-cycle" className="hover:text-accent">
            Cycle map
          </Link>
          <Link href="/tools/real-estate-cycle" className="hover:text-accent">
            RE cycle
          </Link>
          <a
            href="https://x.com/Dirindin533"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent"
          >
            @Dirindin533
          </a>
        </div>
      </div>
    </footer>
  );
}
