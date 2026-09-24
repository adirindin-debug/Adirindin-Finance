const DAY_MS = 86_400_000;
const BLOCKS_PER_HALVING = 210_000;
const ESTIMATED_BLOCK_TIME_MS = 10 * 60 * 1000;

/** Completed halvings (UTC calendar dates). Fourth matches desk MarketStrip. */
export const COMPLETED_HALVINGS: ReadonlyArray<{
  label: string;
  at: number;
  block: number;
}> = [
  { label: "1st", at: Date.parse("2012-11-28T00:00:00Z"), block: 210_000 },
  { label: "2nd", at: Date.parse("2016-07-09T00:00:00Z"), block: 420_000 },
  { label: "3rd", at: Date.parse("2020-05-11T00:00:00Z"), block: 630_000 },
  { label: "4th", at: Date.parse("2024-04-19T00:00:00Z"), block: 840_000 },
];

export const LAST_HALVING = COMPLETED_HALVINGS[COMPLETED_HALVINGS.length - 1]!.at;

// Estimate the next halving from the last known halving and Bitcoin's
// 210,000-block interval at the protocol's 10-minute target block time.
export const NEXT_HALVING =
  LAST_HALVING + BLOCKS_PER_HALVING * ESTIMATED_BLOCK_TIME_MS;

export const NEXT_HALVING_BLOCK = 1_050_000;

export function daysSinceHalving(now = Date.now()) {
  return Math.floor((now - LAST_HALVING) / DAY_MS);
}

export function daysUntilNextHalving(now = Date.now()) {
  return Math.max(0, Math.ceil((NEXT_HALVING - now) / DAY_MS));
}

const auDate = new Intl.DateTimeFormat("en-AU", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatHalvingDate(ms: number) {
  return auDate.format(new Date(ms));
}

/** Rows for the theory-chart hover card (completed + next until it lands). */
export function halvingHoverRows(now = Date.now()): Array<{
  title: string;
  detail: string;
  estimated: boolean;
}> {
  const rows = COMPLETED_HALVINGS.map((h) => ({
    title: `${h.label} · block ${h.block.toLocaleString("en-AU")}`,
    detail: formatHalvingDate(h.at),
    estimated: false,
  }));

  if (now < NEXT_HALVING) {
    rows.push({
      title: `Next · block ${NEXT_HALVING_BLOCK.toLocaleString("en-AU")}`,
      detail: `~${formatHalvingDate(NEXT_HALVING)} (estimated)`,
      estimated: true,
    });
  } else {
    rows.push({
      title: `5th · block ${NEXT_HALVING_BLOCK.toLocaleString("en-AU")}`,
      detail: formatHalvingDate(NEXT_HALVING),
      estimated: false,
    });
  }

  return rows;
}
