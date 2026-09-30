"use client";

import { useEffect, useState } from "react";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Client-only "now" for calendar-dated Live markers.
 * Returns null during SSR / static prerender and the first client render
 * (so server HTML and hydration match), then the real current time after
 * mount. Re-ticks hourly and whenever the tab becomes visible again, so the
 * marker stays current without a redeploy.
 */
export function useLiveNow(intervalMs: number = HOUR_MS): number | null {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);

  return nowMs;
}
