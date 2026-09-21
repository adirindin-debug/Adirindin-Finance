/**
 * Best-effort logo URLs for holdings list.
 * Securities: Clearbit Logo API by company domain (common AU/US map).
 * Bitcoin: inline SVG / public icon path handled in the UI component.
 * Collectables: unchanged (caller keeps ◆).
 * Broken images → initials fallback (onError in UI).
 */

export type LogoKind = "image" | "bitcoin" | "collectable" | "initials";

export type LogoDescriptor = {
  kind: LogoKind;
  /** Remote image URL when kind === "image" */
  src?: string;
  /** Initials / symbol for fallback pill */
  initials: string;
};

/** Ticker → company domain for Clearbit / favicon CDNs. */
const TICKER_DOMAIN: Record<string, string> = {
  "CBA.AX": "commbank.com.au",
  "NAB.AX": "nab.com.au",
  "WBC.AX": "westpac.com.au",
  "ANZ.AX": "anz.com.au",
  "MQG.AX": "macquarie.com",
  "BHP.AX": "bhp.com",
  "RIO.AX": "riotinto.com",
  "FMG.AX": "fmgl.com.au",
  "CSL.AX": "csl.com",
  "WOW.AX": "woolworthsgroup.com.au",
  "COL.AX": "colesgroup.com.au",
  "WES.AX": "wesfarmers.com.au",
  "TLS.AX": "telstra.com.au",
  "TCL.AX": "transurban.com",
  "QAN.AX": "qantas.com",
  "XRO.AX": "xero.com",
  "WTC.AX": "wise.com",
  "GMG.AX": "goodman.com",
  "ALL.AX": "aristocrat.com",
  "COH.AX": "cochlear.com",
  "ORG.AX": "originenergy.com.au",
  "STO.AX": "santos.com",
  "WDS.AX": "woodside.com",
  "NCM.AX": "newcrest.com",
  "S32.AX": "south32.net",
  "PLS.AX": "pilbaraminerals.com.au",
  "JHX.AX": "jameshardie.com.au",
  "REA.AX": "rea-group.com",
  "CAR.AX": "carsales.com.au",
  "SEK.AX": "seek.com.au",
  AAPL: "apple.com",
  MSFT: "microsoft.com",
  GOOGL: "abc.xyz",
  GOOG: "abc.xyz",
  AMZN: "amazon.com",
  META: "meta.com",
  NVDA: "nvidia.com",
  AMD: "amd.com",
  TSLA: "tesla.com",
  MSTR: "microstrategy.com",
  COIN: "coinbase.com",
  NFLX: "netflix.com",
  DIS: "disney.com",
  JPM: "jpmorganchase.com",
  BAC: "bankofamerica.com",
  V: "visa.com",
  MA: "mastercard.com",
  WMT: "walmart.com",
  COST: "costco.com",
  NFL: "nfl.com",
  "BRK-B": "berkshirehathaway.com",
  "BRK.B": "berkshirehathaway.com",
  JNJ: "jnj.com",
  UNH: "unitedhealthgroup.com",
  LLY: "lilly.com",
  XOM: "exxonmobil.com",
  CVX: "chevron.com",
  ORCL: "oracle.com",
  CRM: "salesforce.com",
  ADBE: "adobe.com",
  INTC: "intel.com",
  IBM: "ibm.com",
  CSCO: "cisco.com",
  AVGO: "broadcom.com",
  SHOP: "shopify.com",
  SQ: "block.xyz",
  XYZ: "block.xyz",
  PLTR: "palantir.com",
  NET: "cloudflare.com",
  SNOW: "snowflake.com",
  NKE: "nike.com",
  MCD: "mcdonalds.com",
  SBUX: "starbucks.com",
  HD: "homedepot.com",
  PG: "pg.com",
  KO: "coca-cola.com",
  PEP: "pepsico.com",
  QQQ: "invesco.com",
  SPY: "ssga.com",
  VOO: "vanguard.com",
  IVV: "ishares.com",
  IBIT: "blackrock.com",
  FBTC: "fidelity.com",
  ARKB: "ark-funds.com",
  "VAS.AX": "vanguard.com.au",
  "STW.AX": "vaneck.com.au",
  "IOZ.AX": "ishares.com",
  "NDQ.AX": "betashares.com.au",
  "IVV.AX": "ishares.com",
  "VGS.AX": "vanguard.com.au",
  "ETH-USD": "ethereum.org",
  ETH: "ethereum.org",
  "SOL-USD": "solana.com",
  SOL: "solana.com",
  "XRP-USD": "ripple.com",
  "ADA-USD": "cardano.org",
  "DOGE-USD": "dogecoin.com",
  "AVAX-USD": "avax.network",
  "DOT-USD": "polkadot.network",
  "LINK-USD": "chain.link",
  "BNB-USD": "binance.com",
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

/** Prefer Clearbit; UI may fall back via onError. */
export function logoUrlForDomain(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

export function resolveHoldingLogo(input: {
  kind: string;
  ticker: string;
  name?: string;
}): LogoDescriptor {
  const ticker = input.ticker.trim().toUpperCase();
  const initials =
    input.kind === "collectable"
      ? "◆"
      : (ticker.replace(/[^A-Z0-9]/g, "").slice(0, 2) ||
        (input.name ?? "?").slice(0, 2).toUpperCase());

  if (input.kind === "collectable") {
    return { kind: "collectable", initials: "◆" };
  }

  // Spot Bitcoin gets the dedicated orange ₿ treatment; spot ETF tickers use issuer logos.
  if (
    ticker === "BTC" ||
    ticker === "BTC-USD" ||
    ticker === "BTC-AUD" ||
    ticker === "XBT-USD" ||
    ticker === "BITCOIN"
  ) {
    return { kind: "bitcoin", initials: "₿" };
  }

  const domain = TICKER_DOMAIN[ticker];
  if (domain) {
    return {
      kind: "image",
      src: logoUrlForDomain(domain),
      initials,
    };
  }

  // Soft heuristic for unknown *-USD crypto: no fake logo
  if (isBitcoinTicker(ticker)) {
    return { kind: "bitcoin", initials: "₿" };
  }

  return { kind: "initials", initials };
}
