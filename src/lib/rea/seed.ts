import type { ReaState } from "./types";

export const STORE_KEY = "adirindin.rea.v2";

export const SEED: ReaState = {
  version: 2,
  updated: "2026-09-14",
  properties: [
    {
      id: "8-363-high-st-tl",
      address: "8/363 High Street",
      suburb: "Templestowe Lower",
      postcode: "3107",
      type: "unit",
      status: "watch",
      url: "https://www.realestate.com.au/property/unit-8-363-high-st-templestowe-lower-vic-3107/",
      notes:
        "2 bed / 2 bath / 2 car unit. REA has no disclosed sale history. Estimate is the public range midpoint (mid locked behind sign-in).",
      marks: [
        {
          date: "2026-08-31",
          low: 800_000,
          mid: 865_000,
          high: 930_000,
          method: "estimate",
          note: "REA realEstimate 31 Aug 2026 range $800k–$930k. Mid locked; mid used is range midpoint. No sale print.",
        },
      ],
    },
    {
      id: "176-miller-st-preston",
      address: "176 Miller Street",
      suburb: "Preston",
      postcode: "3072",
      type: "dual occupancy",
      status: "watch",
      url: "https://www.realestate.com.au/property/176-miller-st-preston-vic-3072/",
      notes:
        "Sold prior to auction 2025. Two residences, one title in this log. 5/3/4, 483 m².",
      marks: [
        {
          date: "1999-07-19",
          low: 240_000,
          mid: 240_000,
          high: 240_000,
          method: "sale",
          note: "REA property history sold $240,000.",
        },
        {
          date: "2025-07-23",
          low: 1_450_000,
          mid: 1_450_000,
          high: 1_450_000,
          method: "sale",
          note: "Domain / Soho / REA sold $1,450,000. Barry Plant Reservoir.",
        },
        {
          date: "2026-08-31",
          low: 1_270_000,
          mid: 1_447_000,
          high: 1_630_000,
          method: "estimate",
          note: "REA realEstimate 31 Aug 2026 range $1.27–1.63m (mid locked). Mid is 2025 sale −0.2% as stated on the profile.",
        },
      ],
    },
    {
      id: "53-olympus-dr-tl",
      address: "53 Olympus Drive",
      suburb: "Templestowe Lower",
      postcode: "3107",
      type: "house",
      status: "watch",
      url: "https://www.realestate.com.au/property/53-olympus-dr-templestowe-lower-vic-3107/",
      notes:
        "REA now discloses the Dec 2024 sale. Allhomes still shows withheld. Nearby 12 Olympus sold 30 Nov 2025 $1,538,888 (comp, not this title).",
      marks: [
        {
          date: "1990-02-01",
          low: 175_000,
          mid: 175_000,
          high: 175_000,
          method: "sale",
          note: "REA property history sold $175,000.",
        },
        {
          date: "2006-06-06",
          low: 430_500,
          mid: 430_500,
          high: 430_500,
          method: "sale",
          note: "REA property history sold $430,500.",
        },
        {
          date: "2024-12-01",
          low: 1_280_000,
          mid: 1_340_000,
          high: 1_400_000,
          method: "list-mid",
          note: "oldlistings advertised range Dec 2024 $1.28m–$1.40m.",
        },
        {
          date: "2024-12-21",
          low: 1_475_000,
          mid: 1_475_000,
          high: 1_475_000,
          method: "sale",
          note: "REA sold $1,475,000, Barry Plant Doncaster East. Above the advertised range.",
        },
        {
          date: "2026-08-31",
          low: 1_230_000,
          mid: 1_381_000,
          high: 1_530_000,
          method: "estimate",
          note: "REA realEstimate 31 Aug 2026 range $1.23–1.53m (mid locked). Mid is 2024 sale −6.4% as stated on the profile.",
        },
      ],
    },
    {
      id: "2-uplands-rd-cp",
      address: "2 Uplands Road",
      suburb: "Chirnside Park",
      postcode: "3116",
      type: "house",
      status: "watch",
      url: "https://www.realestate.com.au/property/2-uplands-rd-chirnside-park-vic-3116/",
      notes:
        "REA land 86,210 m². No disclosed sale history. AVM band is very wide (rural/acreage). Mid is range midpoint, not a valuation.",
      marks: [
        {
          date: "2026-08-31",
          low: 1_470_000,
          mid: 1_990_000,
          high: 2_510_000,
          method: "estimate",
          note: "REA realEstimate 31 Aug 2026 range $1.47–2.51m (mid locked). Wide acreage band. Mid is range midpoint.",
        },
      ],
    },
    {
      id: "6-millicent-ave-bulleen",
      address: "6 Millicent Avenue",
      suburb: "Bulleen",
      postcode: "3105",
      type: "house",
      status: "watch",
      url: "https://www.realestate.com.au/property/6-millicent-ave-bulleen-vic-3105/",
      notes:
        "3/1/1 house on 286 m². Street comps exist (1 Millicent sold Aug 2026 $1,125,000) — that is not this title.",
      marks: [
        {
          date: "2006-08-05",
          low: 310_000,
          mid: 310_000,
          high: 310_000,
          method: "sale",
          note: "REA property history sold $310,000.",
        },
        {
          date: "2026-08-31",
          low: 820_000,
          mid: 930_000,
          high: 1_040_000,
          method: "estimate",
          note: "REA realEstimate 31 Aug 2026 range $0.82–1.04m (mid locked). Mid is range midpoint; profile also states +200.4% since 2006 sale.",
        },
      ],
    },
  ],
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
