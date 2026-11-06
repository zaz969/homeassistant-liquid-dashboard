import { parseDocument } from "yaml";
import type { DashboardWidget } from "@/lib/dashboard";

const entityIdPattern = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const entityKeys = new Set(["entity", "entity_id"]);
const supportedWidgetTypes: Record<string, DashboardWidget["type"]> = {
  light: "light",
  switch: "switch",
  sensor: "sensor",
  climate: "climate",
  media_player: "media_player",
  weather: "weather",
  calendar: "calendar",
  script: "script",
};

export function extractDashboardEntityIds(yaml: string): string[] {
  if (!yaml.trim()) {
    throw new Error("Paste dashboard YAML before analyzing it.");
  }
  if (yaml.length > 500_000) {
    throw new Error("Dashboard YAML is too large to import (maximum 500 KB).");
  }

  const document = parseDocument(yaml, { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new Error(`Could not parse dashboard YAML: ${document.errors[0].message}`);
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 100 });
  } catch (error) {
    throw new Error(
      `Could not read dashboard YAML: ${error instanceof Error ? error.message : "invalid YAML data."}`,
    );
  }

  const entityIds = new Set<string>();
  const collectIds = (node: unknown) => {
    if (typeof node === "string" && entityIdPattern.test(node)) {
      entityIds.add(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(collectIds);
      return;
    }
    if (node && typeof node === "object") {
      Object.values(node).forEach(collectIds);
    }
  };
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
    } else if (node && typeof node === "object") {
      Object.entries(node).forEach(([key, child]) => {
        if (entityKeys.has(key.toLowerCase()) || key.toLowerCase() === "entities") collectIds(child);
        else visit(child);
      });
    }
  };
  visit(value);
  return [...entityIds];
}

export function widgetTypeForImportedEntity(entityId: string): DashboardWidget["type"] | null {
  const [domain] = entityId.split(".");
  return supportedWidgetTypes[domain] ?? null;
}
