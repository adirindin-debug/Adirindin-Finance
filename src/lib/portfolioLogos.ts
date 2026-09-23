/**
 * Holding logos: spot crypto via CoinGecko (proxied), equities/ETFs via Logo.dev
 * through same-origin /api/holding-logo (avoids broken client img when env or CDN
 * blocks direct img.logo.dev), collectables as a glyph.
 * Unavailable logos fall back to ticker initials (₿ for BTC).
 */

import {
  cryptoLogoProxyUrl,
  isBitcoinTicker,
  isSpotCryptoTicker,
} from "@/lib/cryptoLogos";

export type LogoKind =
  | "logo-dev"
  | "coingecko"
  | "bitcoin"
  | "collectable"
  | "initials";

export type LogoDescriptor = {
  kind: LogoKind;
  /** Remote image URL when kind is logo-dev or coingecko. */
  src?: string;
  /** Initials / symbol for fallback pill. */
  initials: string;
  /** Accessible holding name for remote logos. */
  label?: string;
};

function initialsFor(input: { kind: string; ticker: string; name?: string }): string {
  if (input.kind === "collectable") return "◆";
  const ticker = input.ticker.trim().toUpperCase();
  if (isBitcoinTicker(ticker)) return "₿";
  return (
    ticker.replace(/[^A-Z0-9]/g, "").slice(0, 2) ||
    (input.name ?? "?").slice(0, 2).toUpperCase()
  );
}

/** Same-origin Logo.dev proxy — works with canvas colour sampling (CORS). */
function logoDevProxyUrl(ticker: string): string {
  // v=2: Logo.dev theme=dark on black UI (bust CDN after monochrome fix)
  return `/api/holding-logo?ticker=${encodeURIComponent(ticker)}&v=2`;
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

  // Spot crypto (incl. BTC) → CoinGecko via same-origin proxy. Equity crypto
  // products (IBIT, GBTC, …) are excluded inside isSpotCryptoTicker.
  if (input.kind === "security" && ticker && isSpotCryptoTicker(ticker)) {
    return {
      kind: "coingecko",
      src: cryptoLogoProxyUrl(ticker),
      initials,
      label: input.name?.trim() || ticker,
    };
  }

  if (input.kind === "security" && ticker) {
    return {
      kind: "logo-dev",
      src: logoDevProxyUrl(ticker),
      initials,
      label: input.name?.trim() || ticker,
    };
  }

  return { kind: "initials", initials };
}

/** @deprecated Prefer resolveHoldingLogo; retained for any bitcoin-glyph callers. */
export { isBitcoinTicker };
