"use client";

type Props = {
  /** Homepage embed: slightly taller iframe, quieter blank-chart tip */
  compact?: boolean;
};

export function BtcCycleFrame({ compact = false }: Props) {
  return (
    <div className={compact ? "space-y-3" : "mt-6 space-y-3"}>
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <iframe
          src="/btc-cycle-map.html?embed=1"
          className="w-full border-0"
          style={{ height: compact ? 1180 : 1200, background: "#000" }}
          title="BTC 4-Year Cycle Map"
          allow="fullscreen"
          loading={compact ? "lazy" : undefined}
        />
      </div>
    </div>
  );
}
