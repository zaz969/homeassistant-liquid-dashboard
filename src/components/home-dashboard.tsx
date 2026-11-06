"use client";

import {
  Activity,
  Check,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  GripVertical,
  House,
  Lightbulb,
  LoaderCircle,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Thermometer,
  Trash2,
  Tv,
  Volume2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Badge } from "@/components/ui/glass/badge";
import { Button } from "@/components/ui/glass/button";
import { Card } from "@/components/ui/glass/card";
import { LiquidGlassProvider } from "@/components/ui/liquid/liquid-glass-provider";
import { Input } from "@/components/ui/glass/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/glass/select";
import { Slider } from "@/components/ui/glass/slider";
import { Switch } from "@/components/ui/glass/switch";
import type { DashboardLayout, DashboardWidget } from "@/lib/dashboard";
import type { HaSnapshot, PublicEntity } from "@/lib/home-assistant";
import { defaultTheme, themePresets, wallpaperPresets, type ThemeSettings } from "@/lib/theme";
import { createWidgetId } from "@/lib/widget-id";
import WallpaperCanvas from "@/components/wallpaper-canvas";
import { CalendarCard, LocalClockCard, SensorChartCard, WeatherCard } from "@/components/widget-cards";

type DashboardResponse = {
  revision: number;
  layout: DashboardLayout;
  updatedAt: string | null;
  invalidStoredLayout?: boolean;
};

type SettingsResponse = {
  revision: number;
  theme: ThemeSettings;
  updatedAt: string | null;
  invalidStoredTheme?: boolean;
};

function apiUrl(path: string) {
  return new URL(path, document.baseURI).pathname;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; current?: T })
    | null;
  if (!response.ok) {
    const error = new Error(payload?.error ?? "The request could not be completed.");
    if (response.status === 409 && payload?.current) {
      Object.assign(error, { current: payload.current });
    }
    throw error;
  }
  if (!payload) throw new Error("The server returned an invalid response.");
  return payload;
}

function SortableWidget({
  id,
  className,
  disabled,
  children,
}: {
  id: string;
  className: string;
  disabled: boolean;
  children: (handle: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
  }) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      className={`sortable-widget${isDragging ? " is-dragging" : ""} ${className}`}
      data-widget-id={id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      {children({ attributes, listeners, setActivatorNodeRef })}
    </div>
  );
}

function widgetTypeFor(entity: PublicEntity): DashboardWidget["type"] | null {
  if (
    entity.domain === "light" ||
    entity.domain === "switch" ||
    entity.domain === "sensor" ||
    entity.domain === "climate" ||
    entity.domain === "media_player" ||
    entity.domain === "weather" ||
    entity.domain === "calendar"
  ) {
    return entity.domain;
  }
  return null;
}

const widgetOptions: Array<{
  type: DashboardWidget["type"];
  label: string;
  description: string;
  entityLabel: string;
}> = [
  { type: "light", label: "Light", description: "Toggle and brightness", entityLabel: "light" },
  { type: "switch", label: "Switch", description: "Toggle a device", entityLabel: "switch" },
  { type: "sensor", label: "Sensor", description: "Show the current reading", entityLabel: "sensor" },
  { type: "climate", label: "Climate", description: "Temperature and HVAC controls", entityLabel: "climate" },
  { type: "media_player", label: "Media", description: "Playback and volume", entityLabel: "media player" },
  { type: "weather", label: "Weather", description: "Conditions and measurements", entityLabel: "weather" },
  { type: "calendar", label: "Calendar", description: "Current or upcoming event", entityLabel: "calendar" },
  { type: "chart", label: "Chart", description: "24-hour sensor history", entityLabel: "sensor" },
  { type: "clock", label: "Clock", description: "Local time and date", entityLabel: "none" },
];

function entityDomainForWidget(type: DashboardWidget["type"]) {
  return type === "chart" ? "sensor" : type;
}

function shortValue(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && value.trim() !== "" ? numeric.toFixed(1) : value;
}

