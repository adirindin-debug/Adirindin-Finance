import { KNOWN_LISTINGS } from "./catalog";
import type { Mark, PropertyType } from "./types";

export type ListingLookup = {
  url: string;
  address: string;
  suburb: string;
  postcode: string;
  state?: string;
  type: PropertyType;
  marks: Mark[];
  source: "page" | "url" | "catalog" | "mixed" | "archive";
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
  const s = raw
    .trim()
    .replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s+/i, "")
    .replace(/(\d{1,2})(st|nd|rd|th)\b/i, "$1");
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
  const mdy = s.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdy) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mo = months[mdy[1].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return `${mdy[3]}-${mo}-${mdy[2].padStart(2, "0")}`;
  }
  const my = s.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i,
  );
  if (my) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const mo = months[my[1].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    return `${my[2]}-${mo}-01`;
  }
  if (/^\d{4}$/.test(s)) return `${s}-06-30`;
  return null;
}

/** Parse a pasted REA Property history block into sale/list prints. */
export function parseHistoryText(raw: string): Mark[] {
  const text = raw.replace(/\u00a0/g, " ");
  const marks: Mark[] = [];
  const sold =
    /Sold(?:\s+for)?\s*(\$[\d,.]+(?:\s*[mk])?|\d[\d,]{4,})\s*(?:on\s+)?(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{4})?/gi;
  let m: RegExpExecArray | null;
  while ((m = sold.exec(text))) {
    const price = money(m[1]);
    const date = m[2] ? isoDate(m[2]) : null;
    if (price && date) {
      marks.push({
        date,
        low: price,
        mid: price,
        high: price,
        method: "sale",
        note: `REA property history sold ${m[1]}.`,
      });
    }
  }
  const listed =
    /(?:Listed|Advertised|For sale)[^\n$]{0,40}(\$[\d,.]+(?:\s*[mk])?(?:\s*[–—-]\s*\$[\d,.]+(?:\s*[mk])?)?)\s*(?:in\s+|on\s+)?(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})?/gi;
  while ((m = listed.exec(text))) {
    const range = m[1].split(/[–—-]/).map((p) => money(p.trim())).filter((n): n is number => n != null);
    const date = m[2] ? isoDate(m[2]) : null;
    if (range.length && date) {
      const low = Math.min(...range);
      const high = Math.max(...range);
      marks.push({
        date,
        low,
        mid: Math.round((low + high) / 2),
        high,
        method: "list-mid",
        note: `REA advertised ${m[1]}.`,
      });
    }
  }
  const uniq = new Map<string, Mark>();
  for (const mk of marks) uniq.set(`${mk.date}-${mk.mid}-${mk.method}`, mk);
  return [...uniq.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function streetNumber(address: string): string {
  const m = address.trim().match(/^(\d+[A-Za-z]?(?:\/\d+)?)/);
  return m?.[1] ?? "";
}

/** True when `text` cites this house number, not 16/76 when we want 6. */
export function mentionsStreetNumber(text: string, address: string): boolean {
  const num = streetNumber(address);
  if (!num) return true;
  const body = num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("/", "[\\/\\-]");
  return new RegExp(`(^|[^\\d])${body}(?!\\d)`, "i").test(text);
}

function mentionsTitle(text: string, address: string): boolean {
  if (!mentionsStreetNumber(text, address)) return false;
  const street = address
    .replace(/^\d+[A-Za-z]?(?:\/\d+)?\s+/, "")
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (street && street.length > 2) return text.toLowerCase().includes(street);
  return true;
}

/** Pull dated sold prints out of search snippets or agency sold pages. */
export function extractSalesFromText(raw: string, address: string): Mark[] {
  const text = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  const marks: Mark[] = [];
  const push = (price: number | null, dateRaw: string | null, note: string) => {
    const date = dateRaw ? isoDate(dateRaw) : null;
    if (!price || !date) return;
    marks.push({
      date,
      low: price,
      mid: price,
      high: price,
      method: "sale",
      note,
    });
  };
  const patterns: { re: RegExp; price: number; date: number; note: string }[] = [
    {
      re: /sold(?:\s+for)?\s*[:\s]*A?\$?\s*([\d,.]+(?:\s*[mk])?)\s+(?:on\s+|in\s+)?(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}|[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})/gi,
      price: 1,
      date: 2,
      note: "sold print from the listing record",
    },
    {
      re: /sold on\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\s+for\s+(\$[\d,.]+(?:\s*[mk])?)/gi,
      price: 2,
      date: 1,
      note: "sold print from the listing record",
    },
    {
      re: /sold in\s+(\d{4})\s+for\s+(\$[\d,.]+(?:\s*[mk])?)/gi,
      price: 2,
      date: 1,
      note: "sold print from the listing record",
    },
    {
      re: /(?:originally\s+)?purchased for\s+(\$[\d,.]+(?:\s*[mk])?)\s+in\s+([A-Za-z]{3,9}\s+\d{4}|\d{4})/gi,
      price: 1,
      date: 2,
      note: "prior sale from the listing record",
    },
  ];
  for (const p of patterns) {
    let m: RegExpExecArray | null;
    const re = new RegExp(p.re.source, p.re.flags);
    while ((m = re.exec(text))) {
      const from = text.lastIndexOf(".", m.index);
      const to = text.indexOf(".", m.index + m[0].length);
      const sentence = text.slice(from + 1, to === -1 ? undefined : to);
      if (!mentionsTitle(sentence, address) && !mentionsTitle(m[0] + " " + sentence.slice(0, 80), address)) {
        continue;
      }
      push(money(m[p.price]), m[p.date], p.note);
    }
  }
  const uniq = new Map<string, Mark>();
  for (const mk of marks) uniq.set(`${mk.date}-${mk.mid}`, mk);
  return collapseSales([...uniq.values()]);
}

