"use client";

export function BtcCycleFrame() {
  return (
    <div className="mt-6 space-y-3">
      <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted">
        If the chart is blank,{" "}
        <a
          href="/btc-cycle-map.html"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent hover:underline"
        >
          open full page
        </a>
        .
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <iframe
          src="/btc-cycle-map.html?embed=1"
          className="w-full border-0"
          style={{ height: 1200, background: "#000" }}
          title="BTC 4-Year Cycle Map"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
