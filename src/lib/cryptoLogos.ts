/**
 * Spot-crypto logo helpers: detect coin tickers (vs equity crypto ETFs/trusts)
 * and map common symbols to CoinGecko CDN image URLs.
 */

/** Equity products that trade crypto exposure — keep Logo.dev, not CoinGecko. */
const CRYPTO_EQUITY_TICKERS = new Set([
  "GBTC",
  "ETHE",
  "BITB",
  "IBIT",
  "FBTC",
  "ARKB",
  "BTCO",
  "HODL",
  "BITO",
  "XBTO",
  "BTCW",
  "BRRR",
  "EZBC",
  "DEFI",
  "BITS",
  "BITU",
  "SBIT",
  "ETHA",
  "ETHW",
  "FETH",
  "QETH",
  "CETH",
  "TYPE",
  "EZET",
  "ETHV",
  "SOLZ",
  "GSOL",
  "TSOL",
]);

/** Base symbols that are spot crypto even without a *-USD / *-AUD suffix. */
const SPOT_CRYPTO_BASES = new Set([
  "BTC",
  "XBT",
  "BITCOIN",
  "ETH",
  "ETHEREUM",
  "SOL",
  "SOLANA",
  "XRP",
  "ADA",
  "DOGE",
  "BNB",
  "AVAX",
  "DOT",
  "LINK",
  "LTC",
  "BCH",
  "MATIC",
  "POL",
  "ATOM",
  "USDT",
  "USDC",
  "TRX",
  "NEAR",
  "UNI",
  "AAVE",
  "SHIB",
  "PEPE",
  "TON",
  "SUI",
  "APT",
  "ARB",
  "OP",
  "WIF",
  "BONK",
  "HYPE",
  "TAO",
  "RENDER",
  "FET",
  "INJ",
  "SEI",
  "TIA",
  "ALGO",
  "XLM",
  "VET",
  "FIL",
  "ICP",
  "HBAR",
  "APTOS",
]);

/**
 * Stable CoinGecko CDN URLs (large) for common coins.
 * Prefer these over live API lookups to avoid rate limits.
 */
export const COINGECKO_IMAGE_BY_SYMBOL: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  XBT: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  BITCOIN: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  ETHEREUM: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  SOLANA: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  XRP: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
  ADA: "https://assets.coingecko.com/coins/images/975/large/cardano.png",
  DOGE: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  BNB: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  AVAX:
    "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  DOT: "https://coin-images.coingecko.com/coins/images/12171/large/polkadot.jpg",
  LINK: "https://coin-images.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png",
  LTC: "https://assets.coingecko.com/coins/images/2/large/litecoin.png",
  BCH: "https://coin-images.coingecko.com/coins/images/780/large/bitcoin-cash-circle.png",
  ATOM: "https://coin-images.coingecko.com/coins/images/1481/large/cosmos_hub.png",
  MATIC: "https://coin-images.coingecko.com/coins/images/4713/large/polygon.png",
  POL: "https://coin-images.coingecko.com/coins/images/32440/large/pol.png",
  USDT: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png",
  USDC: "https://coin-images.coingecko.com/coins/images/6319/large/usdc.png",
  TRX: "https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png",
  NEAR: "https://coin-images.coingecko.com/coins/images/10365/large/near.jpg",
  UNI: "https://coin-images.coingecko.com/coins/images/12504/large/uniswap-logo.png",
  AAVE: "https://coin-images.coingecko.com/coins/images/12645/large/aave-token-round.png",
  SHIB: "https://coin-images.coingecko.com/coins/images/11939/large/shiba.png",
  PEPE: "https://coin-images.coingecko.com/coins/images/29850/large/pepe-token.jpeg",
  TON: "https://coin-images.coingecko.com/coins/images/17980/large/ton_symbol.png",
  SUI: "https://coin-images.coingecko.com/coins/images/26375/large/sui-ocean-square.png",
  APT: "https://coin-images.coingecko.com/coins/images/26455/large/aptos_round.png",
  ARB: "https://coin-images.coingecko.com/coins/images/16547/large/arb.jpg",
  OP: "https://coin-images.coingecko.com/coins/images/25244/large/Optimism.png",
  WIF: "https://coin-images.coingecko.com/coins/images/33566/large/dogwifhat.jpg",
  BONK: "https://coin-images.coingecko.com/coins/images/28600/large/bonk.jpg",
  HYPE: "https://coin-images.coingecko.com/coins/images/50882/large/hyperliquid.jpg",
  RENDER: "https://coin-images.coingecko.com/coins/images/11636/large/rndr.png",
  INJ: "https://coin-images.coingecko.com/coins/images/12882/large/Secondary_Symbol.png",
  SEI: "https://coin-images.coingecko.com/coins/images/28205/large/Sei_Logo_-_Transparent.png",
  TIA: "https://coin-images.coingecko.com/coins/images/31967/large/tia.jpg",
  ALGO: "https://coin-images.coingecko.com/coins/images/4380/large/download.png",
  XLM: "https://coin-images.coingecko.com/coins/images/100/large/Stellar_symbol_black_RGB.png",
  FIL: "https://coin-images.coingecko.com/coins/images/12817/large/filecoin.png",
  ICP: "https://coin-images.coingecko.com/coins/images/14495/large/Internet_Computer_logo.png",
  HBAR: "https://coin-images.coingecko.com/coins/images/3688/large/hbar.png",
};