function collapseSales(marks: Mark[]): Mark[] {
  const sales = marks
    .filter((m) => m.method === "sale")
    .sort((a, b) => a.date.localeCompare(b.date));
  const rest = marks.filter((m) => m.method !== "sale");
  const out: Mark[] = [];
  for (const m of sales) {
    const prev = out.at(-1);
    if (
      prev &&
      Math.abs(Date.parse(m.date) - Date.parse(prev.date)) < 70 * 86400000 &&
      Math.abs(m.mid - prev.mid) / Math.max(prev.mid, 1) < 0.1
    ) {
      const mDay = m.date.slice(8);
      const pDay = prev.date.slice(8);
      const vague = (d: string) => d === "01" || d === "30";
      const coarse = (n: number) => n % 100_000 === 0;
      const mid = coarse(m.mid) && !coarse(prev.mid) ? prev.mid : !coarse(m.mid) ? m.mid : prev.mid;
      const date = vague(mDay) && !vague(pDay) ? prev.date : !vague(mDay) ? m.date : prev.date;
      out[out.length - 1] = { ...m, date, mid, low: mid, high: mid };
      continue;
    }
    out.push(m);
  }
  return [...out, ...rest].sort((a, b) => a.date.localeCompare(b.date));
}

function decodeHref(raw: string): string | null {
  try {
    const u = raw.includes("uddg=")
      ? decodeURIComponent(raw.split("uddg=")[1].split("&")[0])
      : raw;
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function followable(url: string): boolean {
  const h = url.toLowerCase();
  if (h.includes("realestate.com.au")) return false;
  if (h.includes("duckduckgo.") || h.includes("brave.com") || h.includes("bing.com")) return false;
  if (h.includes("facebook.") || h.includes("wikipedia.") || h.includes("google.")) return false;
  return (
    h.includes("sold") ||
    h.includes("property") ||
    h.includes("real-estate") ||
    h.includes("homes/") ||
    h.includes("barryplant") ||
    h.includes("raywhite") ||
    h.includes("ljhooker") ||
    h.includes("harcourts") ||
    h.includes("jelliscraig") ||
    h.includes("soho") ||
    h.includes("homely") ||
    h.includes("allhomes")
  );
}

async function fetchSearch(url: string): Promise<string | null> {
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
    if (text.length < 800) return null;
    if (/confirm this search was made by a human|Select all squares containing a duck|KPSDK|Just a moment/i.test(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

async function searchWebSales(parsed: Partial<ListingLookup>): Promise<Mark[]> {
  const address = parsed.address?.trim();
  const suburb = parsed.suburb?.trim();
  const postcode = parsed.postcode?.trim() ?? "";
  if (!address || !suburb) return [];
  const q = `"${address}" ${suburb} ${postcode} sold`.trim();
  const searches = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    `https://search.brave.com/search?q=${encodeURIComponent(q)}`,
  ];
  const marks: Mark[] = [];
  const links: string[] = [];
  for (const u of searches) {
    const html = await fetchSearch(u);
    if (!html) continue;
    marks.push(...extractSalesFromText(html.replace(/<[^>]+>/g, " "), address));
    for (const href of html.matchAll(/href="([^"]+)"/g)) {
      const abs = decodeHref(href[1].replace(/&/g, "&"));
      if (abs && followable(abs) && !links.includes(abs)) links.push(abs);
    }
    if (marks.length) break;
  }
  for (const link of links.slice(0, 3)) {
    const html = await fetchSearch(link);
    if (!html) continue;
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
    marks.push(...extractSalesFromText(text, address));
  }
  const uniq = new Map<string, Mark>();
  for (const mk of marks) uniq.set(`${mk.date}-${mk.mid}`, mk);
  return [...uniq.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fillAddress(
  parsed: Partial<ListingLookup>,
  url: string,
): Promise<Partial<ListingLookup>> {
  if (parsed.address) return parsed;
  const queries = [url].filter(Boolean);
  for (const q of queries) {
    const html = await fetchSearch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
    );
    if (!html) continue;
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const m = text.match(
      /(\d+[A-Za-z]?(?:\/\d+)?\s+[A-Za-z][A-Za-z'’\-]+(?:\s+[A-Za-z][A-Za-z'’\-]+){0,5})\s*,\s*([A-Za-z][A-Za-z\s'-]{2,40}?)\s*,\s*(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})/i,
    );
    if (m) {
      return {
        ...parsed,
        address: titleCase(m[1].replace(/\s+/g, " ").trim()),
        suburb: titleCase(m[2].replace(/\s+/g, " ").trim()) || parsed.suburb,
        postcode: m[4],
        state: m[3].toUpperCase(),
      };
    }
  }
  return parsed;
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
        `^/(?:sold/)?property-([a-z-]+)-(${STATES})-([a-z0-9+-]+)-(\\d+)$`,
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
        state: listing[2].toUpperCase(),
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
        state: profile[3].toUpperCase(),
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
        state: m[2].toUpperCase(),
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

function streetKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\b(street|st|road|rd|avenue|ave|drive|dr|court|ct|place|pl)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOldListingsCard(html: string, address: string): Mark[] {
  const cards = html.split(/<div class="property /i).slice(1);
  const want = streetKey(address);
  const marks: Mark[] = [];
  for (const card of cards) {
    const text = card
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const head = text.slice(0, 80);
    if (want && !streetKey(head).includes(want) && !streetKey(text.slice(0, 120)).includes(want.split(" ")[0] ?? "")) {
      continue;
    }
    if (want) {
      const num = want.split(" ")[0] ?? "";
      if (num && !mentionsStreetNumber(head, address) && !mentionsStreetNumber(text.slice(0, 160), address)) {
        continue;
      }
    }
    const re =
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\s+(\$[\d,.]+(?:\s*[mk])?(?:\s*[–—-]\s*\$[\d,.]+(?:\s*[mk])?)?)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const date = isoDate(`${m[1]} ${m[2]}`);
      const parts = m[3]
        .split(/[–—-]/)
        .map((p) => money(p.trim()))
        .filter((n): n is number => n != null);
      if (!date || !parts.length) continue;
      const low = Math.min(...parts);
      const high = Math.max(...parts);
      marks.push({
        date,
        low,
        mid: Math.round((low + high) / 2),
        high,
        method: "list-mid",
        note: `Advertised ${m[3]} (${m[1]} ${m[2]}) — archive of listing sites, not the settled sale.`,
      });
    }
  }
  const uniq = new Map<string, Mark>();
  for (const mk of marks) uniq.set(`${mk.date}-${mk.mid}`, mk);
  return [...uniq.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchOldListings(parsed: Partial<ListingLookup>): Promise<Mark[]> {
  const suburb = parsed.suburb?.trim();
  const postcode = parsed.postcode?.trim();
  const address = parsed.address?.trim();
  const state = (parsed.state || "VIC").toUpperCase();
  if (!suburb || !postcode || !address) return [];
  const suburbSlug = suburb.replace(/\s+/g, "+");
  const streetSlug = address.replace(/\//g, "-").replace(/\s+/g, "+");
  const first = streetSlug.split("+").slice(0, 2).join("+");
  const urls = [
    `https://www.oldlistings.com.au/real-estate/${state}/${suburbSlug}/${postcode}/buy/1/${streetSlug}`,
    `https://www.oldlistings.com.au/real-estate/${state}/${suburbSlug}/${postcode}/buy/1/${first}`,
  ];
  for (const u of urls) {
    const html = await fetchPage(u);
    if (!html) continue;
    const marks = parseOldListingsCard(html, address);
    if (marks.length) return marks;
  }
  return [];
}

function mergeMarks(...lists: Mark[][]): Mark[] {
  const uniq = new Map<string, Mark>();
  for (const list of lists) {
    for (const mk of list) {
      const key = `${mk.date}-${mk.method}`;
      const prev = uniq.get(key);
      if (!prev || (mk.method === "sale" && prev.method !== "sale")) uniq.set(key, mk);
    }
  }
  return [...uniq.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function merge(
  url: string,
  parsed: Partial<ListingLookup> | null,
  catalog: ListingLookup | null,
  page: Partial<ListingLookup> | null,
  archive: Mark[],
  pasted: Mark[],
): ListingLookup | null {
  const address = (parsed?.address || catalog?.address || page?.address || "").trim();
  const suburb = (parsed?.suburb || catalog?.suburb || "").trim();
  const postcode = (parsed?.postcode || catalog?.postcode || "").trim();
  const type = parsed?.type && parsed.type !== "unknown" ? parsed.type : catalog?.type || parsed?.type || "unknown";
  const salesFirst = mergeMarks(
    pasted,
    page?.marks ?? [],
    catalog?.marks ?? [],
    archive,
  );
  if (!address && !suburb && !catalog) return null;
  const sales = salesFirst.filter((m) => m.method === "sale").length;
  const lists = salesFirst.filter((m) => m.method === "list-mid").length;
  const source: ListingLookup["source"] = pasted.length
    ? "page"
    : page?.marks?.length
      ? "page"
      : catalog
        ? "catalog"
        : archive.length
          ? "archive"
          : "url";
  return {
    url: catalog?.url || url,
    address: address || [parsed?.address, suburb].filter(Boolean).join(", "),
    suburb,
    postcode,
    state: parsed?.state || catalog?.state,
    type,
    marks: salesFirst,
    source,
    note: sales
      ? `${sales} sold print(s) taken from the listing record.`
      : lists
        ? `${lists} advertised print(s). Paste the REA Property history block if you have official solds.`
        : "Address from the URL. Paste the REA Property history (Sold $…) if solds did not load.",
  };
}

export async function lookupListing(
  rawUrl: string,
  historyText = "",
): Promise<ListingLookup | null> {
  const url = rawUrl.trim();
  if (!url && !historyText.trim()) return null;
  let parsed = url ? parseListingUrl(url) : null;
  if (parsed && !parsed.address && url) parsed = await fillAddress(parsed, url);
  const catalog = url ? fromCatalog(url) : null;
  const html = url ? await fetchPage(url) : null;
  const page = html ? parseHtml(html) : null;
  const pasted = parseHistoryText(historyText);
  const knownSales =
    pasted.filter((m) => m.method === "sale").length +
    (page?.marks ?? []).filter((m) => m.method === "sale").length +
    (catalog?.marks ?? []).filter((m) => m.method === "sale").length;
  const web = parsed && knownSales < 2 ? await searchWebSales(parsed) : [];
  const archive = parsed && knownSales + web.filter((m) => m.method === "sale").length < 2
    ? await fetchOldListings(parsed)
    : [];
  return merge(url, parsed, catalog, page, mergeMarks(web, archive), pasted);
}

