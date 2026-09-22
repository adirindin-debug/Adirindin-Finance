"use client";

import { useState } from "react";
import { resolveHoldingLogo } from "@/lib/portfolioLogos";

type Props = {
  kind: string;
  ticker: string;
  name?: string;
  color: string;
  size?: "sm" | "md";
};

function BitcoinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden role="img">
      <circle cx="16" cy="16" r="16" fill="#f7931a" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fill="#fff"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        ₿
      </text>
    </svg>
  );
}

export function HoldingLogo({ kind, ticker, name, color, size = "md" }: Props) {
  const desc = resolveHoldingLogo({ kind, ticker, name });
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const dimension = size === "sm" ? "h-6 w-6" : "h-10 w-10";
  const pad = size === "sm" ? "p-1" : "p-1.5";

  if (desc.kind === "collectable") {
    return (
      <div
        className={`flex ${dimension} shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black`}
        style={{ backgroundColor: color }}
        aria-hidden
      >
        ◆
      </div>
    );
  }

  if (desc.kind === "bitcoin") {
    return (
      <div className={`flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-full`}>
        <BitcoinGlyph className={dimension} />
        <span className="sr-only">Bitcoin</span>
      </div>
    );
  }

  if (desc.kind === "logo-dev" && desc.src && failedSrc !== desc.src) {
    return (
      <div
        className={`flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 ${pad}`}
        role="img"
        aria-label={`${desc.label ?? ticker} logo`}
      >
        {/* The browser only sees our local proxy URL; the Logo.dev token stays server-side. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={desc.src}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailedSrc(desc.src ?? null)}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex ${dimension} shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black`}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {desc.initials}
    </div>
  );
}
