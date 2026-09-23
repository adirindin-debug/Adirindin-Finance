import type { Metadata } from "next";
import { PropertyPricesDesk } from "@/components/property-prices/Desk";

export const metadata: Metadata = {
  title: "Property prices",
  description:
    "Australian property pricing estimates only. Educational purposes — estimates based on averages, not exact valuations. Not for investment or market timing. Not personal financial advice.",
};

export default function PropertyPricesPage() {
  return <PropertyPricesDesk />;
}
