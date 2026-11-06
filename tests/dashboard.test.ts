import assert from "node:assert/strict";
import { after, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLongLivedTokenAuth } from "home-assistant-js-websocket";
import { normalizeLayout } from "../src/lib/dashboard";
import { normalizeEntityHistory } from "../src/lib/home-assistant";
import { normalizeTheme } from "../src/lib/theme";
import { createWidgetId } from "../src/lib/widget-id";
import { normalizeIngressPath } from "../ingress-path.js";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "glass-dashboard-test-"));
let routeModules:
  | Promise<{
      dashboardRoute: typeof import("../src/app/api/dashboard/route");
      controlRoute: typeof import("../src/app/api/control/route");
      settingsRoute: typeof import("../src/app/api/settings/route");
      historyRoute: typeof import("../src/app/api/history/route");
      calendarRoute: typeof import("../src/app/api/calendar/route");
    }>
  | undefined;

function getRouteModules() {
  process.env.DATABASE_PATH = join(temporaryDirectory, "dashboard.sqlite");
  routeModules ??= Promise.all([
    import("../src/app/api/dashboard/route"),
    import("../src/app/api/control/route"),
    import("../src/app/api/settings/route"),
    import("../src/app/api/history/route"),
    import("../src/app/api/calendar/route"),
  ]).then(([dashboardRoute, controlRoute, settingsRoute, historyRoute, calendarRoute]) => ({
    dashboardRoute,
    controlRoute,
    settingsRoute,
    historyRoute,
    calendarRoute,
  }));
  return routeModules;
}

after(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("dashboard schema applies size defaults and rejects malformed entities", () => {
  const parsed = normalizeLayout({
    version: 1,
    widgets: [
      {
        id: "123e4567-e89b-42d3-a456-426614174000",
        type: "light",
        entityId: "light.living_room",
      },
    ],
  });

  assert.equal(parsed.widgets[0].width, 1);
  assert.equal(parsed.widgets[0].height, 1);
  assert.equal(
    normalizeLayout({
      version: 1,
      widgets: [
        {
          id: "123e4567-e89b-42d3-a456-426614174001",
          type: "sensor",
          entityId: "sensor.indoor_temperature",
          showChart: true,
        },
      ],
    }).widgets[0].showChart,
    true,
  );
  assert.throws(() =>
    normalizeLayout({
      version: 1,
      widgets: [
        {
          id: "123e4567-e89b-42d3-a456-426614174000",
          type: "light",
          entityId: "lock.front_door",
        },
      ],
    }),
  );
});

test("dashboard schema rejects duplicate widget IDs", () => {
  const widget = {
    id: "123e4567-e89b-42d3-a456-426614174000",
    type: "sensor",
    entityId: "sensor.indoor_temperature",
  };
  assert.throws(() => normalizeLayout({ version: 1, widgets: [widget, widget] }));
});

test("dashboard schema accepts new card types with compatible entities", () => {
  const widgets = [
    { id: "123e4567-e89b-42d3-a456-426614174001", type: "weather", entityId: "weather.home" },
    { id: "123e4567-e89b-42d3-a456-426614174002", type: "calendar", entityId: "calendar.family" },
    { id: "123e4567-e89b-42d3-a456-426614174003", type: "chart", entityId: "sensor.indoor_temperature" },
    { id: "123e4567-e89b-42d3-a456-426614174004", type: "clock", entityId: "clock.local" },
  ];
  assert.deepEqual(normalizeLayout({ version: 1, widgets }).widgets.map(({ type }) => type), [
    "weather",
    "calendar",
    "chart",
    "clock",
  ]);
  assert.throws(() =>
    normalizeLayout({
      version: 1,
      widgets: [{ ...widgets[2], entityId: "switch.fan" }],
    }),
  );
  assert.throws(() =>
    normalizeLayout({
      version: 1,
      widgets: [{ ...widgets[3], entityId: "sensor.indoor_temperature" }],
    }),
  );
});

test("widget IDs are valid UUIDs", () => {
  assert.match(createWidgetId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("Supervisor Core API URL maps to Home Assistant's proxied WebSocket endpoint", () => {
  const auth = createLongLivedTokenAuth("http://supervisor/core", "test-token");
  assert.equal(auth.wsUrl, "ws://supervisor/core/api/websocket");
});

test("Ingress request paths are normalized whether or not Supervisor strips the prefix", () => {
  const ingressPath = "/api/hassio_ingress/opaque-token/";
  assert.equal(
    normalizeIngressPath(
      "/api/hassio_ingress/opaque-token/_next/static/chunks/app.js?x=1",
      ingressPath,
    ),
    "/_next/static/chunks/app.js?x=1",
  );
  assert.equal(
    normalizeIngressPath("/_next/static/chunks/app.js", ingressPath),
    "/_next/static/chunks/app.js",
  );
  assert.equal(normalizeIngressPath("/api/dashboard", "/untrusted/path"), "/api/dashboard");
});

test("dashboard save is revisioned and detects concurrent writes", async () => {
  const { dashboardRoute } = await getRouteModules();
  const initial = await dashboardRoute.GET();
  assert.equal((await initial.json()).revision, 0);

  const body = {
    revision: 0,
    layout: {
      version: 1,
      widgets: [
        {
          id: "123e4567-e89b-42d3-a456-426614174000",
          type: "light",
          entityId: "light.living_room",
          width: 1,
          height: 1,
        },
      ],
    },
  };
  const saved = await dashboardRoute.PUT(
    new Request("http://dashboard.test/api/dashboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);

  const conflict = await dashboardRoute.PUT(
    new Request("http://dashboard.test/api/dashboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: 0, layout: { version: 1, widgets: [] } }),
    }),
  );
  assert.equal(conflict.status, 409);

  const invalid = await dashboardRoute.PUT(
    new Request("http://dashboard.test/api/dashboard", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: 1, layout: { version: 1, widgets: [{ type: "lock" }] } }),
    }),
  );
  assert.equal(invalid.status, 400);
});

test("theme settings validate colors and use revisioned persistence", async () => {
  const { settingsRoute } = await getRouteModules();
  const initial = await settingsRoute.GET();
  const initialData = await initial.json();
  assert.equal(initialData.revision, 0);
  assert.equal(initialData.theme.palette, "graphite");

  const theme = {
    version: 1,
    palette: "custom",
    wallpaper: "aurora",
    colors: {
      backgroundA: "#112233",
      backgroundB: "#445566",
      backgroundC: "#778899",
      accent: "#aabbcc",
    },
    animated: true,
    speed: "medium",
  };
  const saved = await settingsRoute.PUT(
    new Request("http://dashboard.test/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: 0, theme }),
    }),
  );
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  const reloaded = await settingsRoute.GET();
  assert.deepEqual((await reloaded.json()).theme, normalizeTheme(theme));

  assert.equal(
    normalizeTheme({
      version: theme.version,
      palette: "tahoe",
      colors: theme.colors,
      animated: theme.animated,
      speed: theme.speed,
    }).wallpaper,
    "drift",
  );
  assert.equal(normalizeTheme(theme).brandTitle, "At home");
  assert.equal(normalizeTheme(theme).topbarStyle, "glass");
  assert.equal(normalizeTheme(theme).fontScale, 1);
  assert.equal(normalizeTheme(theme).uiScale, 1);
  assert.equal(normalizeTheme(theme).glassTransparency, 90);
  assert.equal(normalizeTheme(theme).glassReflectivity, 72);
  assert.equal(
    normalizeTheme({ ...theme, glassTransparency: 100, glassReflectivity: 0 }).glassTransparency,
    100,
  );
  assert.equal(normalizeTheme({ ...theme, glassReflectivity: 0 }).glassReflectivity, 0);
  assert.equal(
    normalizeTheme({ ...theme, wallpaper: "graphite" }).wallpaper,
    "contours",
  );

  const conflict = await settingsRoute.PUT(
    new Request("http://dashboard.test/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision: 0, theme }),
    }),
  );
  assert.equal(conflict.status, 409);

  const invalid = await settingsRoute.PUT(
    new Request("http://dashboard.test/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        revision: 1,
        theme: { ...theme, colors: { ...theme.colors, backgroundA: "url(javascript:alert(1))" } },
      }),
    }),
  );
  assert.equal(invalid.status, 400);
});

