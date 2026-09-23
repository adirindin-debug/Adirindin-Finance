"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/property-prices", label: "Property prices" },
  { href: "/charts", label: "Charts" },
  { href: "/dashboard/btc-cycle", label: "BTC cycle" },
  { href: "/tools/real-estate-cycle", label: "RE cycle" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-navy/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          {/* Local asset — unavatar.io was 429ing in production */}
          <img
            src="/logo-x.jpg"
            alt="Adirindin Finance"
            width={36}
            height={36}
            className="h-9 w-9 rounded-md object-cover ring-1 ring-border"
          />
          <span className="text-sm font-semibold text-foreground">Adirindin Finance</span>
        </Link>
        <nav className="flex flex-wrap justify-end gap-1 text-sm">
          {nav.map((n) => {
            const current =
              n.href === "/"
                ? path === "/"
                : path === n.href || path.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={
                  current
                    ? "rounded-md px-2 py-1.5 text-foreground"
                    : "rounded-md px-2 py-1.5 text-muted hover:text-foreground"
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
