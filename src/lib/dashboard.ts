import { z } from "zod";

const widgetTypeSchema = z.enum([
  "light",
  "switch",
  "sensor",
  "climate",
  "media_player",
  "weather",
  "calendar",
  "chart",
  "clock",
  "script",
]);

export const widgetSchema = z.object({
  id: z.string().uuid(),
  type: widgetTypeSchema,
  entityId: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/),
  title: z.string().trim().max(48).optional(),
  width: z.union([z.literal(1), z.literal(2)]).default(1),
  height: z.union([z.literal(1), z.literal(2)]).default(1),
  showChart: z.boolean().optional(),
}).superRefine((widget, context) => {
  const [domain] = widget.entityId.split(".");
  const requiredDomain = widget.type === "chart" ? "sensor" : widget.type;
  const validEntity =
    widget.type === "clock"
      ? widget.entityId === "clock.local"
      : domain === requiredDomain;
  if (!validEntity) {
    context.addIssue({
      code: "custom",
      message: "Widget entity does not match the selected card type.",
      path: ["entityId"],
    });
  }
});

export const dashboardSchema = z.object({
  version: z.literal(1),
  widgets: z.array(widgetSchema).max(40),
});

export type DashboardWidget = z.infer<typeof widgetSchema>;
export type DashboardLayout = z.infer<typeof dashboardSchema>;

export const emptyDashboard: DashboardLayout = {
  version: 1,
  widgets: [],
};

export function normalizeLayout(value: unknown): DashboardLayout {
  const parsed = dashboardSchema.parse(value);
  const ids = new Set<string>();

  for (const widget of parsed.widgets) {
    if (ids.has(widget.id)) {
      throw new Error("Dashboard widget IDs must be unique.");
    }
    ids.add(widget.id);
  }

  return parsed;
}

export const supportedWidgetTypes = widgetTypeSchema.options;
