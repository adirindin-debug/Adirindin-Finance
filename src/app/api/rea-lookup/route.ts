import { NextResponse } from "next/server";
import { lookupListing } from "@/lib/rea/lookup";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string; history?: string };
    const url = String(body?.url ?? "").trim();
    const history = String(body?.history ?? "");
    if (!url && !history.trim()) return NextResponse.json(null);
    const data = await lookupListing(url, history);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
