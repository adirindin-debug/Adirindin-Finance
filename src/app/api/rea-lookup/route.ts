import { NextResponse } from "next/server";
import { lookupListing } from "@/lib/rea/lookup";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    const url = String(body?.url ?? "").trim();
    if (!url) return NextResponse.json(null);
    const data = await lookupListing(url);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(null, { status: 200 });
  }
}
