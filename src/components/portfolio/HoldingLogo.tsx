"use client";

import { useEffect, useState } from "react";
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
  const [imageSrc, setImageSrc] = useState(desc.src);
  const [failed, setFailed] = useState(false);
  const dimension = size === "sm" ? "h-6 w-6" : "h-10 w-10";

  useEffect(() => {
    setImageSrc(desc.src);
    setFailed(false);
  }, [desc.src]);

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
        <BitcoinGlyph className={`${dimension}`} />
        <span className="sr-only">Bitcoin</span>
      </div>
    );
  }

  if (desc.kind === "image" && imageSrc && !failed) {
    return (
      <div className={`relative flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt=""
          width={40}
          height={40}
          className="h-full w-full object-contain p-1"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (imageSrc === desc.src && desc.fallbackSrc) {
              setImageSrc(desc.fallbackSrc);
            } else {
              setFailed(true);
            }
          }}
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
