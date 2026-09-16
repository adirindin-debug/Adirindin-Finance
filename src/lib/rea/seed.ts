import type { ReaState } from "./types";

export const STORE_KEY = "adirindin.rea.v3";

export const SEED: ReaState = {
  version: 3,
  updated: "2026-09-16",
  properties: [],
};

export const SERIES_COLORS = [
  "#4c9fff",
  "#3dcc9a",
  "#e8873a",
  "#ef6b6b",
  "#f7931a",
  "#3b82c4",
  "#9aa8b5",
  "#7dd3fc",
];

/** ABS 6432.0 latest print — used only as a first-line seed when no mid is typed. */
export const ABS_MEAN_SEED = { date: "2026-06-30", value: 1_100_400 } as const;
