import { KNOWN_LISTINGS } from "./catalog";
import type { Mark, PropertyType } from "./types";

export type ListingLookup = {
  url: string;
  address: string;
  suburb: string;
  postcode: string;
  type: PropertyType;
  marks: Mark[];
  source: "page" | "url" | "catalog" | "mixed";
  note: string;
};

const STATES = "nsw|vic|qld|sa|wa|tas|nt|act";
const TYPES: Record<string, PropertyType> = {
  house: "house",
  unit: "unit",
  apartment: "unit",
  townhouse: "townhouse",
  villa: "house",
  acreage: "house",
  rural: "house",
  land: "house",
  "dual-occupancy": "dual occupancy",
  duplex: "dual occupancy",
};

const STREET: Record<string, string> = {
  st: "Street",
  street: "Street",
  rd: "Road",
  road: "Road",
  ave: "Avenue",
  av: "Avenue",
  avenue: "Avenue",
  dr: "Drive",
  drive: "Drive",
  ct: "Court",
  court: "Court",
  pl: "Place",
  place: "Place",
  cl: "Close",
  close: "Close",
  pde: "Parade",
  parade: "Parade",
  tce: "Terrace",
  terrace: "Terrace",
  hwy: "Highway",
  highway: "Highway",
  cct: "Circuit",
  circuit: "Circuit",
  bvd: "Boulevard",
  blvd: "Boulevard",
  boulevard: "Boulevard",
  ln: "Lane",
  lane: "Lane",
  cres: "Crescent",
  crescent: "Crescent",
  cr: "Crescent",
};

export function canonUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.search = "";
    let path = u.pathname.replace(/\/+$/, "");
    u.pathname = path;
    u.hostname = u.hostname.replace(/^www\./, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.trim().replace(/\/$/, "").split("?")[0] ?? "";
  }
}

export function slugKey(url: string): string {
  const c = canonUrl(url).toLowerCase();
  const path = c.replace(/^https?:\/\/[^/]+/, "");
  return path.replace(/\/+$/, "");
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const low = w.toLowerCase();
      if (STREET[low]) return STREET[low];
      if (/^\d/.test(w)) return w.toUpperCase();
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(" ");
}

function money(raw: string): number | null {
  const t = raw.replace(/,/g, "").replace(/\s/g, "").toLowerCase();
  const m = t.match(/\$?([\d.]+)\s*(m|million|k)?/i);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suf = (m[2] ?? "").toLowerCase();
  if (suf === "m" || suf === "million") n *= 1_000_000;
  else if (suf === "k") n *= 1_000;
  else if (n < 300 && !suf) n *= 1_000_000; // "$1.45" style in some JSON
  if (n < 10_000 || n > 80_000_000) return null;
  return Math.round(n);
}

