import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-charcoal">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <img src="https://unavatar.io/twitter/Dirindin533" alt="" width={28} height={28} className="h-7 w-7 rounded-md object-cover ring-1 ring-border" />
          <p>Adirindin Finance — educational content only.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard" className="hover:text-accent">Cycle map</Link>
          <a href="https://x.com/Dirindin533" target="_blank" rel="noopener noreferrer" className="hover:text-accent">@Dirindin533</a>
        </div>
      </div>
    </footer>
  );
}
