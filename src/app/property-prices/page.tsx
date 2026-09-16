import type { Metadata } from "next";
import { PropertyPricesDesk } from "@/components/property-prices/Desk";

export const metadata: Metadata = {
  title: "Property prices",
  description:
    "Dated public marks and suburb-indexed paths for titles on the watchlist. Educational only; not a valuation or personal financial advice.",
};

export default function PropertyPricesPage() {
  return <PropertyPricesDesk />;
}
