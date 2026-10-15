import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Disclaimer",
  description:
    "Not financial advice. Adirindin Finance is for research and educational purposes only — Australian English, NFA.",
};

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Legal / NFA
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Disclaimer
      </h1>

      <p className="mt-6 text-base leading-relaxed text-foreground sm:text-lg">
        Not financial advice. Only for research and educational purposes.
      </p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted sm:text-base">
        <p>
          Adirindin Finance publishes markets commentary, charts, cycle framing, and
          portfolio trackers for general information. Nothing on this site is personal
          financial product advice, a recommendation, or a solicitation to buy or sell any
          security, cryptoasset, property, or other product.
        </p>
        <p>
          Adirindin Finance is run by a sole trader who does not hold an Australian financial services licence. Content is general information and education only. It is not financial product advice, a recommendation or an offer, and it does not consider your personal circumstances.
        </p>
        <p>
          Past market patterns, cycle maps, relative returns, and illustrative holdings are
          not a guide to future performance. Data feeds can be delayed, incomplete, or wrong.
          Always do your own research and, where appropriate, speak with a licensed adviser
          who knows your circumstances.
        </p>
        <p>
          Index names, logos, and trademarks remain with their owners. Chart and data
          sources are attributed on each panel. Content is written in Australian English.
        </p>
        <p>Posts on X (@Dirindin533) are covered by this disclaimer.</p>
        <p>This information is general in nature and does not take into account your objectives, financial situation or needs. Consider whether it is appropriate for you and seek independent advice before acting.</p>
      </div>

      <p className="mt-10 text-sm text-muted">
        Questions?{" "}
        <Link href="/contact" className="text-accent hover:underline">
          Contact
        </Link>{" "}
        or{" "}
        <a
          href="https://x.com/Dirindin533"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          @Dirindin533
        </a>
        .{" "}
        <Link href="/" className="text-accent hover:underline">
          Back home
        </Link>
        .
      </p>
    </div>
  );
}
