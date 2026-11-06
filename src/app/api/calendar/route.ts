import { NextResponse } from "next/server";
import { z } from "zod";
import { getCalendarEvents, getHomeAssistantSnapshot } from "@/lib/home-assistant";

const entityIdSchema = z.string().regex(/^calendar\.[a-z0-9_]+$/);

export async function GET(request: Request) {
  const entityId = new URL(request.url).searchParams.get("entity_id");
  const parsed = entityIdSchema.safeParse(entityId);
  if (!parsed.success) {
    return NextResponse.json({ error: "Select a valid calendar entity." }, { status: 400 });
  }

  const snapshot = await getHomeAssistantSnapshot();
  if (!snapshot.entities.some((entity) => entity.entityId === parsed.data && entity.domain === "calendar")) {
    return NextResponse.json({ error: "The selected calendar is unavailable." }, { status: 404 });
  }

  try {
    const events = await getCalendarEvents(parsed.data);
    return NextResponse.json(
      { entityId: parsed.data, events },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Home Assistant could not load calendar events. Check that the calendar supports get_events." },
      { status: 502 },
    );
  }
}
