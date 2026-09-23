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

/** Sample a dominant non-transparent, non-near-white colour from a loaded image. */
function sampleDominantBrandColor(img: HTMLImageElement): string | null {
  try {
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue; // skip transparent / faint pixels
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Skip near-white (and very light gray) so transparent edges don't dominate
      if (r > 240 && g > 240 && b > 240) continue;
      rSum += r;
      gSum += g;
      bSum += b;
      count += 1;
    }

    if (count === 0) return null;
    const r = Math.round(rSum / count);
    const g = Math.round(gSum / count);
    const b = Math.round(bSum / count);
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    // CORS/taint or canvas failure — leave background unset
    return null;
  }
}

export function HoldingLogo({ kind, ticker, name, color, size = "md" }: Props) {
  const desc = resolveHoldingLogo({ kind, ticker, name });
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [brandBg, setBrandBg] = useState<string | undefined>(undefined);
  const dimension = size === "sm" ? "h-6 w-6" : "h-10 w-10";

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
        className={`overflow-hidden rounded-full ${dimension} shrink-0`}
        style={brandBg ? { backgroundColor: brandBg } : undefined}
        role="img"
        aria-label={`${desc.label ?? ticker} logo`}
      >
        {/* Browser loads Logo.dev directly with the publishable (pk_) token. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={desc.src}
          alt=""
          crossOrigin="anonymous"
          className="h-full w-full object-cover"
          onLoad={(e) => {
            const sampled = sampleDominantBrandColor(e.currentTarget);
            if (sampled) setBrandBg(sampled);
          }}
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
