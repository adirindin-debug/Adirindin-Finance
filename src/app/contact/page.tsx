import type { Metadata } from "next";
export const metadata: Metadata = { title: "Contact", description: "Contact Adirindin Finance." };
export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-semibold text-foreground">Contact</h1>
      <p className="mt-4 text-muted">Email <a href="mailto:hello@adirindinfinance.com.au" className="text-accent hover:underline">hello@adirindinfinance.com.au</a> for research or site questions. Educational content only — not financial advice.</p>
    </div>
  );
}
