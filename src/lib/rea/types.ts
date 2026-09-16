export type PropertyStatus = "watch" | "owned";
export type PropertyType =
  | "house"
  | "unit"
  | "townhouse"
  | "dual occupancy"
  | "unknown";
export type MarkMethod =
  | "sale"
  | "list-mid"
  | "estimate"
  | "manual"
  | "suburb-proxy";

export type Mark = {
  date: string;
  low: number;
  mid: number;
  high: number;
  method: MarkMethod;
  note: string;
};

export type Property = {
  id: string;
  address: string;
  suburb: string;
  postcode: string;
  type: PropertyType;
  status: PropertyStatus;
  url: string;
  notes: string;
  marks: Mark[];
  /** When false the title stays on the watchlist but is off the line chart. */
  charted: boolean;
};

export type ReaState = {
  version: number;
  updated: string;
  properties: Property[];
};
