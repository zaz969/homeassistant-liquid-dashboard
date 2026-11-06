# At Home — Glass Dashboard

## What it does

This app provides an editable, responsive dashboard for Home Assistant. Its
primary target is a portrait 9:16 tablet running a kiosk browser. Layout
changes and appearance settings are shared and saved in the add-on's persistent
data storage.

Dashboard cards, buttons, switches, sliders, inputs, selects, and status
badges use locally installed Crenspire Glass UI components from the
`@glass-ui` shadcn registry. The registry installs component source into this
project; these are not runtime `@glass-ui/*` npm packages. The installed
Crenspire Liquid Glass provider renders the wallpaper and glass surfaces with
WebGL, including movement-driven squash and stretch. Browsers without WebGL
and users preferring reduced transparency retain the CSS glass fallback.
Home Assistant-specific widget content is rendered inside Glass UI card
surfaces.

Available card types:

- Lights: on/off and brightness.
- Switches: on/off.
- Scripts: run an existing Home Assistant script.
- Sensors: state and unit, with an optional 24-hour chart.
- Climate: current/target temperature and supported HVAC modes.
- Media players: play/pause and volume.
- Weather: current conditions, temperature, humidity, and wind.
- Calendar: the next event from Home Assistant's `calendar.get_events` service.
- Charts: 24-hour numeric history for a sensor, rendered with Crenspire Glass UI charts (requires Home Assistant recorder history).
- Clock: local time and date; no entity required.

Charts use Home Assistant's history WebSocket API. Calendar cards require an
integration that supports `calendar.get_events`. Script buttons run only the
selected script entity; arbitrary service calls are not exposed. Camera
streams, locks, alarms, and covers are not included.

## Install as a local Home Assistant app/add-on

1. Copy this project directory into Home Assistant's local add-on directory as
   `/addons/glass_dashboard`. For example, use the Studio Code Server or Samba
   app to create that folder and copy the project files into it.
2. In Home Assistant, open **Settings → Apps** and refresh the local apps
   list. If the add-on does not appear, restart Home Assistant's Supervisor
   and refresh again.
3. Open **At Home — Glass Dashboard**, review its permissions, and install it.
4. Start the app and select **Open Web UI**. Optionally enable **Show in
   sidebar**.
5. To use it as a kiosk, open the app through the Home Assistant frontend on
   the tablet, then use the tablet's kiosk/full-screen mode. In portrait mode,
   the layout adapts to the available viewport.

The app requires `homeassistant_api: true` so it can read states and call the
limited services exposed by its widgets. The Supervisor-provided
`SUPERVISOR_TOKEN` is highly privileged. It remains in the server process, is
never sent to the browser or written to the dashboard database, and must not
be added to logs or source control. The app deliberately exposes no arbitrary
service-call interface.

Ingress handles Home Assistant login and does not require a separate dashboard
password. The app listens only on its internal add-on port, accepts requests
only from the Supervisor ingress proxy, and does not publish a host port.
Dashboard access is available to Home Assistant users who can open the app.
They can edit the shared layout and use the supported widget controls.

## Local development

Requires Node.js 22 or newer and npm.

```sh
npm ci
npm run dev
```

The local development UI loads, but entity access requires Supervisor's
`SUPERVISOR_TOKEN` and DNS/API proxy available inside a Home Assistant app.
Production startup uses `node server.js`, which accepts traffic only from
Home Assistant's ingress proxy address.

