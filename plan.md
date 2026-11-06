# Home Assistant Glass Dashboard — Project Plan

## Goal

Build a Home Assistant Supervisor-managed app/add-on that provides a responsive
replacement dashboard for everyday viewing and control. It opens through Home
Assistant Ingress, with a portrait 9:16 mini-tablet as its primary display.
Household members can edit a dashboard in an explicit edit mode, using
touch-friendly drag and drop, and the saved layout is shared across devices.

Glass UI components installed from the supplied shadcn registry are the visual
building blocks, not a separate runtime UI dependency. Home Assistant-specific
behavior belongs in dashboard widgets and adapters around those components.

## Decisions and assumptions

- Start from a clean directory; there is no existing application to preserve.
- Use Next.js App Router, TypeScript, and Tailwind CSS unless the Glass UI
  registry proves incompatible during the foundation spike.
- Package as a Home Assistant app/add-on with Supervisor Ingress; do not
  publish a direct host port. Use Ingress for browser access and its HTTPS
  session boundary instead of a second app login.
- Use the Supervisor-provided `SUPERVISOR_TOKEN` and Core API proxy to connect
  to the same Home Assistant instance. Do not ask the user to enter or persist
  a separate HA URL or long-lived token.
- Request only the `homeassistant_api` permission required to read entity state
  and call supported services. Treat `SUPERVISOR_TOKEN` as a highly privileged
  credential: keep it server-side, do not log it, and expose only a narrow,
  typed set of control operations.
- Let Home Assistant manage Ingress authentication; the dashboard is available
  to users allowed to open the app. Do not enable a host port or public
  internet access in the first release.
- Persist one shared dashboard in SQLite under the add-on's persistent `/data`
  mount. Run one app instance and one database writer.
- Start with lights, switches, sensors, climate, and media players. Additional
  widget types are later work.
- The exact tablet model and resolution are not yet known. Use a representative
  portrait viewport for automated tests, then verify on the actual kiosk before
  release.

## Product scope

### First release

- Add-on health status for the Supervisor-provided Home Assistant connection.
- Live entity state updates, with clear disconnected, stale, unavailable, and
  error states.
- A portrait-first dashboard with a responsive layout.
- View mode and edit mode.
- Add, configure, reorder, move, resize, and remove supported widgets.
- Persist the shared layout; reload it on other devices.
- A usable baseline widget set:
  - Light: on/off and supported brightness control.
  - Switch: on/off.
  - Sensor: state and optional unit/icon.
  - Climate: current/target temperature and supported setpoint/mode controls.
  - Media player: state and supported play/pause/volume controls.
- Accessible, touch-sized controls and explicit feedback for failed actions.
- Home Assistant local add-on installation, persistent storage, backup, and
  update guidance.

### Explicitly out of scope for the first release

- Recreating every Home Assistant dashboard card or integration.
- Camera streaming, history graphs, weather, floor plans, automations, and
  arbitrary user-defined service calls.
- Multiple users with separate permissions or per-user layouts.
- Multiple Home Assistant instances.
- Direct host-port access, user-configured HA tokens/URLs, and public-internet
  exposure.

## Proposed architecture

```text
Browser / kiosk
  ├─ View and edit UI (Glass UI-based components)
  ├─ Dashboard API (served only through Home Assistant Ingress)
  └─ Live updates (Ingress-protected app stream)
              │
              ▼
Next.js app/add-on
  ├─ Home Assistant adapter
  │    ├─ Supervisor-proxied authenticated HA WebSocket connection
  │    ├─ Entity state cache and subscriptions
  │    └─ Allow-listed service calls for supported widgets
  ├─ Dashboard API and validation
  └─ SQLite persistence on the add-on's /data mount
```

### Key boundaries

- The browser talks only to the app through Ingress. It never receives
  `SUPERVISOR_TOKEN` and never connects directly to the HA API.
- The HA adapter is the only module permitted to authenticate to HA or issue
  HA service calls.
- Do not expose container ports directly. Bind the app to the internal add-on
  network and accept requests only from the Supervisor proxy at 172.30.32.2.
  Use Ingress for the UI, API, and
  live-update stream; the dashboard is available to Home Assistant users who
  can open the app.
