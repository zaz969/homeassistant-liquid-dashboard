import {
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  callService,
  createConnection,
  createLongLivedTokenAuth,
  getStates,
  subscribeEntities,
  type Connection,
  type HassEntities,
  type HassEntity,
} from "home-assistant-js-websocket";
import { z } from "zod";

export type HaConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
export type PublicEntity = {
  entityId: string;
  state: string;
  name: string;
  domain: string;
  attributes: Record<string, string | number | boolean | string[] | null>;
  lastUpdated: string;
};
export type HaSnapshot = {
  status: HaConnectionStatus;
  error: string | null;
  entities: PublicEntity[];
};

const supportedDomains = new Set([
  "light",
  "switch",
  "sensor",
  "climate",
  "media_player",
  "weather",
  "calendar",
]);
const publicAttributeNames = [
  "unit_of_measurement",
  "device_class",
  "brightness",
  "min_temp",
  "max_temp",
  "temperature",
  "current_temperature",
  "hvac_mode",
  "hvac_modes",
  "volume_level",
  "is_volume_muted",
  "media_title",
  "media_artist",
  "supported_features",
  "condition",
  "temperature_unit",
  "humidity",
  "pressure",
  "wind_speed",
  "wind_speed_unit",
  "wind_bearing",
  "visibility",
  "cloud_coverage",
  "uv_index",
  "precipitation",
  "apparent_temperature",
  "message",
  "start_time",
  "end_time",
  "location",
] as const;

let connectionPromise: Promise<Connection> | undefined;
let cachedEntities: HassEntities = {};
let connectionStatus: HaConnectionStatus = "connecting";
let connectionError: string | null = null;
const listeners = new Set<(snapshot: HaSnapshot) => void>();

function publicEntity(entity: HassEntity): PublicEntity | null {
  const [domain] = entity.entity_id.split(".");
  if (!supportedDomains.has(domain) || entity.attributes.hidden === true) return null;

  const attributes: PublicEntity["attributes"] = {};
  for (const key of publicAttributeNames) {
    const value = entity.attributes[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      (Array.isArray(value) && value.every((item) => typeof item === "string"))
    ) {
      attributes[key] = value as PublicEntity["attributes"][string];
    }
  }

  return {
    entityId: entity.entity_id,
    state: entity.state,
    name: String(entity.attributes.friendly_name ?? entity.entity_id),
    domain,
    attributes,
    lastUpdated: entity.last_updated,
  };
}

