import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Adirindin Finance via X @Dirindin533.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Reach the desk
      </p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">Contact</h1>
      <p className="mt-4 text-muted">
        Best way to get in touch is a DM on X — message{" "}
        <a
          href="https://x.com/Dirindin533"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          @Dirindin533
        </a>{" "}
        when the site is live or whenever you have a question about the research desk.
      </p>
      <p className="mt-6">
        <a
          href="https://x.com/Dirindin533"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Message @Dirindin533 on X
        </a>
      </p>
      <p className="mt-8 text-sm text-muted">
        Educational content only · not financial advice (NFA) · Adirindin Finance / Anthony.
      </p>
    </div>
  );
}
