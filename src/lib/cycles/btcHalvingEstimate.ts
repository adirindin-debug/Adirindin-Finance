/**
 * Hub-tile halving countdown (Market cycles hub only — the BTC detail page keeps
 * using src/lib/bitcoinHalving.ts; both date the 4th halving 20 Apr 2024).
 *
 * Past halvings are fixed historical dates (UTC). The next halving has no fixed
 * date: it happens at a block height, so the tile estimates it from a block-height
 * anchor at Bitcoin's ~10-minute target block time and always shows it as
 * approximate ("~Apr 2028 est."). The anchor is the live chain tip when the
 * browser can fetch it (see fetchBtcTipAnchor), else the cached snapshot below.
 * Educational estimate only · NFA.
 */

const DAY_MS = 86_400_000;
const BLOCKS_PER_HALVING = 210_000;
/** Protocol target block time (~10 minutes). */
const TARGET_BLOCK_MS = 10 * 60 * 1000;

/** Completed halvings: fixed historical dates (UTC) of blocks 210k / 420k / 630k / 840k. */
export const TILE_COMPLETED_HALVINGS: ReadonlyArray<{ block: number; at: number }> = [
  { block: 210_000, at: Date.UTC(2012, 10, 28) },
  { block: 420_000, at: Date.UTC(2016, 6, 9) },
  { block: 630_000, at: Date.UTC(2020, 4, 11) },
  { block: 840_000, at: Date.UTC(2024, 3, 20) },
];

export type BtcTipAnchor = {
  /** Chain-tip block height. */
  height: number;
  /** When that height was observed (UTC ms). */
  atMs: number;
};

/**
 * Cached fallback anchor: chain tip block 970,145, mined 2026-10-06 06:36:30 UTC
 * (snapshot from mempool.space / blockstream.info, 6 Oct 2026).
 */
export const CACHED_TIP_ANCHOR: BtcTipAnchor = {
  height: 970_145,
  atMs: 1_791_268_590_000,
};

export type HalvingTarget = {
  block: number;
  at: number;
  /** True when the date is an estimate (not yet happened as of the anchor). */
  estimated: boolean;
};

/** Next halving after `nowMs`: fixed historical date, or a ~10 min/block estimate. */
export function nextHalvingAt(nowMs: number, anchor: BtcTipAnchor = CACHED_TIP_ANCHOR): HalvingTarget {
  const lastFixed = TILE_COMPLETED_HALVINGS[TILE_COMPLETED_HALVINGS.length - 1]!;
  const past = TILE_COMPLETED_HALVINGS.find((h) => h.at > nowMs);
  if (past) return { block: past.block, at: past.at, estimated: false };
  /* Estimated height at nowMs from the anchor, then the next 210,000-block boundary. */
  const heightNow = anchor.height + Math.max(0, nowMs - anchor.atMs) / TARGET_BLOCK_MS;
  const block = Math.max(
    lastFixed.block + BLOCKS_PER_HALVING,
    (Math.floor(heightNow / BLOCKS_PER_HALVING) + 1) * BLOCKS_PER_HALVING,
  );
  return { block, at: anchor.atMs + (block - anchor.height) * TARGET_BLOCK_MS, estimated: true };
}

const monthYear = new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", month: "short", year: "numeric" });
const dayMonthYear = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "~555d to halving (~Apr 2028 est.)" · "120d to halving (20 Apr 2024)". */
export function halvingCountdownText(dayMs: number, anchor?: BtcTipAnchor): string {
  const h = nextHalvingAt(dayMs, anchor);
  const days = Math.max(0, Math.round((h.at - dayMs) / DAY_MS));
  return h.estimated
    ? `~${days}d to halving (~${monthYear.format(new Date(h.at))} est.)`
    : `${days}d to halving (${dayMonthYear.format(new Date(h.at))})`;
}

/** Live chain tip from public block explorers (browser, CORS-enabled); null on failure. */
export async function fetchBtcTipAnchor(timeoutMs = 6000): Promise<BtcTipAnchor | null> {
  const urls = ["https://blockstream.info/api/blocks/tip/height", "https://mempool.space/api/blocks/tip/height"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
      if (!res.ok) continue;
      const height = Number((await res.text()).trim());
      if (Number.isInteger(height) && height > CACHED_TIP_ANCHOR.height - 1000 && height < 5_000_000) {
        return { height, atMs: Date.now() };
      }
    } catch {
      /* try the next explorer; fall back to the cached anchor */
    }
  }
  return null;
}