function isoDate(raw: string): string | null {
  const s = raw.trim();
  const iso = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = s.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (dmy) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mo = months[dmy[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return `${dmy[3]}-${mo}-${dmy[1].padStart(2, "0")}`;
  }
  return null;
}

export function parseListingUrl(raw: string): Partial<ListingLookup> | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = decodeURIComponent(u.pathname).replace(/\/+$/, "");
  if (host.includes("realestate.com.au")) {
    const listing = path.match(
      new RegExp(
        `^/property-([a-z-]+)-(${STATES})-([a-z0-9+-]+)-(\\d+)$`,
        "i",
      ),
    );
    if (listing) {
      const type = TYPES[listing[1].toLowerCase()] ?? "unknown";
      const suburb = titleCase(listing[3].replace(/[+_-]+/g, " "));
      return {
        url: u.toString(),
        type,
        suburb,
        address: "",
        postcode: "",
      };
    }
    const profile = path.match(
      new RegExp(
        `^/property/(?:([a-z]+)-)?(.+)-(${STATES})-(\\d{4})$`,
        "i",
      ),
    );
    if (profile) {
      const type = TYPES[(profile[1] ?? "").toLowerCase()] ?? "unknown";
      const rest = profile[2].replace(/_/g, "-");
      const bits = rest.split("-").filter(Boolean);
      let addressBits = bits;
      let suburbBits: string[] = [];
      // suburb is the last 1–4 tokens that are not street suffixes / numbers
      const streetIdx = [...bits].reverse().findIndex((b, i, arr) => {
        const orig = bits[bits.length - 1 - i];
        return STREET[orig.toLowerCase()] || /^\d/.test(orig);
      });
      if (streetIdx >= 0) {
        const cut = bits.length - streetIdx;
        addressBits = bits.slice(0, cut);
        suburbBits = bits.slice(cut);
      } else if (bits.length >= 2) {
        suburbBits = bits.slice(-2);
        addressBits = bits.slice(0, -2);
      }
      let street = titleCase(addressBits.join(" "));
      const unit = street.match(/^Unit\s+(\d+)\s+(\d+)/i);
      if (unit) street = `${unit[1]}/${unit[2]}${street.slice(unit[0].length)}`;
      const lead = street.match(/^(\d+)\s+(\d+)\s/);
      if (lead) street = `${lead[1]}/${lead[2]} ${street.slice(lead[0].length)}`;
      return {
        url: u.toString(),
        type: type === "unknown" && path.includes("/unit-") ? "unit" : type,
        address: street,
        suburb: titleCase(suburbBits.join(" ")),
        postcode: profile[4],
      };
    }
  }
  if (host.includes("domain.com.au")) {
    const m = path.match(
      new RegExp(`^/(.+)-(${STATES})-(\\d{4})-(\\d+)$`, "i"),
    );
    if (m) {
      const bits = m[1].replace(/_/g, "-").split("-").filter(Boolean);
      const streetIdx = bits.findIndex((b, i) => STREET[b.toLowerCase()] && i > 0);
      let addressBits = bits;
      let suburbBits: string[] = [];
      if (streetIdx >= 0) {
        addressBits = bits.slice(0, streetIdx + 1);
        suburbBits = bits.slice(streetIdx + 1);
      }
      return {
        url: u.toString(),
        address: titleCase(addressBits.join(" ")),
        suburb: titleCase(suburbBits.join(" ")),
        postcode: m[3],
        type: "unknown",
      };
    }
  }
  return null;
}

function fromCatalog(url: string): ListingLookup | null {
  const key = slugKey(url);
  const hit = KNOWN_LISTINGS.find((p) => slugKey(p.url) === key);
  if (!hit) return null;
  return {
    url: hit.url,
    address: hit.address,
    suburb: hit.suburb,
    postcode: hit.postcode,
    type: hit.type,
    marks: hit.marks.map((m) => ({ ...m })),
    source: "catalog",
    note: "Public prints from the REA profile.",
  };
}

function walkJson(node: unknown, acc: Mark[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) walkJson(x, acc);
    return;
  }
  const o = node as Record<string, unknown>;
  const price =
    money(String(o.soldPrice ?? o.salePrice ?? o.price ?? o.displayPrice ?? "")) ??
    (typeof o.soldPrice === "number" ? o.soldPrice : null) ??
    (typeof o.price === "number" ? o.price : null);
  const date = isoDate(String(o.soldDate ?? o.date ?? o.saleDate ?? o.eventDate ?? ""));
  const kind = String(o.eventType ?? o.type ?? o.status ?? "").toLowerCase();
  if (price && date && (kind.includes("sold") || kind.includes("sale") || o.soldPrice != null)) {
    acc.push({
      date,
      low: price,
      mid: price,
      high: price,
      method: "sale",
      note: "REA listing page sold print.",
    });
  }
  const low = money(String(o.priceFrom ?? o.lowPrice ?? o.minPrice ?? ""));
  const high = money(String(o.priceTo ?? o.highPrice ?? o.maxPrice ?? ""));
  if (low && high && high >= low) {
    const mid = Math.round((low + high) / 2);
    acc.push({
      date: isoDate(String(o.date ?? "")) ?? new Date().toISOString().slice(0, 10),
      low,
      mid,
      high,
      method: "estimate",
      note: "REA displayed price range.",
    });
  }
  for (const v of Object.values(o)) walkJson(v, acc);
}

