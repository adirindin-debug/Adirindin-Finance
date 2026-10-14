"use client";

import { useEffect, useState } from "react";

/** "Data updated" stamp from the live BTC feed's own as-of time, shown in Sydney time (AEDT/AEST). */
export function DataUpdated() {
  const [asOf, setAsOf] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/btc-info")
      .then((r) => r.json() as Promise<{ ok?: boolean; asOf?: string }>)
      .then((j) => {
        if (!cancelled && j.ok && j.asOf) setAsOf(j.asOf);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  if (!asOf) return <span className="text-xs text-muted/70">&nbsp;</span>;
  const d = new Date(asOf);
  const txt = d.toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
      Data updated <time dateTime={asOf}>{txt}</time>
    </span>
  );
}
