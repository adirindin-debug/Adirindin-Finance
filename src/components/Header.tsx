"use client";
import Link from "next/link";

const nav = [
  { href: "/", label: "Home" },
  { href: "/approach", label: "Approach" },
  { href: "/research", label: "Research" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/dashboard/btc-cycle", label: "Cycle map" },
  { href: "/tools/real-estate-cycle", label: "RE cycle" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-navy/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="https://unavatar.io/twitter/Dirindin533"
            alt="Adirindin Finance"
            width={36}
            height={36}
            className="h-9 w-9 rounded-md object-cover ring-1 ring-border"
          />
          <span className="text-sm font-semibold text-foreground">Adirindin Finance</span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-2 py-1.5 text-muted hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