- Supervisor Core API access is highly privileged. Keep its token server-only
  and constrain app service calls to supported domains and widget actions.
- Widgets request typed, supported actions. Do not expose a generic endpoint
  that accepts arbitrary HA service names and payloads.
- Validate all client-submitted entity IDs, widget configuration, and layout
  data on the server. An entity's current HA state is not a substitute for
  validating an action.
- Never log tokens, credentials, or full secret-bearing setup requests.

## Implementation plan

### Phase 0 — Verify the foundation and registry

1. Inspect the Glass UI registry using the supplied command:

   ```sh
   npx shadcn@latest add @glass-ui/button
   ```

2. Record the registry's framework, Tailwind, theme-token, icon, and peer
   dependency requirements. Confirm the button renders and styles correctly
   in the proposed Next.js app.
3. Check the registry for the components needed by the first-release UI
   (cards, dialogs/sheets, inputs, toggles, selects, sliders, tooltips, and
   feedback/toasts). Add only components that are actually available and
   needed; identify suitable accessible fallbacks for gaps.
4. Verify that component source is installed locally and can be adapted without
   duplicating or fighting its styling conventions.
5. Decide the drag/resize implementation only after a short touch-input spike.
   Test pointer, mouse, and touch behavior on a representative narrow portrait
   viewport. Select a maintained library or a small custom implementation based
   on that evidence; do not assume desktop drag behavior works on a kiosk.

**Exit criteria**

- A clean install and production build succeed.
- The Glass UI button renders with the intended theme and no console errors.
- Registry requirements and unavailable components are documented as
  implementation choices, not guessed dependencies.
- A touch-compatible drag/resize approach is selected or a blocking
  incompatibility is reported before proceeding.

### Phase 1 — App shell and Home Assistant app packaging

1. Set up Next.js, TypeScript, Tailwind, linting, formatting, and tests. Add a
   minimal page shell and the Glass UI theme.
2. Package an installable local Home Assistant add-on with Ingress, an
   Ingress panel, `homeassistant_api: true`, and persistent `/data`
   storage. Do not expose a direct host port.
3. Use Home Assistant's Ingress session as the browser access boundary; do not
   add a second login or expose setup that accepts arbitrary HA URLs/tokens.
4. Configure the app to serve scripts, styles, API calls, and live updates
   correctly below the dynamic Ingress URL prefix.
5. Add a health indicator and clear diagnostics for missing Supervisor access,
   startup failures, and unavailable Home Assistant.

**Exit criteria**

- The app installs as a local Home Assistant add-on, opens through Ingress, and
  has no mapped host port.
- Browser assets/API/SSE requests work below an Ingress token path; the server
  rejects requests that do not originate from the Supervisor proxy.
- `SUPERVISOR_TOKEN` is never included in browser data, logs, or source code.
- Missing Supervisor permissions and HA connection errors are visible rather
  than silently rendered as a healthy connection.

### Phase 2 — Home Assistant adapter and entity model

1. Use the Supervisor Core API proxy (`http://supervisor/core`) and its
   `SUPERVISOR_TOKEN` with the maintained `home-assistant-js-websocket` client.
   The proxy avoids asking the user for HA connection details or a separate
   long-lived access token.
2. Define typed server-side models for HA entities, state updates, connection
   health, supported widget configuration, and supported actions.
3. Handle initial connection, authentication failure, disconnect, reconnect
   with bounded backoff, and stale state. Expose connection status separately
   from entity state.
4. Implement typed service adapters for only the first-release controls.
   Validate domain, entity ID, requested fields, and value ranges before
   issuing a call. Return explicit success or failure to the UI.
5. Ensure concurrent updates do not leave the UI permanently stale; refresh or
   reconcile the relevant state after a service call.

**Exit criteria**

- A valid HA connection produces an initial state and receives live updates.
- Missing Supervisor permissions, server unavailability, and reconnects are
  surfaced distinctly and do not crash the app.
- Tests prove that unsupported domains, malformed IDs, and invalid control
  values cannot trigger a service call.
- A supported control updates HA and the displayed state reflects the result.

### Phase 3 — Responsive dashboard and widget registry

