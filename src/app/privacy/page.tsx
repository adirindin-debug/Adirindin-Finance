import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Privacy note for Adirindin Finance — educational research journal. Australian English, NFA.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Legal / NFA
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Privacy
      </h1>

      <p className="mt-6 text-base leading-relaxed text-foreground sm:text-lg">
        A short note on how this sole-trader research desk handles information.
        Educational framing only — not personal financial advice (NFA).
      </p>

      <div className="mt-8 space-y-5 text-sm leading-relaxed text-muted sm:text-base">
        <p>
          Adirindin Finance is a personal markets research journal published online. It is
          not a licensed Australian financial services business, and nothing here is an
          AFSL product, recommendation, or solicitation.
        </p>
        <p>
          <strong className="font-medium text-foreground">What we collect.</strong> This
          site is mostly static educational content and public market charts. We do not run
          a member login or a paid advice funnel. We do not use an analytics service,
          advertising trackers or cookies. Standard hosting logs (for example IP address,
          user-agent, and pages requested) are processed by our hosting provider (currently
          Vercel) in line with its own privacy policy.
        </p>
        <p>
          <strong className="font-medium text-foreground">Stored on your device.</strong> Some
          features save data in your browser only. It is not uploaded to an Adirindin server,
          and clearing site data in your browser removes it:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Portfolio tracker: your holdings, display currency and chart options
            (localStorage).
          </li>
          <li>
            Chart preferences: selected timeframes, base chart and smoothing choices on the
            sentiment gauges (localStorage).
          </li>
          <li>Property tools: your saved inputs (localStorage).</li>
          <li>Whether you have dismissed the mobile view hint (localStorage).</li>
          <li>
            Scroll position per page, so the back button returns you to where you were
            (sessionStorage, cleared when you close the tab).
          </li>
        </ul>
        <p>
          <strong className="font-medium text-foreground">Contact.</strong> If you email or
          message via the{" "}
          <Link href="/contact" className="text-accent hover:underline">
            Contact
          </Link>{" "}
          page or{" "}
          <a
            href="https://x.com/Dirindin533"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            @Dirindin533
          </a>
          , we keep that correspondence only as needed to reply. We do not sell contact
          lists.
        </p>
        <p>
          <strong className="font-medium text-foreground">Third-party data.</strong> Chart
          panels load market data from labelled public sources (for example FRED, Coinbase,
          CoinGecko, CoinMetrics). Those providers process requests under their
          own terms. We do not control their cookies or logs.
        </p>
        <p>
          <strong className="font-medium text-foreground">Australian context.</strong> This
          note is written in Australian English for a small research site. It is not a
          substitute for formal privacy advice. If you have a question about personal
          information, use Contact or X and we will respond in plain language.
        </p>
        <p>
          <strong className="font-medium text-foreground">
            Access, correction and complaints.
          </strong>{" "}
          You can ask what personal information we hold about you, ask us to correct it, or
          make a privacy complaint by emailing{" "}
          <span className="text-foreground">[privacy contact email to be confirmed]</span>.
          If you are not satisfied with our response, you can
          contact the Office of the Australian Information Commissioner (OAIC) at{" "}
          <a
            href="https://www.oaic.gov.au"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            oaic.gov.au
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
        <Link href="/terms" className="text-accent hover:underline">
          terms of use
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
