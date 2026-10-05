import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "Terms of use for Adirindin Finance — educational research journal. Australian English, NFA.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Legal / NFA
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Terms of use
      </h1>

      <p className="mt-6 text-base leading-relaxed text-foreground sm:text-lg">
        By using this site you agree to these plain-language terms. Educational only —
        not personal financial advice (NFA).
      </p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted sm:text-base">
        <p>
          Adirindin Finance publishes markets commentary, charts, cycle framing, and
          trackers for general information. It is a sole-trader research journal, not a
          licensed Australian financial services business. Nothing on this site is personal
          financial product advice, an AFSL product, a recommendation, or a solicitation to
          buy or sell any security, cryptoasset, property, or other product.
        </p>
        <p>
          <strong className="font-medium text-foreground">No reliance.</strong> Past market
          patterns, cycle maps, relative returns, and illustrative holdings are not a guide
          to future performance. Data feeds can be delayed, incomplete, or wrong. Always do
          your own research and, where appropriate, speak with a licensed adviser who knows
          your circumstances.
        </p>
        <p>
          <strong className="font-medium text-foreground">Intellectual property.</strong>{" "}
          Site design, copy, and original charts belong to Adirindin unless otherwise noted.
          Index names, logos, and trademarks remain with their owners. Chart and data
          sources are attributed on each panel — do not strip attribution if you share a
          screenshot.
        </p>
        <p>
          <strong className="font-medium text-foreground">Acceptable use.</strong> Do not
          misuse the site (for example scraping in a way that harms public data providers,
          attempting to break security, or presenting our educational charts as personalised
          advice). Tools such as the portfolio tracker and compound-interest calculator are
          illustrative only.
        </p>
        <p>
          <strong className="font-medium text-foreground">Availability.</strong> The site is
          provided as-is. We may change or take pages offline without notice. We are not
          liable for losses arising from use of, or inability to use, the site or its data
          feeds, to the extent permitted by Australian Consumer Law.
        </p>
        <p>
          <strong className="font-medium text-foreground">Governing law.</strong> These terms
          are governed by the laws of Victoria, Australia. Questions:{" "}
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
          .
        </p>
      </div>

      <p className="mt-10 text-sm text-muted">
        Also see the{" "}
        <Link href="/disclaimer" className="text-accent hover:underline">
          disclaimer
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          privacy
        </Link>
        .{" "}
        <Link href="/" className="text-accent hover:underline">
          Back home
        </Link>
        .
      </p>
    </div>
  );
}
