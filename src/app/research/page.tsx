import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Research",
  description: "Adirindin Finance markets research — cycle framing and process-over-noise notes.",
};

export default function ResearchPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Desk
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Research</h1>
      <p className="mt-4 text-muted">
        Markets research with a cycle-framing lens — process over noise. Notes land here when
        they are ready; the library is still light, and nothing here invents track records or
        fabricated posts.
      </p>
      <p className="mt-6 text-muted">
        Follow and DM on X:{" "}
        <a
          href="https://x.com/Dirindin533"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          @Dirindin533
        </a>
        .
      </p>
      <p className="mt-8 text-sm text-muted">
        Educational content only · not financial advice (NFA) · Adirindin Finance / Anthony.
      </p>
    </div>
  );
}
