/**
 * Holding logos via Simple Icons (CC0) where a brand mark exists in the package.
 * Missing slug / unknown ticker → initials. Bitcoin keeps dedicated orange ₿.
 * Collectables keep ◆. No favicon CDN hotlinks for securities.
 */

import type { SimpleIcon } from "simple-icons";
import {
  siAmd,
  siApple,
  siBankofamerica,
  siBinance,
  siBnbchain,
  siBroadcom,
  siCardano,
  siCashapp,
  siChainlink,
  siChase,
  siCisco,
  siCloudflare,
  siCocacola,
  siCoinbase,
  siDogecoin,
  siEthereum,
  siGoogle,
  siIntel,
  siMastercard,
  siMcdonalds,
  siMeta,
  siMicrostrategy,
  siNetflix,
  siNike,
  siNvidia,
  siPalantir,
  siPolkadot,
  siQantas,
  siShopify,
  siSnowflake,
  siSolana,
  siSquare,
  siStarbucks,
  siTesla,
  siVisa,
  siWise,
  siXero,
  siXrp,
} from "simple-icons";

export type LogoKind = "svg" | "bitcoin" | "collectable" | "initials";

export type LogoDescriptor = {
  kind: LogoKind;
  /** Simple Icons SVG path when kind === "svg" */
  path?: string;
  /** Brand hex (no #) when kind === "svg" */
  hex?: string;
  /** Accessible title from Simple Icons metadata */
  title?: string;
  /** Initials / symbol for fallback pill */
  initials: string;
};

/**
 * Ticker → Simple Icons slug. Only include slugs verified to exist in the
 * installed `simple-icons` package — resolveHoldingLogo looks them up and
 * falls back to initials if an icon is missing at runtime.
 */
const TICKER_SLUG: Record<string, string> = {
  // US mega / tech
  AAPL: "apple",
  GOOGL: "google",
  GOOG: "google",
  META: "meta",
  NVDA: "nvidia",
  AMD: "amd",
  TSLA: "tesla",
  MSTR: "microstrategy",
  COIN: "coinbase",
  NFLX: "netflix",
  // Finance / payments
  JPM: "chase", // Chase = JPMorgan Chase consumer brand in Simple Icons
  BAC: "bankofamerica",
  V: "visa",
  MA: "mastercard",
  // Semis / infra / software
  INTC: "intel",
  CSCO: "cisco",
  AVGO: "broadcom",
  SHOP: "shopify",
  SQ: "square", // Block (ex-Square)
  XYZ: "square",
  PLTR: "palantir",
  NET: "cloudflare",
  SNOW: "snowflake",
  // Consumer brands
  NKE: "nike",
  MCD: "mcdonalds",
  SBUX: "starbucks",
  KO: "cocacola",
  // AU listings with SI coverage
  "QAN.AX": "qantas",
  "XRO.AX": "xero",
  "WTC.AX": "wise",
  // Crypto (spot) — BTC handled separately
  "ETH-USD": "ethereum",
  ETH: "ethereum",
  "SOL-USD": "solana",
  SOL: "solana",
  "XRP-USD": "xrp",
  XRP: "xrp",
  "ADA-USD": "cardano",
  ADA: "cardano",
  "DOGE-USD": "dogecoin",
  DOGE: "dogecoin",
  "DOT-USD": "polkadot",
  DOT: "polkadot",
  "LINK-USD": "chainlink",
  LINK: "chainlink",
  "BNB-USD": "bnbchain",
  BNB: "bnbchain",
};

/** Curated slug → icon (avoids importing the full 3k+ catalog into the client). */
const ICONS_BY_SLUG: Record<string, SimpleIcon> = {
  apple: siApple,
  google: siGoogle,
  meta: siMeta,
  nvidia: siNvidia,
  amd: siAmd,
  tesla: siTesla,
  microstrategy: siMicrostrategy,
  coinbase: siCoinbase,
  netflix: siNetflix,
  chase: siChase,
  bankofamerica: siBankofamerica,
  visa: siVisa,
  mastercard: siMastercard,
  intel: siIntel,
  cisco: siCisco,
  broadcom: siBroadcom,
  shopify: siShopify,
  square: siSquare,
  cashapp: siCashapp,
  palantir: siPalantir,
  cloudflare: siCloudflare,
  snowflake: siSnowflake,
  nike: siNike,
  mcdonalds: siMcdonalds,
  starbucks: siStarbucks,
  cocacola: siCocacola,
  qantas: siQantas,
  xero: siXero,
  wise: siWise,
  ethereum: siEthereum,
  solana: siSolana,
  xrp: siXrp,
  cardano: siCardano,
  dogecoin: siDogecoin,
  polkadot: siPolkadot,
  chainlink: siChainlink,
  bnbchain: siBnbchain,
  binance: siBinance,
};

function isBitcoinTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  return (
    t === "BTC" ||
    t === "BTC-USD" ||
    t === "BTC-AUD" ||
    t === "XBT-USD" ||
    t === "BITCOIN"
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

/** Relative luminance 0–1 for a 6-char hex (no #). */
function luminance(hex: string): number {
  const h = hex.replace(/^#/, "");
  if (h.length !== 6) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Brand fill on dark zinc chip. Near-black brand colours (e.g. Apple) become
 * zinc-200 so the mark stays visible; otherwise use Simple Icons hex.
 */
export function logoFillOnDark(hex: string | undefined): string {
  if (!hex) return "#e4e4e7";
  const cleaned = hex.replace(/^#/, "");
  return luminance(cleaned) < 0.18 ? "#e4e4e7" : `#${cleaned}`;
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

  const slug = TICKER_SLUG[ticker];
  if (slug) {
    const icon = ICONS_BY_SLUG[slug];
    if (icon?.path) {
      return {
        kind: "svg",
        path: icon.path,
        hex: icon.hex,
        title: icon.title,
        initials,
      };
    }
  }

  return { kind: "initials", initials };
}

/** Exposed for tests / docs — tickers with a verified Simple Icons slug. */
export function mappedLogoTickers(): string[] {
  return Object.keys(TICKER_SLUG).sort();
}