function parseHtml(html: string): Partial<ListingLookup> {
  const marks: Mark[] = [];
  const ldBlocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of ldBlocks) {
    try {
      walkJson(JSON.parse(b[1]), marks);
    } catch {
      /* ignore */
    }
  }
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (next) {
    try {
      walkJson(JSON.parse(next[1]), marks);
    } catch {
      /* ignore */
    }
  }
  const soldRe =
    /Sold(?:\s+for)?\s*(\$[\d,]+(?:\.\d+)?(?:\s*[mk])?|\d[\d,]+)\s*(?:on\s+)?(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})?/gi;
  let m: RegExpExecArray | null;
  while ((m = soldRe.exec(html))) {
    const price = money(m[1]);
    const date = m[2] ? isoDate(m[2]) : null;
    if (price && date) {
      marks.push({
        date,
        low: price,
        mid: price,
        high: price,
        method: "sale",
        note: `REA page sold ${m[1]}.`,
      });
    }
  }
  const range = html.match(
    /\$([\d,.]+)\s*(?:m|k)?\s*[–—-]\s*\$([\d,.]+)\s*(m|k)?/i,
  );
  if (range) {
    const low = money("$" + range[1] + (range[3] ?? ""));
    const high = money("$" + range[2] + (range[3] ?? ""));
    if (low && high && high >= low) {
      marks.push({
        date: new Date().toISOString().slice(0, 10),
        low,
        mid: Math.round((low + high) / 2),
        high,
        method: "estimate",
        note: "REA displayed range.",
      });
    }
  }
  const uniq = new Map<string, Mark>();
  for (const mk of marks) uniq.set(`${mk.date}-${mk.mid}-${mk.method}`, mk);
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? "";
  const addr = title.split("|")[0]?.split("-")[0]?.trim() ?? "";
  return { marks: [...uniq.values()].sort((a, b) => a.date.localeCompare(b.date)), address: addr };
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-AU,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.length < 2000 || text.includes("KPSDK")) return null;
    return text;
  } catch {
    return null;
  }
}

function merge(
  url: string,
  parsed: Partial<ListingLookup> | null,
  catalog: ListingLookup | null,
  page: Partial<ListingLookup> | null,
): ListingLookup | null {
  const address = (page?.address || parsed?.address || catalog?.address || "").trim();
  const suburb = (parsed?.suburb || catalog?.suburb || "").trim();
  const postcode = (parsed?.postcode || catalog?.postcode || "").trim();
  const type = parsed?.type || catalog?.type || "unknown";
  const marks = (page?.marks?.length ? page.marks : catalog?.marks) ?? [];
  if (!address && !suburb && !catalog) return null;
  const source: ListingLookup["source"] =
    page?.marks?.length && catalog ? "mixed" : page?.marks?.length ? "page" : catalog ? "catalog" : "url";
  return {
    url: catalog?.url || url,
    address: address || [parsed?.address, suburb].filter(Boolean).join(", "),
    suburb,
    postcode,
    type,
    marks,
    source,
    note:
      marks.some((m) => m.method === "sale")
        ? `${marks.filter((m) => m.method === "sale").length} public sale print(s) from the listing.`
        : marks.length
          ? "Estimate range from the listing — no disclosed sale."
          : "Address from the URL. REA blocked live sale history on this request.",
  };
}

export async function lookupListing(rawUrl: string): Promise<ListingLookup | null> {
  const url = rawUrl.trim();
  if (!url) return null;
  const parsed = parseListingUrl(url);
  const catalog = fromCatalog(url);
  const html = await fetchPage(url);
  const page = html ? parseHtml(html) : null;
  return merge(url, parsed, catalog, page);
}
