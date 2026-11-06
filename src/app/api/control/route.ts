import { NextResponse } from "next/server";
import { z } from "zod";
import { callHomeAssistantService, getHomeAssistantSnapshot } from "@/lib/home-assistant";

const controlSchema = z.discriminatedUnion("action", [
  z.object({
    entityId: z.string().regex(/^(light|switch)\.[a-z0-9_]+$/),
    action: z.literal("toggle"),
  }),
  z.object({
    entityId: z.string().regex(/^light\.[a-z0-9_]+$/),
    action: z.literal("brightness"),
    value: z.number().int().min(1).max(255),
  }),
  z.object({
    entityId: z.string().regex(/^climate\.[a-z0-9_]+$/),
    action: z.literal("temperature"),
    value: z.number().finite(),
  }),
  z.object({
    entityId: z.string().regex(/^climate\.[a-z0-9_]+$/),
    action: z.literal("hvac_mode"),
    value: z.string().min(1).max(32),
  }),
  z.object({
    entityId: z.string().regex(/^media_player\.[a-z0-9_]+$/),
    action: z.literal("play_pause"),
  }),
  z.object({
    entityId: z.string().regex(/^media_player\.[a-z0-9_]+$/),
    action: z.literal("volume"),
    value: z.number().min(0).max(1),
  }),
]);

export async function POST(request: Request) {
  let body: z.infer<typeof controlSchema>;
  try {
    body = controlSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Unsupported or invalid control request." }, { status: 400 });
  }

  try {
    const { entities } = await getHomeAssistantSnapshot();
    const entity = entities.find((item) => item.entityId === body.entityId);
    if (!entity) {
      return NextResponse.json(
        { error: "The selected Home Assistant entity is unavailable." },
        { status: 404 },
      );
    }

    const domain = entity.domain;
    let service = "";
    let serviceData: Record<string, string | number | boolean> = {};

    switch (body.action) {
      case "toggle":
        if (domain !== "light" && domain !== "switch") {
          return NextResponse.json({ error: "Toggle is not supported for this entity." }, { status: 400 });
        }
        service = entity.state === "on" ? "turn_off" : "turn_on";
        break;
      case "brightness":
        if (
          typeof entity.attributes.brightness !== "number" &&
          !(
            typeof entity.attributes.supported_features === "number" &&
            (entity.attributes.supported_features & 1) === 1
          )
        ) {
          return NextResponse.json(
            { error: "This light does not support brightness control." },
            { status: 400 },
          );
        }
        service = "turn_on";
        serviceData = { brightness: body.value };
        break;
      case "temperature": {
        const current = entity.attributes.current_temperature;
        const target = entity.attributes.temperature;
        const low = Number(entity.attributes.min_temp ?? 5);
        const high = Number(entity.attributes.max_temp ?? 35);
        if (body.value < low || body.value > high || !Number.isFinite(body.value)) {
          return NextResponse.json(
            { error: `Temperature must be between ${low} and ${high}.` },
            { status: 400 },
          );
        }
        if (typeof current !== "number" && typeof target !== "number") {
          return NextResponse.json({ error: "This climate entity does not expose a setpoint." }, { status: 400 });
        }
        service = "set_temperature";
        serviceData = { temperature: body.value };
        break;
      }
      case "hvac_mode": {
        const modes = entity.attributes.hvac_modes;
        if (!Array.isArray(modes) || !modes.includes(body.value)) {
          return NextResponse.json({ error: "That HVAC mode is not supported by this entity." }, { status: 400 });
        }
        service = "set_hvac_mode";
        serviceData = { hvac_mode: body.value };
        break;
      }
      case "play_pause":
        service = "media_play_pause";
        break;
      case "volume":
        service = "volume_set";
        serviceData = { volume_level: body.value };
        break;
    }

    await callHomeAssistantService(body.entityId, domain, service, serviceData);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Home Assistant could not complete that action." },
      { status: 502 },
    );
  }
}