/** CoinGecko coin id for search fallback / /coins/{id} lookups. */
export const COINGECKO_ID_BY_SYMBOL: Record<string, string> = {
  BTC: "bitcoin",
  XBT: "bitcoin",
  BITCOIN: "bitcoin",
  ETH: "ethereum",
  ETHEREUM: "ethereum",
  SOL: "solana",
  SOLANA: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  BNB: "binancecoin",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  USDT: "tether",
  USDC: "usd-coin",
  TRX: "tron",
  NEAR: "near",
  UNI: "uniswap",
  AAVE: "aave",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  TON: "the-open-network",
  SUI: "sui",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  WIF: "dogwifcoin",
  BONK: "bonk",
  HYPE: "hyperliquid",
  RENDER: "render-token",
  INJ: "injective-protocol",
  SEI: "sei-network",
  TIA: "celestia",
  ALGO: "algorand",
  XLM: "stellar",
  FIL: "filecoin",
  ICP: "internet-computer",
  HBAR: "hedera-hashgraph",
  TAO: "bittensor",
  FET: "fetch-ai",
};

/** Strip Yahoo/exchange pair suffixes to a base symbol (ETH-USD → ETH). */
export function cryptoBaseSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  const pair = t.match(/^([A-Z0-9]+)[-/](USD|AUD|USDT|USDC|BTC|ETH)$/);
  if (pair) return pair[1]!;
  return t;
}

export function isCryptoEquityProduct(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  const base = cryptoBaseSymbol(t);
  return CRYPTO_EQUITY_TICKERS.has(t) || CRYPTO_EQUITY_TICKERS.has(base);
}

/**
 * Spot crypto (CoinGecko path), not equity ETFs/trusts and not ASX/US stocks.
 * Mirrors digital_assets heuristics: *-USD/*-AUD pairs and known base aliases.
 */
export function isSpotCryptoTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase();
  if (!t || isCryptoEquityProduct(t)) return false;
  // Equity-style suffixes (.AX, .L, etc.) are never spot crypto pairs
  if (/\.[A-Z]{1,4}$/.test(t)) return false;

  if (t.endsWith("-USD") || t.endsWith("-AUD") || t.endsWith("/USD") || t.endsWith("/AUD")) {
    return true;
  }

  const base = cryptoBaseSymbol(t);
  if (SPOT_CRYPTO_BASES.has(base) || SPOT_CRYPTO_BASES.has(t)) return true;

  // Loose alias: BTC|ETH|SOL|… at start then - or end (same as portfolioSectors)
  if (
    /^(BTC|XBT|ETH|SOL|XRP|ADA|DOGE|BNB|AVAX|DOT|LINK|LTC|BCH|MATIC|POL|ATOM|USDT|USDC)(-|$)/.test(
      t,
    )
  ) {
    return true;
  }

  return false;
}

export function isBitcoinTicker(ticker: string): boolean {
  const base = cryptoBaseSymbol(ticker);
  return base === "BTC" || base === "XBT" || base === "BITCOIN";
}

/** Browser src for the same-origin proxy (CORS-friendly brand colour sampling). */
export function cryptoLogoProxyUrl(ticker: string): string {
  return `/api/crypto-logo?ticker=${encodeURIComponent(ticker.trim().toUpperCase())}`;
}
