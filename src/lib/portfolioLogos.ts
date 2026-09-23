/**
 * Holding logos via Logo.dev's ticker endpoint. Bitcoin and collectables keep
 * their local glyphs; unavailable logos fall back to ticker initials.
 */

import { LOGO_DEV_PUBLISHABLE_KEY } from "@/lib/logoDevToken";

export type LogoKind = "logo-dev" | "bitcoin" | "collectable" | "initials";

export type LogoDescriptor = {
  kind: LogoKind;
  /** Logo.dev image URL when kind === "logo-dev". */
  src?: string;
  /** Initials / symbol for fallback pill. */
  initials: string;
  /** Accessible holding name for remote logos. */
  label?: string;
};

function isBitcoinTicker(ticker: string): boolean {
  return (
    ticker === "BTC" ||
    ticker === "BTC-USD" ||
    ticker === "BTC-AUD" ||
    ticker === "XBT-USD" ||
    ticker === "BITCOIN"
  );
}

function initialsFor(input: { kind: string; ticker: string; name?: string }): string {
  if (input.kind === "collectable") return "◆";
  const ticker = input.ticker.trim().toUpperCase();
  return (
    ticker.replace(/[^A-Z0-9]/g, "").slice(0, 2) ||
    (input.name ?? "?").slice(0, 2).toUpperCase()
  );
}

/** Browser-safe Logo.dev URL using the publishable (pk_) token. */
function logoDevTickerUrl(ticker: string): string {
  return `https://img.logo.dev/ticker/${encodeURIComponent(ticker)}?token=${LOGO_DEV_PUBLISHABLE_KEY}&format=png&size=128&retina=true&theme=dark&fallback=404`;
}

export function resolveHoldingLogo(input: {
  kind: string;
  ticker: string;
  name?: string;
}): LogoDescriptor {
  const ticker = input.ticker.trim().toUpperCase();
  const initials = initialsFor(input);

  if (input.kind === "collectable") {
    return { kind: "collectable", initials: "◆" };
  }

  if (isBitcoinTicker(ticker)) {
    return { kind: "bitcoin", initials: "₿" };
  }

  if (input.kind === "security" && ticker) {
    return {
      kind: "logo-dev",
      src: logoDevTickerUrl(ticker),
      initials,
      label: input.name?.trim() || ticker,
    };
  }

  return { kind: "initials", initials };
}
