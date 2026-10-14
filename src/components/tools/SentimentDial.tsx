import { ZONES, zoneFor } from "@/lib/marketSentiment";

/* Half-dial geometry (viewBox 0 0 240 140). */
const CX = 120;
const CY = 120;
const R = 96;
const pt = (score: number, r = R) => {
  const a = Math.PI * (1 - Math.min(100, Math.max(0, score)) / 100);
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
};
const arc = (a: number, b: number, r = R) => {
  const p0 = pt(a, r);
  const p1 = pt(b, r);
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
};

/** Coloured half-dial: zone arcs, the live zone lit, a soft inner track and a glowing needle tip. Display only. */
export function SentimentDial({ score, className = "h-[130px] w-[220px]" }: { score: number | null; className?: string }) {
  const zone = score != null ? zoneFor(score) : null;
  const tip = score != null ? pt(score, R - 20) : null;
  const uid = "sd";
  return (
    <svg viewBox="0 0 240 140" className={`shrink-0 ${className}`} role="img" aria-label={score != null ? `Market sentiment score ${score.toFixed(0)} of 100, ${zone!.label}` : "Market sentiment gauge"}>
      <defs>
        <filter id={`${uid}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      {/* faint inner track */}
      <path d={arc(0, 100, R - 14)} stroke="#1a2230" strokeWidth="2" fill="none" />
      {ZONES.map((z) => {
        const lit = zone?.key === z.key;
        return (
          <path
            key={z.key}
            d={arc(z.min + 1, z.max - 1)}
            stroke={z.color}
            strokeOpacity={lit ? 1 : 0.5}
            strokeWidth={lit ? 15 : 12}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}
      {/* tick for the exact score on the arc */}
      {score != null ? <circle cx={pt(score).x} cy={pt(score).y} r="3" fill="#0b0f14" stroke="#e8eef7" strokeWidth="1.5" /> : null}
      {tip ? (
        <>
          <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke="#dbe3ee" strokeWidth="3" strokeLinecap="round" />
          <circle cx={tip.x} cy={tip.y} r="7" fill={zone!.color} opacity="0.55" filter={`url(#${uid}-glow)`} />
          <circle cx={tip.x} cy={tip.y} r="3.6" fill={zone!.color} />
          <circle cx={CX} cy={CY} r="6.5" fill="#0b0f14" stroke="#dbe3ee" strokeWidth="2.5" />
        </>
      ) : (
        <circle cx={CX} cy={CY} r="6" fill="#3a4558" />
      )}
    </svg>
  );
}