export default function HomeDashboard() {
  const [snapshot, setSnapshot] = useState<HaSnapshot>({
    status: "connecting",
    error: null,
    entities: [],
  });
  const [dashboard, setDashboard] = useState<DashboardResponse>({
    revision: 0,
    layout: { version: 1, widgets: [] },
    updatedAt: null,
  });
  const [settings, setSettings] = useState<SettingsResponse>({
    revision: 0,
    theme: defaultTheme,
    updatedAt: null,
  });
  const [savedTheme, setSavedTheme] = useState<SettingsResponse>({
    revision: 0,
    theme: defaultTheme,
    updatedAt: null,
  });
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeSaveMessage, setThemeSaveMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedWidgetType, setSelectedWidgetType] = useState<DashboardWidget["type"] | null>(null);
  const [selectedEntity, setSelectedEntity] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState("");
  const [conflict, setConflict] = useState<DashboardResponse | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("theme");
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const [settingsDialogElement, setSettingsDialogElement] = useState<HTMLDialogElement | null>(null);
  const setSettingsDialogRef = useCallback((element: HTMLDialogElement | null) => {
    settingsDialog.current = element;
    setSettingsDialogElement(element);
  }, []);

  const updateSnapshot = useCallback((value: HaSnapshot) => {
    setSnapshot(value);
  }, []);
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadDashboard = useCallback(async () => {
    try {
      const current = await requestJson<DashboardResponse>("api/dashboard");
      setDashboard(current);
      setConflict(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load the dashboard.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [haSnapshot, currentDashboard, currentSettings] = await Promise.all([
          requestJson<HaSnapshot>("api/entities"),
          requestJson<DashboardResponse>("api/dashboard"),
          requestJson<SettingsResponse>("api/settings"),
        ]);
        if (!active) return;
        setSnapshot(haSnapshot);
        setDashboard(currentDashboard);
        setSettings(currentSettings);
        setSavedTheme(currentSettings);
        if (currentSettings.invalidStoredTheme) {
          setThemeSaveMessage("Saved theme settings were invalid. Choose a theme and save to replace them.");
        }
      } catch (error) {
        if (active) {
          setNotice(error instanceof Error ? error.message : "Could not load the dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const events = new EventSource(apiUrl("api/events"));
    events.onmessage = (event) => {
      try {
        if (active) updateSnapshot(JSON.parse(event.data) as HaSnapshot);
      } catch {
        if (active) setNotice("Received an invalid Home Assistant state update.");
      }
    };
    events.onerror = () => {
      if (active) {
        setSnapshot((previous) =>
          previous.status === "connected"
            ? { ...previous, status: "disconnected" }
            : previous,
        );
      }
    };

    return () => {
      active = false;
      events.close();
    };
  }, [updateSnapshot]);

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date()),
      );
    };
    const initialUpdate = window.setTimeout(updateClock, 0);
    const timer = setInterval(updateClock, 30_000);
    return () => {
      window.clearTimeout(initialUpdate);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const dialog = settingsDialog.current;
    if (!dialog) return;
    if (settingsOpen && !dialog.open) dialog.showModal();
    if (!settingsOpen && dialog.open) dialog.close();
  }, [settingsOpen]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--dashboard-font-scale",
      String(settings.theme.fontScale),
    );
    return () => {
      document.documentElement.style.removeProperty("--dashboard-font-scale");
    };
  }, [settings.theme.fontScale]);

  const entities = useMemo(
    () => snapshot.entities.filter((entity) => widgetTypeFor(entity) !== null),
    [snapshot.entities],
  );
  const compatibleEntities = selectedWidgetType && selectedWidgetType !== "clock"
    ? entities.filter((entity) => entity.domain === entityDomainForWidget(selectedWidgetType))
    : [];
  const selectedEntityRecord = compatibleEntities.find((entity) => entity.entityId === selectedEntity);
  const statusLabel = {
    connecting: "Connecting",
    connected: "Home connected",
    disconnected: "Reconnecting",
    error: "Connection issue",
  }[snapshot.status];

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 5000);
  };

  const addWidget = () => {
    if (!selectedWidgetType) return;
    if (selectedWidgetType !== "clock" && !selectedEntityRecord) return;
    const entityId = selectedWidgetType === "clock" ? "clock.local" : selectedEntityRecord?.entityId;
    if (!entityId) return;
    const widget: DashboardWidget = {
      id: createWidgetId(),
      type: selectedWidgetType,
      entityId,
      ...(widgetTitle.trim() ? { title: widgetTitle.trim() } : {}),
      width: selectedWidgetType === "chart" || selectedWidgetType === "calendar" ? 2 : 1,
      height: 1,
    };
    setDashboard((current) => ({
      ...current,
      layout: { ...current.layout, widgets: [...current.layout.widgets, widget] },
    }));
    setSelectedWidgetType(null);
    setSelectedEntity("");
    setWidgetTitle("");
    setPickerOpen(false);
  };

  const saveDashboard = async () => {
    setSaving(true);
    try {
      const saved = await requestJson<DashboardResponse>("api/dashboard", {
        method: "PUT",
        body: JSON.stringify({
          revision: dashboard.revision,
          layout: dashboard.layout,
        }),
      });
      setDashboard(saved);
      setConflict(null);
      setEditing(false);
      showNotice("Dashboard saved for all devices.");
    } catch (error) {
      const latest = (error as Error & { current?: DashboardResponse }).current;
      if (latest) setConflict(latest);
      showNotice(error instanceof Error ? error.message : "Could not save dashboard.");
    } finally {
      setSaving(false);
    }
  };

  const reloadLatest = async () => {
    await loadDashboard();
    setEditing(false);
  };

  const overwriteConflict = async () => {
    if (!conflict) return;
    setDashboard((current) => ({ ...current, revision: conflict.revision }));
    const expectedRevision = conflict.revision;
    setSaving(true);
    try {
      const saved = await requestJson<DashboardResponse>("api/dashboard", {
        method: "PUT",
        body: JSON.stringify({
          revision: expectedRevision,
          layout: dashboard.layout,
        }),
      });
      setDashboard(saved);
      setConflict(null);
      setEditing(false);
      showNotice("Your dashboard changes are now shared.");
    } catch (error) {
      const latest = (error as Error & { current?: DashboardResponse }).current;
      if (latest) setConflict(latest);
      showNotice(error instanceof Error ? error.message : "Could not save dashboard.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    widget: DashboardWidget,
    action: string,
    value?: number | string,
  ) => {
    setPendingAction(widget.id);
    setNotice("");
    try {
      await requestJson("api/control", {
        method: "POST",
        body: JSON.stringify({
          entityId: widget.entityId,
          action,
          ...(value !== undefined ? { value } : {}),
        }),
      });
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Home Assistant could not complete that action.");
    } finally {
      setPendingAction(null);
    }
  };

  const moveWidget = (id: string, direction: -1 | 1) => {
    setDashboard((current) => {
      const widgets = [...current.layout.widgets];
      const index = widgets.findIndex((widget) => widget.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= widgets.length) return current;
      [widgets[index], widgets[next]] = [widgets[next], widgets[index]];
      return { ...current, layout: { ...current.layout, widgets } };
    });
  };

  const updateWidget = (id: string, update: Partial<DashboardWidget>) => {
    setDashboard((current) => ({
      ...current,
      layout: {
        ...current.layout,
        widgets: current.layout.widgets.map((widget) =>
          widget.id === id ? { ...widget, ...update } : widget,
        ),
      },
    }));
  };

  const saveTheme = async () => {
    setSavingTheme(true);
    setThemeSaveMessage("");
    try {
      const saved = await requestJson<SettingsResponse>("api/settings", {
        method: "PUT",
        body: JSON.stringify({
          revision: settings.revision,
          theme: settings.theme,
        }),
      });
      setSettings(saved);
      setSavedTheme(saved);
      setThemeSaveMessage("Settings saved.");
    } catch (error) {
      const latest = (error as Error & { current?: SettingsResponse }).current;
      if (latest) {
        setSettings(latest);
        setSavedTheme(latest);
      }
      setThemeSaveMessage(
        latest
          ? "Settings changed on another device. Latest settings loaded; reapply your changes to save."
          : error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setSavingTheme(false);
    }
  };

  const closeSettings = () => {
    setSettings(savedTheme);
    setThemeSaveMessage("");
    setSettingsOpen(false);
  };

  const themeStyle = {
    "--theme-background-a": settings.theme.colors.backgroundA,
    "--theme-background-b": settings.theme.colors.backgroundB,
    "--theme-background-c": settings.theme.colors.backgroundC,
    "--theme-accent": settings.theme.colors.accent,
    "--dashboard-ui-scale": settings.theme.uiScale,
    "--dashboard-glass-transparency": settings.theme.glassTransparency / 100,
    "--dashboard-glass-reflectivity": settings.theme.glassReflectivity / 100,
  } as CSSProperties;
  const glassOptions = useMemo(
    () => ({
      mode: "dark" as const,
      refraction: 30,
      dispersion: 0.08,
      frost: 14,
      bezel: 26,
      reflectivity: settings.theme.glassReflectivity / 100,
      liquid: true,
    }),
    [settings.theme.glassReflectivity],
  );

  return (
    <LiquidGlassProvider options={glassOptions}>
    <main className="dashboard-shell" style={themeStyle}>
      <WallpaperCanvas
        wallpaper={settings.theme.wallpaper}
        colors={settings.theme.colors}
        animated={settings.theme.animated}
        speed={settings.theme.speed}
      />
      <header
        className={`topbar lg lg-${settings.theme.topbarStyle === "minimal" ? "clear" : settings.theme.topbarStyle === "glass" ? "regular" : settings.theme.topbarStyle} lg-bar topbar-${settings.theme.topbarStyle}`}
        data-glass="bar"
      >
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <House size={21} strokeWidth={2.2} />
          </div>
          <div>
            <p className="eyebrow">HOME CONTROL</p>
            <h1>{settings.theme.brandTitle}</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <Badge
            className={`connection-pill connection-${snapshot.status}`}
            role="status"
            aria-live="polite"
          >
            {snapshot.status === "connected" ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{statusLabel}</span>
          </Badge>
          <span className="clock">{clock}</span>
          <Button
            type="button"
            variant="outline"
            className="top-action settings-action"
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={17} />
          </Button>
          {editing ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="top-action"
                onClick={reloadLatest}
                disabled={saving}
              >
                <X size={17} /> <span>Cancel</span>
              </Button>
              <Button
                type="button"
                className="top-action save-action"
                onClick={saveDashboard}
                disabled={saving}
              >
                {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
                <span>{saving ? "Saving" : "Save layout"}</span>
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="top-action"
              onClick={() => setEditing(true)}
            >
              <Pencil size={17} /> <span>Edit</span>
            </Button>
          )}
        </div>
      </header>

      {notice && (
        <div className="notice" role="status">
          <CircleAlert size={18} />
          <span>{notice}</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={16} />
          </Button>
        </div>
      )}

      {snapshot.error && (
        <div className="connection-banner" role="alert">
          <div className="connection-banner-icon"><WifiOff size={19} /></div>
          <div>
            <strong>Home Assistant isn’t available yet</strong>
            <p>{snapshot.error} Make sure the app has Home Assistant API access and is running under Supervisor.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="refresh-button"
            onClick={() => {
              void requestJson<HaSnapshot>("api/entities")
                .then(setSnapshot)
                .catch((error: unknown) =>
                  showNotice(error instanceof Error ? error.message : "Could not reconnect to Home Assistant."),
                );
            }}
          >
            <RefreshCw size={16} /> Retry
          </Button>
        </div>
      )}

      {dashboard.invalidStoredLayout && (
        <div className="notice" role="alert">
          <CircleAlert size={18} />
          <span>The saved layout could not be read. Saving this layout will replace it with a recoverable version.</span>
        </div>
      )}

      {conflict && (
        <div className="conflict-banner" role="alert">
          <div>
            <strong>This dashboard changed on another device.</strong>
            <p>Reload the latest layout or deliberately save your version over it.</p>
          </div>
          <div className="conflict-actions">
            <Button type="button" variant="outline" onClick={reloadLatest}>Reload latest</Button>
            <Button type="button" onClick={overwriteConflict} disabled={saving}>
              Save my version
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <section className="edit-toolbar lg lg-regular lg-surface" aria-label="Dashboard editor">
          <div className="edit-toolbar-copy">
            <div className="edit-icon"><SlidersHorizontal size={19} /></div>
            <div>
              <strong>Dashboard editor</strong>
            </div>
          </div>
          <Button
            type="button"
            className="add-widget-button"
            onClick={() => {
              setPickerOpen((open) => !open);
            }}
          >
            {pickerOpen ? <X size={18} /> : <Plus size={19} />}
            {pickerOpen ? "Close" : "Add widget"}
          </Button>
        </section>
      )}

      {editing && pickerOpen && (
        <section className="picker lg lg-regular lg-surface" aria-label="Add a widget">
          <div className="picker-heading">
            <div>
              <p className="eyebrow muted-eyebrow">NEW WIDGET</p>
              <h3>Choose a card type</h3>
            </div>
            <span className="entity-count">{dashboard.layout.widgets.length} / 40 cards</span>
          </div>
          <div className="widget-type-options" role="group" aria-label="Card type">
            {widgetOptions.map((option) => (
              <Button
                type="button"
                key={option.type}
                variant="outline"
                className={`widget-type-option${selectedWidgetType === option.type ? " is-selected" : ""}`}
                aria-pressed={selectedWidgetType === option.type}
                disabled={dashboard.layout.widgets.length >= 40}
                onClick={() => {
                  setSelectedWidgetType(option.type);
                  setSelectedEntity("");
                }}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
                {option.type !== "clock" && (
                  <small>
                    {entities.filter((entity) => entity.domain === entityDomainForWidget(option.type)).length}
                  </small>
                )}
              </Button>
            ))}
          </div>
          {dashboard.layout.widgets.length >= 40 && (
            <p className="picker-limit-note" role="status">This dashboard has reached the 40-card limit. Remove a card before adding another.</p>
          )}
          {selectedWidgetType && (
            <div className="picker-fields">
              {selectedWidgetType === "clock" ? (
                <p className="picker-standalone-note">This card uses the tablet’s local time and doesn’t need an entity.</p>
              ) : (
                <label>
                  <span>Choose a {widgetOptions.find((option) => option.type === selectedWidgetType)?.entityLabel}</span>
                  <Select value={selectedEntity || undefined} onValueChange={setSelectedEntity}>
                    <SelectTrigger aria-label="Home Assistant entity">
                      <SelectValue placeholder="Select an entity…" />
                    </SelectTrigger>
                    <SelectContent>
                      {compatibleEntities.map((entity) => (
                        <SelectItem value={entity.entityId} key={entity.entityId}>
                          {entity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {compatibleEntities.length === 0 && (
                    <small className="no-compatible-entities">No compatible entities are currently available.</small>
                  )}
                </label>
              )}
              <label>
                <span>Card title <small>Optional</small></span>
                <Input
                  type="text"
                  maxLength={48}
                  value={widgetTitle}
                  onChange={(event) => setWidgetTitle(event.target.value)}
                  placeholder={selectedEntityRecord?.name ?? "Use default title"}
                />
              </label>
              <Button
                type="button"
                className="picker-add"
                onClick={addWidget}
                disabled={selectedWidgetType !== "clock" && !selectedEntityRecord}
              >
                <Plus size={17} /> Add to dashboard
              </Button>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="loading-state"><LoaderCircle className="spin" size={24} /> Loading…</div>
      ) : dashboard.layout.widgets.length === 0 ? (
        <section className="empty-state lg lg-regular lg-surface">
          <h3>No widgets yet</h3>
          <Button
            type="button"
            className="empty-add-button"
            onClick={() => {
              setEditing(true);
              setPickerOpen(true);
            }}
          >
            <Plus size={18} /> Add your first widget
          </Button>
        </section>
      ) : (
        <DndContext
          sensors={dragSensors}
          onDragEnd={({ active, over }: DragEndEvent) => {
            if (!over || active.id === over.id) return;
            setDashboard((current) => {
              const from = current.layout.widgets.findIndex((widget) => widget.id === active.id);
              const to = current.layout.widgets.findIndex((widget) => widget.id === over.id);
              if (from < 0 || to < 0) return current;
              return {
                ...current,
                layout: {
                  ...current.layout,
                  widgets: arrayMove(current.layout.widgets, from, to),
                },
              };
            });
          }}
        >
          <SortableContext
            items={dashboard.layout.widgets.map((widget) => widget.id)}
            strategy={rectSortingStrategy}
          >
            <section className={`widget-grid${editing ? " is-editing" : ""}`} aria-label="Home controls">
              {dashboard.layout.widgets.map((widget, index) => {
                const entity = snapshot.entities.find((item) => item.entityId === widget.entityId);
                const toggleable = Boolean(
                  entity && (widget.type === "light" || widget.type === "switch"),
                );
                return (
                  <SortableWidget
                    key={widget.id}
                    id={widget.id}
                    disabled={!editing}
                    className={`${widget.width === 2 ? "widget-wide" : ""}${widget.height === 2 ? " widget-tall" : ""}`}
                  >
                    {({ attributes, listeners, setActivatorNodeRef }) => (
                      <Card
                        hover="glow"
                        className={`widget-card widget-${widget.type}`}
                        data-tint={((100 - settings.theme.glassTransparency) / 100 * 0.2).toFixed(3)}
                        aria-label={widget.title ?? entity?.name ?? `${widget.type.replace("_", " ")} widget`}
                        role={toggleable ? "group" : "article"}
                        tabIndex={!editing && toggleable ? 0 : undefined}
                        aria-roledescription={toggleable ? "toggle control" : undefined}
                        onClick={(event) => {
                          if (
                            !editing &&
                            toggleable &&
                            !(event.target as HTMLElement).closest("button, input, select")
                          ) {
                            void runAction(widget, "toggle");
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            !editing &&
                            toggleable &&
                            event.target === event.currentTarget &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            void runAction(widget, "toggle");
                          }
                        }}
                      >
                {editing && (
                  <div className="widget-edit-bar">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="drag-handle"
                      aria-label={`Drag ${widget.title ?? entity?.name ?? `${widget.type.replace("_", " ")} widget`} to reorder`}
                      title="Touch and drag to reorder"
                      ref={setActivatorNodeRef}
                      {...attributes}
                      {...listeners}
                    >
                      <GripVertical size={18} />
                    </Button>
                    <Input
                      className="widget-title-edit"
                      type="text"
                      maxLength={48}
                      aria-label="Widget title"
                      placeholder={entity?.name ?? `${widget.type.replace("_", " ")} widget`}
                      value={widget.title ?? ""}
                      onChange={(event) =>
                        updateWidget(widget.id, {
                          title: event.target.value || undefined,
                        })
                      }
                    />
                    <div className="widget-edit-actions">
                      <Button type="button" variant="outline" size="icon" aria-label="Move widget up" onClick={() => moveWidget(widget.id, -1)} disabled={index === 0}>
                        <ChevronUp size={17} />
                      </Button>
                      <Button type="button" variant="outline" size="icon" aria-label="Move widget down" onClick={() => moveWidget(widget.id, 1)} disabled={index === dashboard.layout.widgets.length - 1}>
                        <ChevronDown size={17} />
                      </Button>
                      {widget.type === "sensor" && (
                        <Button
                          type="button"
                          variant="outline"
                          className={widget.showChart ? "is-selected" : ""}
                          aria-pressed={widget.showChart === true}
                          aria-label={widget.showChart ? "Hide sensor chart" : "Show sensor chart"}
                          onClick={() => updateWidget(widget.id, { showChart: !widget.showChart })}
                        >
                          <ChartNoAxesCombined size={16} />
                          <span className="size-label">{widget.showChart ? "Chart on" : "Chart"}</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={widget.width === 1 ? "Make widget wider" : "Make widget narrower"}
                        onClick={() => updateWidget(widget.id, { width: widget.width === 1 ? 2 : 1 })}
                      >
                        <span className="size-label">{widget.width === 1 ? "Wide" : "Normal"}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={widget.height === 1 ? "Make widget taller" : "Make widget shorter"}
                        onClick={() => updateWidget(widget.id, { height: widget.height === 1 ? 2 : 1 })}
                      >
                        <span className="size-label">{widget.height === 1 ? "Tall" : "Short"}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="remove-widget"
                        aria-label="Remove widget"
                        onClick={() => {
                          setDashboard((current) => ({
                            ...current,
                            layout: {
                              ...current.layout,
                              widgets: current.layout.widgets.filter((item) => item.id !== widget.id),
                            },
                          }));
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                )}
                <WidgetBody
                  widget={widget}
                  entity={entity}
                  pending={pendingAction === widget.id}
                  connected={snapshot.status === "connected"}
                  onAction={(action, value) => void runAction(widget, action, value)}
                  editing={editing}
                />
              </Card>
                    )}
                  </SortableWidget>
                );
              })}
            </section>
          </SortableContext>
        </DndContext>
      )}

      <dialog
        ref={setSettingsDialogRef}
        className="settings-dialog lg lg-regular lg-surface"
        aria-labelledby="settings-title"
        onCancel={closeSettings}
        onClose={() => setSettingsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSettings();
        }}
      >
        <div className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <Button type="button" variant="outline" size="icon" className="settings-close" aria-label="Close settings" onClick={closeSettings}>
            <X size={20} />
          </Button>
        </div>
        <div className="settings-layout">
          <div
            className="settings-tabs"
            role="tablist"
            aria-label="Settings"
            aria-orientation="vertical"
          >
            <Button
              type="button"
              variant="outline"
              id="settings-tab-theme"
              className="settings-tab"
              role="tab"
              aria-selected={activeSettingsTab === "theme"}
              aria-controls="settings-panel-theme"
              onClick={() => setActiveSettingsTab("theme")}
            >
              Theme
            </Button>
            <Button
              type="button"
              variant="outline"
              id="settings-tab-display"
              className="settings-tab"
              role="tab"
              aria-selected={activeSettingsTab === "display"}
              aria-controls="settings-panel-display"
              onClick={() => setActiveSettingsTab("display")}
            >
              Display
            </Button>
            <Button
              type="button"
              variant="outline"
              id="settings-tab-glass"
              className="settings-tab"
              role="tab"
              aria-selected={activeSettingsTab === "glass"}
              aria-controls="settings-panel-glass"
              onClick={() => setActiveSettingsTab("glass")}
            >
              Glass
            </Button>
          </div>
          <section
            className="settings-panel"
            id="settings-panel-theme"
            role="tabpanel"
            aria-labelledby="settings-tab-theme"
            hidden={activeSettingsTab !== "theme"}
          >
            <h3>Appearance</h3>
            <p className="settings-description">Choose a wallpaper style, then customize its colors or motion.</p>
            <div className="theme-presets" aria-label="Theme presets">
              {Object.entries(themePresets).map(([key, preset]) => (
                <Button
                  type="button"
                  variant="outline"
                  key={key}
                  className={`theme-preset${settings.theme.palette === key ? " is-selected" : ""}`}
                  aria-pressed={settings.theme.palette === key}
                  onClick={() => {
                    setThemeSaveMessage("");
                    setSettings((current) => ({
                      ...current,
                      theme: {
                        ...current.theme,
                        palette: key as keyof typeof themePresets,
                        colors: preset.colors,
                      },
                    }));
                  }}
                >
                  <span
                    className="theme-swatch"
                    style={{
                      background: `linear-gradient(125deg, ${preset.colors.backgroundA}, ${preset.colors.backgroundB}, ${preset.colors.backgroundC})`,
                    }}
                  />
                  <span>{preset.label}</span>
                </Button>
              ))}
            </div>
            <div className="wallpaper-setting">
              <span id="wallpaper-setting-label">Wallpaper style</span>
              <Select
                value={settings.theme.wallpaper}
                onValueChange={(wallpaper) => {
                  setThemeSaveMessage("");
                  setSettings((current) => ({
                    ...current,
                    theme: { ...current.theme, wallpaper: wallpaper as ThemeSettings["wallpaper"] },
                  }));
                }}
              >
                <SelectTrigger aria-labelledby="wallpaper-setting-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={settingsDialogElement}>
                  {wallpaperPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>{preset.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="theme-colors">
              {([
                ["backgroundA", "Background 1"],
                ["backgroundB", "Background 2"],
                ["backgroundC", "Background 3"],
                ["accent", "Accent"],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <Input
                    type="color"
                    value={settings.theme.colors[key]}
                    onChange={(event) => {
                      setThemeSaveMessage("");
                      setSettings((current) => ({
                        ...current,
                        theme: {
                          ...current.theme,
                          palette: "custom",
                          colors: { ...current.theme.colors, [key]: event.target.value },
                        },
                      }));
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="theme-motion">
              <div className="motion-toggle">
                <Switch
                  id="theme-motion-toggle"
                  aria-label="Animated background"
                  checked={settings.theme.animated}
                  onCheckedChange={(checked) => {
                    setThemeSaveMessage("");
                    setSettings((current) => ({
                      ...current,
                      theme: { ...current.theme, animated: checked },
                    }));
                  }}
                />
                <label htmlFor="theme-motion-toggle">Animated background</label>
              </div>
              <div className="motion-speed">
                <span id="theme-motion-speed-label">Motion speed</span>
                <Select
                  value={settings.theme.speed}
                  onValueChange={(speed) => {
                    setThemeSaveMessage("");
                    setSettings((current) => ({
                      ...current,
                      theme: {
                        ...current.theme,
                        speed: speed as ThemeSettings["speed"],
                      },
                    }));
                  }}
                >
                  <SelectTrigger aria-labelledby="theme-motion-speed-label" disabled={!settings.theme.animated}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent portalContainer={settingsDialogElement}>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="theme-save-row">
              <span role="status">{themeSaveMessage}</span>
              <Button type="button" onClick={() => void saveTheme()} disabled={savingTheme}>
                {savingTheme ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </section>
          <section
            className="settings-panel display-settings"
            id="settings-panel-display"
            role="tabpanel"
            aria-labelledby="settings-tab-display"
            hidden={activeSettingsTab !== "display"}
          >
            <h3>Display</h3>
            <label className="display-setting">
              <span>Home title</span>
              <Input
                type="text"
                maxLength={32}
                value={settings.theme.brandTitle}
                onChange={(event) => {
                  setThemeSaveMessage("");
                  setSettings((current) => ({
                    ...current,
                    theme: { ...current.theme, brandTitle: event.target.value },
                  }));
                }}
              />
            </label>
            <div className="display-setting">
              <span id="topbar-style-label">Top bar style</span>
              <Select
                value={settings.theme.topbarStyle}
                onValueChange={(topbarStyle) => {
                  setThemeSaveMessage("");
                  setSettings((current) => ({
                    ...current,
                    theme: {
                      ...current.theme,
                      topbarStyle: topbarStyle as ThemeSettings["topbarStyle"],
                    },
                  }));
                }}
              >
                <SelectTrigger aria-labelledby="topbar-style-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent portalContainer={settingsDialogElement}>
                  <SelectItem value="glass">Glass</SelectItem>
                  <SelectItem value="clear">Clear glass</SelectItem>
                  <SelectItem value="tinted">Tinted glass</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="display-scale">
              <div className="display-scale-heading">
                <span id="font-scale-label">Text size</span>
                <strong>{Math.round(settings.theme.fontScale * 100)}%</strong>
              </div>
              <Slider
                aria-labelledby="font-scale-label"
                min={80}
                max={140}
                step={5}
                value={[Math.round(settings.theme.fontScale * 100)]}
                onValueChange={([value]) => {
                  setThemeSaveMessage("");
                  setSettings((current) => ({
                    ...current,
                    theme: { ...current.theme, fontScale: value / 100 },
                  }));
                }}
              />
            </div>
            <div className="display-scale">
              <div className="display-scale-heading">
                <span id="ui-scale-label">UI scale</span>
                <strong>{Math.round(settings.theme.uiScale * 100)}%</strong>
              </div>
              <Slider
                aria-labelledby="ui-scale-label"
                min={80}
                max={120}
                step={5}
                value={[Math.round(settings.theme.uiScale * 100)]}
                onValueChange={([value]) => {
                  setThemeSaveMessage("");
                  setSettings((current) => ({
                    ...current,
                    theme: { ...current.theme, uiScale: value / 100 },
                  }));
                }}
              />
            </div>
            <div className="theme-save-row">
              <span role="status">{themeSaveMessage}</span>
              <Button type="button" onClick={() => void saveTheme()} disabled={savingTheme}>
                {savingTheme ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </section>
          <section
            className="settings-panel glass-settings"
            id="settings-panel-glass"
            role="tabpanel"
            aria-labelledby="settings-tab-glass"
            hidden={activeSettingsTab !== "glass"}
          >
            <h3>Glass effects</h3>
            <p className="settings-description">Adjust the widgets’ surface and moving highlights.</p>
            <div className="display-scale">
              <div className="display-scale-heading">
                <span id="glass-transparency-label">Widget transparency</span>
                <strong>{settings.theme.glassTransparency}%</strong>
              </div>
              <Slider
                aria-labelledby="glass-transparency-label"
                min={0}
                max={100}
                step={1}
                value={[settings.theme.glassTransparency]}
                onValueChange={([value]) => {
                  setThemeSaveMessage("");
                  setSettings((current) => ({
                    ...current,
                    theme: { ...current.theme, glassTransparency: value },
                  }));
                }}
              />
              <p className="settings-hint">Higher values let more of the wallpaper show through.</p>
            </div>
            <div className="display-scale">
              <div className="display-scale-heading">
                <span id="glass-reflectivity-label">Widget reflectivity</span>
                <strong>{settings.theme.glassReflectivity}%</strong>
              </div>
              <Slider
                aria-labelledby="glass-reflectivity-label"
                min={0}
                max={100}
                step={1}
                value={[settings.theme.glassReflectivity]}
                onValueChange={([value]) => {
                  setThemeSaveMessage("");
                  setSettings((current) => ({
                    ...current,
                    theme: { ...current.theme, glassReflectivity: value },
                  }));
                }}
              />
              <p className="settings-hint">Controls the intensity of the animated edge highlights.</p>
            </div>
            <div className="theme-save-row">
              <span role="status">{themeSaveMessage}</span>
              <Button type="button" onClick={() => void saveTheme()} disabled={savingTheme}>
                {savingTheme ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </section>
        </div>
      </dialog>
    </main>
    </LiquidGlassProvider>
  );
}

function WidgetBody({
  widget,
  entity,
  pending,
  connected,
  onAction,
  editing,
}: {
  widget: DashboardWidget;
  entity: PublicEntity | undefined;
  pending: boolean;
  connected: boolean;
  onAction: (action: string, value?: number | string) => void;
  editing: boolean;
}) {
  if (widget.type === "clock") {
    return <LocalClockCard title={widget.title ?? "Local time"} />;
  }

  if (!entity) {
    return (
      <div className="unavailable-widget">
        <CircleAlert size={20} />
        <div><strong>{widget.title ?? "Entity unavailable"}</strong></div>
        {editing && <span className="unavailable-label">Unavailable</span>}
      </div>
    );
  }

  const title = widget.title ?? entity.name;
  const unit = entity.attributes.unit_of_measurement ?? "";
  const isOn = entity.state === "on";
  const pendingControl = pending ? <LoaderCircle className="spin" size={16} /> : null;

  if (widget.type === "sensor") {
    if (widget.showChart) {
      return <SensorChartCard entity={entity} title={title} compact />;
    }

    return (
      <div className="sensor-content">
        <div className="widget-topline">
          <span className="widget-icon sensor-icon"><Activity size={19} /></span>
          <span className="sensor-caption">{entity.attributes.device_class ?? "SENSOR"}</span>
          {pendingControl}
        </div>
        <p className="widget-title">{title}</p>
        <div className="sensor-value">{shortValue(entity.state)}<span>{unit}</span></div>
        <p className="widget-footnote">Updated {new Date(entity.lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
      </div>
    );
  }

  if (widget.type === "weather") {
    return <WeatherCard entity={entity} title={title} />;
  }

  if (widget.type === "calendar") {
    return <CalendarCard entity={entity} title={title} />;
  }

  if (widget.type === "chart") {
    return <SensorChartCard entity={entity} title={title} />;
  }

  if (widget.type === "climate") {
    const temperature = entity.attributes.temperature;
    const current = entity.attributes.current_temperature;
    const modes = Array.isArray(entity.attributes.hvac_modes)
      ? entity.attributes.hvac_modes.filter((mode): mode is string => typeof mode === "string")
      : [];
    return (
      <div className="climate-content">
        <div className="widget-topline">
          <span className="widget-icon climate-icon"><Thermometer size={19} /></span>
          <Badge className="device-state">{String(entity.attributes.hvac_mode ?? entity.state)}</Badge>
          {pendingControl}
        </div>
        <p className="widget-title">{title}</p>
        <div className="climate-current">
          <span className="climate-temp">{typeof current === "number" ? shortValue(String(current)) : "--"}°</span>
          <span className="climate-label">Current</span>
        </div>
        <div className="climate-controls">
          <Button type="button" variant="outline" className="round-control" aria-label="Decrease target temperature" disabled={editing || pending || !connected || typeof temperature !== "number"} onClick={() => onAction("temperature", Number(temperature) - 0.5)}>−</Button>
          <span className="target-temp">{typeof temperature === "number" ? `${shortValue(String(temperature))}°` : "—"}</span>
          <Button type="button" variant="outline" className="round-control" aria-label="Increase target temperature" disabled={editing || pending || !connected || typeof temperature !== "number"} onClick={() => onAction("temperature", Number(temperature) + 0.5)}>+</Button>
          {modes.length > 0 && (
            <Select
              value={String(entity.attributes.hvac_mode ?? modes[0] ?? "") || undefined}
              onValueChange={(mode) => onAction("hvac_mode", mode)}
            >
              <SelectTrigger
                className="mode-select"
                aria-label={`${title} mode`}
                disabled={editing || pending || !connected}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modes.map((mode) => <SelectItem value={mode} key={mode}>{mode}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
    );
  }

  if (widget.type === "media_player") {
    const volume = typeof entity.attributes.volume_level === "number" ? entity.attributes.volume_level : 0;
    const playing = entity.state === "playing";
    return (
      <div className="media-content">
        <div className="widget-topline">
          <span className="widget-icon media-icon"><Tv size={19} /></span>
          <span className="device-state">{entity.state.replaceAll("_", " ")}</span>
          {pendingControl}
        </div>
        <p className="widget-title">{title}</p>
        <div className="media-track">
          <span className="media-art"><Music2 size={21} /></span>
          <div><strong>{String(entity.attributes.media_title ?? "Media player")}</strong><span>{String(entity.attributes.media_artist ?? entity.name)}</span></div>
        </div>
        <div className="media-controls">
          <Button type="button" className="play-control" aria-label={playing ? "Pause media" : "Play media"} disabled={editing || pending || !connected} onClick={() => onAction("play_pause")}>
            {pendingControl ?? (playing ? <Pause size={19} /> : <Play size={19} />)}
          </Button>
          <div className="volume-control">
            <Volume2 size={17} />
            <Slider
              className="glass-slider volume-slider"
              key={`volume-${volume}`}
              aria-label={`${title} volume`}
              min={0}
              max={100}
              step={5}
              defaultValue={[Math.round(volume * 100)]}
              disabled={editing || pending || !connected}
              onValueCommit={([value]) => onAction("volume", value / 100)}
            />
          </div>
        </div>
      </div>
    );
  }

  const light = widget.type === "light";
  const brightness = typeof entity.attributes.brightness === "number"
    ? Math.round((entity.attributes.brightness / 255) * 100)
    : 0;
  const supportsBrightness =
    typeof entity.attributes.brightness === "number" ||
    (typeof entity.attributes.supported_features === "number" &&
      (entity.attributes.supported_features & 1) === 1);
  return (
    <div className="toggle-content">
      <div className="widget-topline">
        <span className={`widget-icon ${light ? "light-icon" : "switch-icon"}`}>
          {light ? <Lightbulb size={20} /> : <Zap size={19} />}
        </span>
        <span className={`state-dot${isOn ? " is-on" : ""}`} aria-label={isOn ? "On" : "Off"} />
        {pendingControl}
      </div>
      <p className="widget-title">{title}</p>
      <div className="toggle-main">
        <span className={`large-state${isOn ? " is-on" : ""}`}>{isOn ? "On" : "Off"}</span>
        <Switch
          checked={isOn}
          aria-label={`${isOn ? "Turn off" : "Turn on"} ${title}`}
          disabled={editing || pending || !connected}
          onCheckedChange={() => onAction("toggle")}
          className="toggle-switch"
        />
      </div>
      {light && supportsBrightness && (
        <label className="brightness-control">
          <span><Lightbulb size={14} /> Brightness</span>
          <span className="brightness-value">{brightness}%</span>
          <Slider
            className="glass-slider brightness-slider"
            key={`brightness-${entity.attributes.brightness ?? 255}`}
            min={1}
            max={255}
            defaultValue={[typeof entity.attributes.brightness === "number" ? entity.attributes.brightness : 255]}
            aria-label={`${title} brightness`}
            disabled={editing || pending || !connected || !isOn}
            onValueCommit={([value]) => onAction("brightness", value)}
          />
        </label>
      )}
    </div>
  );
}
