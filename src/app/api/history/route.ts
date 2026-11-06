import { NextResponse } from "next/server";
import { z } from "zod";
import { getEntityHistory, getHomeAssistantSnapshot } from "@/lib/home-assistant";

const entityIdSchema = z.string().regex(/^sensor\.[a-z0-9_]+$/);

export async function GET(request: Request) {
  const entityId = new URL(request.url).searchParams.get("entity_id");
  const parsed = entityIdSchema.safeParse(entityId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid sensor to view its history." }, { status: 400 });
  }

  try {
    const snapshot = await getHomeAssistantSnapshot();
    if (!snapshot.entities.some((entity) => entity.entityId === parsed.data && entity.domain === "sensor")) {
      return NextResponse.json({ error: "The selected sensor is unavailable." }, { status: 404 });
    }
    const points = await getEntityHistory(parsed.data);
    return NextResponse.json(
      { entityId: parsed.data, points },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 240) : "Unknown Home Assistant error.";
    console.error("Could not retrieve Home Assistant sensor history", { entityId: parsed.data, error });
    return NextResponse.json(
      { error: `Could not load sensor history: ${detail}` },
      { status: 502 },
    );
  }
}
