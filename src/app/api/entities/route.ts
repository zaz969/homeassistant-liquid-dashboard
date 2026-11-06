import { NextResponse } from "next/server";
import { getHomeAssistantSnapshot } from "@/lib/home-assistant";

export async function GET() {
  const snapshot = await getHomeAssistantSnapshot();
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}
