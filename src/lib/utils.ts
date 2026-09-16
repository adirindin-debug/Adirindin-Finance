export function cn(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

export function aud(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function signedAud(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n === 0) return aud(0);
  const sign = n > 0 ? "+" : "−";
  return `${sign}${aud(Math.abs(n))}`;
}

export function signedPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/** Split a pasted AU line like "12 Foo St, Preston VIC 3072". */
export function parseAuAddress(raw: string): {
  address: string;
  suburb: string;
  postcode: string;
} {
  let s = raw.trim().replace(/\s+/g, " ");
  let postcode = "";
  const pc = s.match(/\b(\d{4})\s*$/);
  if (pc) {
    postcode = pc[1];
    s = s.slice(0, pc.index).trim().replace(/[,\s]+$/, "");
  }
  s = s.replace(/,?\s*(VIC|NSW|QLD|SA|WA|TAS|NT|ACT)\.?$/i, "").trim();
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { address: parts[0], suburb: parts.slice(1).join(" "), postcode };
  }
  return { address: s, suburb: "", postcode };
}
