import { logoFillOnDark, resolveHoldingLogo } from "@/lib/portfolioLogos";

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

function SimpleIconGlyph({
  path,
  hex,
  title,
  className,
}: {
  path: string;
  hex?: string;
  title?: string;
  className?: string;
}) {
  const fill = logoFillOnDark(hex);
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={!title}
    >
      {title ? <title>{title}</title> : null}
      <path d={path} fill={fill} />
    </svg>
  );
}

export function HoldingLogo({ kind, ticker, name, color, size = "md" }: Props) {
  const desc = resolveHoldingLogo({ kind, ticker, name });
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
        <BitcoinGlyph className={`${dimension}`} />
        <span className="sr-only">Bitcoin</span>
      </div>
    );
  }

  if (desc.kind === "svg" && desc.path) {
    return (
      <div
        className={`relative flex ${dimension} shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 ${pad}`}
      >
        <SimpleIconGlyph
          path={desc.path}
          hex={desc.hex}
          title={desc.title}
          className="h-full w-full"
        />
        {desc.title ? <span className="sr-only">{desc.title}</span> : null}
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
