"use client";

import { useState } from "react";
import { resolveHoldingLogo } from "@/lib/portfolioLogos";

type Props = {
  kind: string;
  ticker: string;
  name?: string;
  color: string;
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

export function HoldingLogo({ kind, ticker, name, color }: Props) {
  const desc = resolveHoldingLogo({ kind, ticker, name });
  const [failed, setFailed] = useState(false);

  if (desc.kind === "collectable") {
    return (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        ◆
      </div>
    );
  }

  if (desc.kind === "bitcoin") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
        <BitcoinGlyph className="h-10 w-10" />
        <span className="sr-only">Bitcoin</span>
      </div>
    );
  }

  if (desc.kind === "image" && desc.src && !failed) {
    return (
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={desc.src}
          alt=""
          width={40}
          height={40}
          className="h-full w-full object-contain p-1"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-black"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {desc.initials}
    </div>
  );
}