1. Define a versioned dashboard schema. Each widget has a stable ID, widget
   type, entity ID, validated display/control options, and layout data in
   documented grid units. Store schema version, revision, and timestamps.
   Define how breakpoints map that canonical layout to a viewport; store
   explicit breakpoint layouts only if users can edit them, and never persist
   a temporary responsive reflow as a user edit.
2. Build a widget registry that maps each supported type to its configuration
   schema, editor, renderer, and permitted actions. Unknown or invalid widget
   types render a recoverable error in edit mode rather than crashing the
   dashboard.
3. Implement the shared dashboard surface and the initial five widget types.
   Use Glass UI components where they fit, adding thin HA-specific wrappers
   instead of copying component implementations.
4. Make the portrait tablet the primary breakpoint. Support narrower and
   wider viewports without horizontal page scrolling; define layout behavior
   for widgets that cannot fit at a narrow width.
5. Provide clear loading, empty, unavailable, stale, and action-error states.
   Keep live state updates efficient and update only affected widgets where
   practical.

**Exit criteria**

- Every first-release widget can be rendered from validated schema data.
- Missing entities and unavailable states are understandable and do not break
  neighboring widgets.
- At the agreed representative portrait viewport (initially 800 × 1422 CSS
  pixels unless the tablet's actual viewport is known), the page has no
  horizontal overflow and all widget content remains usable.
- The app remains usable at a standard desktop viewport.

### Phase 4 — Editing and shared layout persistence

1. Add an explicit edit mode with add-widget, choose-entity, configure,
   reorder, move, resize, and remove flows.
2. Make drag and resize work with touch, pointer, and mouse. Provide a
   non-drag alternative (such as move up/down and size controls) for
   accessibility and precise kiosk use.
3. Persist edits through authenticated server APIs. Validate and normalize the
   complete submitted layout before saving it.
4. Add optimistic concurrency using a revision/version number. If another
   device has changed the layout, show the conflict and offer reload or
   deliberate overwrite; never silently discard one device's edits.
5. Save atomically in a transaction. Add ordered database migrations and keep
   a recoverable default layout. Provide a reset or backup/restore path for the
   shared layout, and document that backups contain household configuration
   even when they do not contain the HA token.

**Exit criteria**

- Adding, moving, resizing, configuring, and deleting widgets works by touch
  and mouse; keyboard-accessible alternatives are available.
- A saved change appears on a second device after refresh or live update.
- Simultaneous edits cannot silently overwrite one another.
- Malformed or outdated layout data produces a visible recovery path and does
  not make the entire dashboard unavailable.

### Phase 5 — Kiosk readiness, deployment, and release validation

1. Add kiosk-oriented presentation: portrait layout, restrained status chrome,
   readable typography, persistent connection visibility, and no accidental
   entry into edit mode.
2. Document local add-on installation, the Ingress panel,
   Supervisor API permission, persistent SQLite storage, database backup,
   upgrades, and recovery.
3. Deploy on the intended home-network host and verify routing, persistence
   across restart, and HA reconnect behavior.
4. Validate on the actual mini-tablet at its native resolution and browser.
   Check touch precision, screen sleep/wake, kiosk/full-screen behavior, safe
   areas, and any browser-specific limitations.
5. Run unit, integration, and end-to-end checks; do not release with known
   high-severity security defects or silent control failures.

**Exit criteria**

- A restart preserves the shared dashboard and reconnects to HA.
- The dashboard is accessible through the Home Assistant Ingress panel only;
  no direct port is exposed.
- The actual kiosk has no clipped essential controls or horizontal scrolling.
- Common supported controls work end-to-end and failures are visible.
- Installation, backup, update, and restore instructions are complete.

## Data and interaction requirements

- **Layout persistence:** versioned JSON stored in SQLite with a stable
  dashboard ID, revision, update time, and validated widget records.
- **Database lifecycle:** use migrations for schema changes, transactional
  writes for layout saves, and a tested backup/restore process. Keep the SQLite
  file on persistent local storage; the first-release topology is one app
  instance and one database writer.
- **HA secrets:** use only the Supervisor-provided token. Keep it in the server
  process, never return or persist it, and treat it as an administrator-level
  secret because Core API proxy access is highly privileged.
- **Entity state:** live server cache only; HA remains the source of truth.
  Do not treat cached state as confirmed after a disconnect.
- **Actions:** explicit supported operations per widget, range validation, and
  visible pending/success/failure feedback. Do not optimistically show a
  successful state before HA confirms it.
- **Destructive or security-sensitive controls:** keep lock, alarm, cover, and
  other potentially consequential domains out of the first release unless
  explicitly scoped and designed with suitable confirmation and feedback.
- **Multiple devices:** all devices use the same persisted dashboard. A device
  may adapt its rendering responsively, but must not independently rewrite
  shared layout just because its viewport differs.

## Quality and acceptance checks

### Automated

- Unit tests for schema validation, widget action rules, layout normalization,
  and responsive layout calculations.
- Adapter tests for authentication errors, initial state, live updates,
  disconnect/reconnect, and service-call validation.
- API tests for ingress-peer restrictions, invalid input, explicit errors, and
  absence of secrets in responses.
- End-to-end tests for viewing live state, changing a supported entity,
  editing/saving a layout, and loading that layout in a second browser context.
- Browser viewport checks at the agreed portrait kiosk viewport and desktop
  viewport, including no horizontal overflow.
- Production build, type-check, lint, and test suite pass in CI.

### Manual on-device

- Verify native portrait resolution, touch drag/resize, keyboard or accessible
  alternatives, brightness/contrast, and legibility at normal kiosk distance.
- Verify kiosk recovery after browser reload, network interruption, HA restart,
  and host restart.
- Confirm controls provide clear feedback and do not look successful when a
  service call fails.

### Accessibility and usability baseline

- Aim for at least 44 × 44 CSS-pixel primary touch targets.
- Preserve visible focus, keyboard operation, semantic names, and readable
  contrast.
- Do not make drag-and-drop the only way to arrange widgets.
- Respect reduced-motion preferences and avoid relying on color alone for
  connection or entity status.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Registry components assume a different framework or styling setup | Resolve in Phase 0; adapt tokens or stop and choose a compatible foundation before building the app. |
| Drag-and-drop works with a mouse but not tablet touch | Require a touch-input spike and on-device validation; provide non-drag editing controls. |
| Supervisor token exposure through client code or logs | Keep all HA communication server-side; never log `SUPERVISOR_TOKEN`; test browser payloads and logs. |
| Persistent HA socket becomes stale or reconnect loops | Track connection health separately, use bounded backoff, and test HA/network restarts. |
| Shared edits overwrite changes from another device | Use revision-based optimistic concurrency and explain conflicts to the user. |
| Responsive sizing makes the shared layout unusable on another screen | Separate stored logical layout from viewport rendering; test multiple aspect ratios and never auto-save responsive transformations. |
| SQLite data or encryption key is lost | Document persistent volume, backups, restore, and key recovery; test restart and restore procedures. |
| User assumes every HA entity is supported | Show only compatible entities during widget creation and clearly report unsupported entities. |

## Release definition

The first release is ready when an administrator can install and open the
Ingress app, use the five initial widget types with live state and supported
controls, arrange a shared dashboard from the portrait kiosk by touch, see the
layout on another device, and recover from common HA/network interruptions
without exposing `SUPERVISOR_TOKEN` or silently losing edits.

## Implementation status

- The scoped Phase 0-4 feature implementation is present: Supervisor/Ingress
  packaging, supported entity controls, responsive widgets, add/edit/reorder/
  resize/remove, shared SQLite persistence, revision conflict handling, and
  editable shared appearance settings.
- Local unit/API tests, lint, type-check, production build, and Docker image
  build are available. These do not replace end-to-end verification against
  the user's live Home Assistant instance.
- Release checks still requiring the target environment are live control
  confirmation, two-device persistence, restart/network recovery, and
  tablet-native viewport, touch, sleep/wake, and browser validation. Expand
  adapter and Ingress integration tests before treating the release checklist
  as certified.
- The project intentionally remains a focused dashboard, not a complete
  replacement for every Home Assistant card. Cameras, history, weather, locks,
  alarms, covers, and arbitrary services remain out of scope.
