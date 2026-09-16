import { create } from "zustand";
import { slug } from "@/lib/utils";
import { SEED, STORE_KEY } from "./seed";
import type {
  Mark,
  MarkMethod,
  Property,
  PropertyStatus,
  PropertyType,
  ReaState,
} from "./types";

type Actions = {
  hydrated: boolean;
  hydrate: () => void;
  persist: () => void;
  addProperty: (input: {
    address: string;
    suburb: string;
    postcode: string;
    type: PropertyType;
    status: PropertyStatus;
    url: string;
  }) => void;
  removeProperty: (id: string) => void;
  flipStatus: (id: string) => void;
  logMark: (id: string, mark: Mark) => void;
  removeMark: (id: string, date: string, mid: number) => void;
  importState: (data: ReaState) => void;
  exportState: () => ReaState;
};

function write(state: ReaState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

export const useReaStore = create<ReaState & Actions>((set, get) => ({
  ...SEED,
  hydrated: false,
  hydrate: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as ReaState;
        if (Array.isArray(data.properties)) {
          set({
            version: data.version ?? 1,
            updated: data.updated ?? SEED.updated,
            properties: data.properties,
            hydrated: true,
          });
          return;
        }
      }
    } catch {
      /* keep seed */
    }
    set({ hydrated: true });
  },
  persist: () => {
    const { version, updated, properties } = get();
    write({ version, updated, properties });
  },
  addProperty: (input) => {
    const id = `${slug(`${input.address} ${input.suburb}`)}-${Date.now().toString().slice(-4)}`;
    const next: Property = {
      id,
      address: input.address.trim(),
      suburb: input.suburb.trim(),
      postcode: input.postcode.trim(),
      type: input.type,
      status: input.status,
      url: input.url.trim(),
      notes: "",
      marks: [],
    };
    set((s) => ({
      properties: [...s.properties, next],
      updated: new Date().toISOString().slice(0, 10),
    }));
    get().persist();
  },
  removeProperty: (id) => {
    set((s) => ({
      properties: s.properties.filter((p) => p.id !== id),
      updated: new Date().toISOString().slice(0, 10),
    }));
    get().persist();
  },
  flipStatus: (id) => {
    set((s) => ({
      properties: s.properties.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "owned" ? "watch" : "owned" }
          : p,
      ),
      updated: new Date().toISOString().slice(0, 10),
    }));
    get().persist();
  },
  logMark: (id, mark) => {
    set((s) => ({
      properties: s.properties.map((p) => {
        if (p.id !== id) return p;
        const marks = p.marks.filter((m) => m.date !== mark.date);
        marks.push(mark);
        marks.sort((a, b) => a.date.localeCompare(b.date));
        return { ...p, marks };
      }),
      updated: new Date().toISOString().slice(0, 10),
    }));
    get().persist();
  },
  removeMark: (id, date, mid) => {
    set((s) => ({
      properties: s.properties.map((p) =>
        p.id === id
          ? {
              ...p,
              marks: p.marks.filter((m) => !(m.date === date && m.mid === mid)),
            }
          : p,
      ),
      updated: new Date().toISOString().slice(0, 10),
    }));
    get().persist();
  },
  importState: (data) => {
    if (!Array.isArray(data.properties)) return;
    set({
      version: data.version ?? 1,
      updated: data.updated ?? new Date().toISOString().slice(0, 10),
      properties: data.properties,
    });
    get().persist();
  },
  exportState: () => {
    const { version, updated, properties } = get();
    return { version, updated, properties };
  },
}));

export function latestMark(p: Property): Mark | null {
  if (!p.marks.length) return null;
  return [...p.marks].sort((a, b) => a.date.localeCompare(b.date)).at(-1) ?? null;
}

export function sleeveSum(
  properties: Property[],
  status: PropertyStatus,
): number {
  let sum = 0;
  for (const p of properties) {
    if (p.status !== status) continue;
    const m = latestMark(p);
    if (m) sum += m.mid;
  }
  return sum;
}

export function lastSnapshotDate(properties: Property[]): string | null {
  let last = "";
  for (const p of properties) {
    for (const m of p.marks) if (m.date > last) last = m.date;
  }
  return last || null;
}

export const MARK_METHODS: MarkMethod[] = [
  "sale",
  "list-mid",
  "estimate",
  "manual",
  "suburb-proxy",
];

export const PROPERTY_TYPES: PropertyType[] = [
  "house",
  "unit",
  "townhouse",
  "dual occupancy",
  "unknown",
];