test("Home Assistant history responses normalize compressed sensor states", () => {
  const points = normalizeEntityHistory(
    {
      states: {
        "sensor.indoor_temperature": [
          { s: "21.4", lc: 1_700_000_000 },
          { s: "unknown", lu: 1_700_000_060 },
          { state: "22.1", last_updated: "2023-11-14T22:14:20.000Z" },
        ],
      },
    },
    "sensor.indoor_temperature",
  );

  assert.deepEqual(points, [
    { state: 21.4, time: "2023-11-14T22:13:20.000Z" },
    { state: 22.1, time: "2023-11-14T22:14:20.000Z" },
  ]);
  assert.deepEqual(normalizeEntityHistory({ states: {} }, "sensor.indoor_temperature"), []);
});

test("control API rejects arbitrary entity domains and service names", async () => {
  const { controlRoute } = await getRouteModules();
  const response = await controlRoute.POST(
    new Request("http://dashboard.test/api/control", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entityId: "lock.front_door",
        action: "unlock",
        service: "unlock",
      }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Unsupported or invalid control request.",
  });
});

test("sensor history endpoint rejects invalid entity IDs", async () => {
  const { historyRoute } = await getRouteModules();
  const response = await historyRoute.GET(
    new Request("http://dashboard.test/api/history?entity_id=lock.front_door"),
  );
  assert.equal(response.status, 400);
});

test("calendar endpoint rejects non-calendar entity IDs", async () => {
  const { calendarRoute } = await getRouteModules();
  const response = await calendarRoute.GET(
    new Request("http://dashboard.test/api/calendar?entity_id=sensor.indoor_temperature"),
  );
  assert.equal(response.status, 400);
});
