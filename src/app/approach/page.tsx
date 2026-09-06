import type { Metadata } from "next";
export const metadata: Metadata = { title: "Approach", description: "How Adirindin Finance approaches markets research." };
export default function ApproachPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold text-foreground">Approach</h1>
      <p className="mt-4 text-muted">Define the question, separate fact from framing, prefer process over prophecy, and keep an Australian lens. No invented track records or fake dashboard numbers.</p>
    </div>
  );
}
