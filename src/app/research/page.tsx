import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Research", description: "Adirindin Finance research notes." };
export default function ResearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold text-foreground">Research</h1>
      <p className="mt-4 text-muted">Notes library coming soon — placeholders only, no fabricated claims. <Link href="/contact" className="text-accent hover:underline">Contact the desk</Link> with theme requests.</p>
    </div>
  );
}