function snapshot(): HaSnapshot {
  return {
    status: connectionStatus,
    error: connectionError,
    entities: Object.values(cachedEntities)
      .map(publicEntity)
      .filter((entity): entity is PublicEntity => entity !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function publish() {
  const current = snapshot();
  for (const listener of listeners) listener(current);
}

function connectionErrorMessage(error: unknown) {
  if (error === ERR_INVALID_AUTH) {
    return "Home Assistant rejected the Supervisor token. Check that the app has Home Assistant API access.";
  }
  if (error === ERR_CANNOT_CONNECT) {
    return "The Supervisor could not connect to Home Assistant Core.";
  }
  if (error instanceof Error && error.message.includes("Supervisor")) {
    return error.message;
  }
  return "Unable to connect to Home Assistant through the Supervisor API.";
}

async function connect() {
  if (connectionPromise) return connectionPromise;

  connectionStatus = "connecting";
  connectionError = null;
  publish();

  connectionPromise = (async () => {
    const supervisorToken = process.env.SUPERVISOR_TOKEN;
    if (!supervisorToken) {
      throw new Error("This app must run under the Home Assistant Supervisor.");
    }

    const auth = createLongLivedTokenAuth(
      "http://supervisor/core",
      supervisorToken,
    );
    const connection = await createConnection({ auth, setupRetry: 1 });
    connection.addEventListener("ready", () => {
      connectionStatus = "connected";
      connectionError = null;
      publish();
    });
    connection.addEventListener("disconnected", () => {
      connectionStatus = "disconnected";
      publish();
    });
    connection.addEventListener("reconnect-error", () => {
      connectionStatus = "error";
      connectionError = "Home Assistant could not reconnect.";
      publish();
    });

    const states = await getStates(connection);
    cachedEntities = Object.fromEntries(states.map((entity) => [entity.entity_id, entity]));
    connectionStatus = "connected";
    connectionError = null;
    subscribeEntities(connection, (entities) => {
      cachedEntities = entities;
      if (connection.connected) connectionStatus = "connected";
      publish();
    });
    let healthCheckRunning = false;
    setInterval(() => {
      if (healthCheckRunning || !connection.connected) return;
      healthCheckRunning = true;
      let rejectPingTimeout: ((reason: Error) => void) | undefined;
      const pingTimeout = new Promise<never>((_, reject) => {
        rejectPingTimeout = reject;
      });
      const timeout = setTimeout(
        () => rejectPingTimeout?.(new Error("Home Assistant ping timed out.")),
        10_000,
      );
      void Promise.race([connection.ping(), pingTimeout])
        .catch(() => {
          if (!connection.connected) return;
          connectionStatus = "disconnected";
          connectionError = "Home Assistant stopped responding. Reconnecting.";
          publish();
          connection.reconnect(true);
        })
        .finally(() => {
          clearTimeout(timeout);
          healthCheckRunning = false;
        });
    }, 30_000);
    publish();
    return connection;
  })().catch((error: unknown) => {
    connectionPromise = undefined;
    connectionStatus = "error";
    connectionError = connectionErrorMessage(error);
    publish();
    throw error;
  });

  return connectionPromise;
}

export async function getHomeAssistantSnapshot() {
  try {
    await connect();
  } catch {
    return snapshot();
  }
  return snapshot();
}

export async function callHomeAssistantService(
  entityId: string,
  domain: string,
  service: string,
  serviceData: Record<string, string | number | boolean>,
) {
  const connection = await connect();
  const entity = cachedEntities[entityId];
  if (!entity || entity.entity_id.split(".")[0] !== domain) {
    throw new Error("The selected Home Assistant entity is not available.");
  }

  return callService(connection, domain, service, serviceData, { entity_id: entityId });
}

export type HistoryPoint = { state: number; time: string };
type HistoryRecord = {
  s?: string;
  state?: string;
  lc?: number;
  lu?: number;
  last_changed?: string;
  last_updated?: string;
};
type HistoryResponse = { states?: Record<string, HistoryRecord[]> };
export type CalendarEvent = {
  summary: string;
  start: string;
  end: string;
  location: string;
};

const calendarResponseSchema = z.record(
  z.string(),
  z.object({
    events: z.array(z.object({
      summary: z.string().default("Calendar event"),
      start: z.union([z.string(), z.object({ dateTime: z.string().optional(), date: z.string().optional() })]),
      end: z.union([z.string(), z.object({ dateTime: z.string().optional(), date: z.string().optional() })]),
      location: z.string().optional().default(""),
    })),
  }),
);

function calendarDate(value: string | { dateTime?: string; date?: string }) {
  return typeof value === "string" ? value : value.dateTime ?? value.date ?? "";
}

export function normalizeEntityHistory(value: unknown, entityId: string): HistoryPoint[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Home Assistant returned an invalid history response.");
  }
  const states = (value as HistoryResponse).states;
  const records = states?.[entityId] ?? [];
  if (!Array.isArray(records)) {
    throw new Error("Home Assistant returned an invalid history response.");
  }
  return records
    .map((record) => {
      const state = Number(record.s ?? record.state);
      const timestamp = record.lc ?? record.lu ?? record.last_changed ?? record.last_updated;
      const time = typeof timestamp === "number" && Number.isFinite(timestamp)
        ? new Date(timestamp * 1000).toISOString()
        : typeof timestamp === "string" && !Number.isNaN(Date.parse(timestamp))
          ? new Date(timestamp).toISOString()
          : "";
      return { state, time };
    })
    .filter((point) => Number.isFinite(point.state) && point.time !== "")
    .slice(-240);
}

export async function getCalendarEvents(entityId: string): Promise<CalendarEvent[]> {
  if (!/^calendar\.[a-z0-9_]+$/.test(entityId)) {
    throw new Error("Events are only available for calendar entities.");
  }
  const connection = await connect();
  const now = new Date();
  const response = await callService(
    connection,
    "calendar",
    "get_events",
    {
      start_date_time: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      end_date_time: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    { entity_id: entityId },
    true,
  );
  const parsed = calendarResponseSchema.parse(response);
  return (parsed[entityId]?.events ?? [])
    .map((event) => ({
      summary: event.summary,
      start: calendarDate(event.start),
      end: calendarDate(event.end),
      location: event.location,
    }))
    .filter((event) => event.start !== "")
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

export async function getEntityHistory(entityId: string): Promise<HistoryPoint[]> {
  if (!/^sensor\.[a-z0-9_]+$/.test(entityId)) {
    throw new Error("History is only available for sensor entities.");
  }
  const connection = await connect();
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const history = await new Promise<HistoryResponse>((resolve, reject) => {
    let settled = false;
    let unsubscribed = false;
    let unsubscribe: (() => Promise<void>) | undefined;
    const cleanup = () => {
      if (unsubscribe && !unsubscribed) {
        unsubscribed = true;
        void unsubscribe().catch((error: unknown) => {
          console.error("Could not unsubscribe from Home Assistant history", error);
        });
      }
    };
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Home Assistant history request timed out."));
    }, 15_000);
    const settle = () => {
      if (settled) return false;
      settled = true;
      clearTimeout(timeout);
      cleanup();
      return true;
    };
    const finish = (response: HistoryResponse) => {
      if (settle()) resolve(response);
    };
    const fail = (error: Error) => {
      if (settle()) reject(error);
    };
    void connection.subscribeMessage<HistoryResponse>(
      finish,
      {
        type: "history/history_during_period",
        start_time: startTime,
        entity_ids: [entityId],
        minimal_response: true,
        no_attributes: true,
      },
      { resubscribe: false },
    ).then((stop) => {
      unsubscribe = stop;
      if (settled) cleanup();
    }, (error: unknown) => {
      fail(error instanceof Error ? error : new Error("Home Assistant history request failed."));
    });
  });
  return normalizeEntityHistory(history, entityId);
}

export function subscribeToHomeAssistant(listener: (snapshot: HaSnapshot) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
