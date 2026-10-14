import { permanentRedirect } from "next/navigation";

// Market cycles now live on the homepage strip.
export default function CyclesPage() {
  permanentRedirect("/#cycles");
}
