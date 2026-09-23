const DAY_MS = 86_400_000;
const BLOCKS_PER_HALVING = 210_000;
const ESTIMATED_BLOCK_TIME_MS = 10 * 60 * 1000;

export const LAST_HALVING = Date.parse("2024-04-19T00:00:00Z");

// Estimate the next halving from the last known halving and Bitcoin's
// 210,000-block interval at the protocol's 10-minute target block time.
export const NEXT_HALVING =
  LAST_HALVING + BLOCKS_PER_HALVING * ESTIMATED_BLOCK_TIME_MS;

export function daysSinceHalving(now = Date.now()) {
  return Math.floor((now - LAST_HALVING) / DAY_MS);
}

export function daysUntilNextHalving(now = Date.now()) {
  return Math.max(0, Math.ceil((NEXT_HALVING - now) / DAY_MS));
}