For an interactive, Home Assistant-independent showcase of the installed Glass
UI components, run the dev server and open
[`http://localhost:3000/component-lab`](http://localhost:3000/component-lab).
The route is available only in development; its switches, sliders, inputs, and
selects use local state and do not call or persist to Home Assistant. The
showcase includes selectable animated wallpaper styles, matching the dashboard
background renderer without saving settings. The canvas treatment is an
independent implementation inspired by the flowing wallpaper direction in
[Crenspire Glass UI](https://github.com/crenspire/glass-ui/blob/develop/lib/wallpapers/render.ts).

Useful checks:

```sh
npm run lint
npm run typecheck
npm run build
```

Sync project files to the configured Home Assistant add-on directory with:

```sh
npm run deploy
```

To explicitly request a content-based incremental deployment, use:

```sh
npm run deploy -- --changed-only
```

By default, this uses the network-mounted
`/run/user/1000/gvfs/smb-share:server=homeassistant.local,share=addons/glass_dashboard`
directory. Set `HA_ADDON_DIR` to use another existing directory, or pass
`-- --dry-run` to preview changes (these options can be combined). Rsync
compares file contents and skips unchanged files; this is also the normal
deployment behavior when `--changed-only` is omitted. The deploy command
excludes local build outputs, `node_modules`, environment files, and test
coverage. Normal deployment skips files with matching size and modification
time; `--changed-only` additionally compares file contents, so timestamp-only
changes are skipped and same-size edits are detected. Dependencies should not
be copied: the Docker build runs `npm ci` for the target Linux architecture,
including native modules such as `better-sqlite3`. Deployment does not delete
files from the destination. After syncing, rebuild or restart the add-on in
Home Assistant to apply the changes.

The container build uses a multi-stage Node.js image and supports the
`aarch64` and `amd64` architectures listed in `config.yaml`.

## Data, backup, and restore

The shared dashboard database is stored at `/data/dashboard.sqlite` on the
add-on's persistent data mount. Back up the add-on data before removing or
reinstalling the app, and before an upgrade that changes stored data.

To restore, stop the app, restore the database to the add-on's data directory,
then start it again. The database contains dashboard layout and entity IDs; it
also contains appearance settings. It does not contain Home Assistant
credentials or `SUPERVISOR_TOKEN`. Database migrations preserve existing
dashboard data when new settings are added.

## Appearance settings

Open the gear menu and choose **Theme** to select a generated background
palette or customize three background colors and an accent color. The
background updates as colors change; select **Save settings** to persist the
shared settings. Animated backgrounds can be disabled or set to slow, medium,
or fast. The wallpaper motion follows pointer movement, and the browser's
reduced-motion preference suppresses its animation.

Choose **Display** to set the top-bar style, change the title below “HOME
CONTROL,” or adjust text and overall UI scale. The settings are shared across
devices.

Choose **Glass** to tune widget transparency and the strength of the animated
edge reflections. Changes preview immediately and are saved with **Save
settings**.

Choose **Import** to paste a Lovelace dashboard YAML export, analyze it, and
select supported Home Assistant entities that do not already have widgets.
Unsupported domains and supported entities unavailable in Home Assistant are
skipped. Imports are saved to the shared dashboard immediately; enter Edit mode
to reorder the new cards. Dashboard imports are limited by the 40-widget
maximum.

In dashboard edit mode, drag a card by its grip to reorder it; neighboring
cards animate as it moves. Keyboard users can focus the grip and use the arrow
keys. A sensor card can switch between its reading and a history chart from its
edit controls.

## Security and network access

- Keep the app's `homeassistant_api` permission enabled only while using this
  dashboard. The associated token can access Home Assistant Core with elevated
  privileges, so maintain the app updated.
- Do not add a `ports` mapping or expose port 3000. Use Ingress.
- The server checks the TCP peer address and rejects requests that do not come
  from the Supervisor ingress proxy (`172.30.32.2`).
- Widgets can call only the typed light, switch, climate, and media-player
  operations implemented by the app. No locks, alarms, covers, or arbitrary
  service calls are exposed.

## Troubleshooting

### Home Assistant is unavailable

Confirm the app is installed and running under Supervisor with
`homeassistant_api: true`. Check the app log for startup errors. Do not copy a
user token into the app; the Supervisor injects the required token. The app
retries dropped WebSocket connections and periodically checks for stale
connections while the dashboard is open. If a socket remains disconnected for
one minute, the app replaces it with a fresh connection. The dashboard also
refreshes its connection snapshot periodically and when the page becomes
visible again.

### Ingress returns an error or the page has missing styles

Open the app using **Open Web UI** in Home Assistant rather than a direct
address. The app uses relative asset and API URLs because the Ingress path is
different for each installation. Confirm no reverse proxy strips the Ingress
path or blocks streaming responses.

### Layout changes do not appear on another device

Use **Save layout** after editing. Confirm the add-on's `/data` mount is
persistent and that the app log does not report a database error. If two
devices saved concurrently, reload the latest layout or deliberately save
your version from the conflict prompt.

### Some entities are not available as widgets

Only visible `light`, `switch`, `sensor`, `climate`, `media_player`, `weather`,
`calendar`, and `script` entities are supported. In Edit mode, first choose a
card type, then select a compatible entity. Charts use numeric `sensor`
entities; clock cards do not require a Home Assistant entity.

### Sensor charts show no history

Charts require Home Assistant recorder history for the selected numeric sensor.
Check that recorder is enabled and that the entity is not excluded from history.
The chart error includes the Home Assistant response detail; use **Try again**
after fixing recorder access. Failed requests are also logged by the add-on.

## License

This project does not yet include a license declaration. Choose and add a
license before redistributing it.
