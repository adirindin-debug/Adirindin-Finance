"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/charts", label: "Charts" },
  { href: "/cycles", label: "Market cycles", shortLabel: "Cycles" },
  { href: "/tools", label: "Tools" },
];

/** Cycle desks that live under /tools/ but belong to Market cycles in the nav. */
const CYCLE_TOOL_PATHS = ["/tools/real-estate-cycle", "/tools/bond-cycle", "/tools/gold-cycle"];

function isCurrent(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  // Tools family: hub + /tools/* desks + portfolio + property prices — not cycle detail pages
  if (href === "/tools") {
    if (path === "/tools" || path === "/portfolio" || path === "/property-prices") return true;
    if (!path.startsWith("/tools/")) return false;
    return !CYCLE_TOOL_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  }
  // Market cycles hub + its detail desks (BTC / RE / Bond)
  if (href === "/cycles") {
    return (
      path === "/cycles" ||
      path === "/dashboard/btc-cycle" ||
      path.startsWith("/dashboard/btc-cycle/") ||
      path === "/tools/real-estate-cycle" ||
      path.startsWith("/tools/real-estate-cycle/") ||
      path === "/tools/bond-cycle" ||
      path.startsWith("/tools/bond-cycle/") ||
      path === "/tools/gold-cycle" ||
      path.startsWith("/tools/gold-cycle/")
    );
  }
  return path === href || path.startsWith(`${href}/`);
}

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-navy/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
          {/* Local asset — unavatar.io was 429ing in production */}
          <img
            src="/logo-x.jpg"
            alt="Adirindin Finance"
            width={36}
            height={36}
            className="h-8 w-8 rounded-md object-cover ring-1 ring-border sm:h-9 sm:w-9"
          />
          <span className="hidden truncate text-sm font-semibold text-foreground min-[400px]:inline">
            Adirindin Finance
          </span>
        </Link>
        <nav
          className="ml-auto flex max-w-[min(100%,22rem)] flex-nowrap items-center justify-end gap-0.5 overflow-x-auto text-[13px] sm:max-w-none sm:gap-1 sm:text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Primary"
        >
          {nav.map((n) => {
            const current = isCurrent(path, n.href);
            const short = "shortLabel" in n ? n.shortLabel : undefined;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={
                  current
                    ? "shrink-0 rounded-md px-1.5 py-2 text-foreground sm:px-2 sm:py-1.5"
                    : "shrink-0 rounded-md px-1.5 py-2 text-muted hover:text-foreground sm:px-2 sm:py-1.5"
                }
              >
                {short ? (
                  <>
                    <span className="sm:hidden">{short}</span>
                    <span className="hidden sm:inline">{n.label}</span>
                  </>
                ) : (
                  n.label
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
