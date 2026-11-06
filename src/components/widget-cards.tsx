"use client";

import { useEffect, useId, useState } from "react";
import { CalendarDays, ChartNoAxesCombined, Clock3, CloudSun, MapPin } from "lucide-react";
import type { CalendarEvent, PublicEntity } from "@/lib/home-assistant";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/glass/chart";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

type HistoryPoint = { state: number; time: string };

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function LocalClockCard({ title }: { title: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="clock-content">
      <div className="widget-topline">
        <span className="widget-icon clock-icon"><Clock3 size={19} /></span>
        <span className="sensor-caption">LOCAL TIME</span>
      </div>
      <p className="widget-title">{title}</p>
      <time className="clock-time">
        {now?.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) ?? "--:--"}
        <span>{now?.getSeconds().toString().padStart(2, "0") ?? "--"}</span>
      </time>
      <p className="clock-date">
        {now?.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) ?? "Loading date"}
      </p>
    </div>
  );
}

export function WeatherCard({ entity, title }: { entity: PublicEntity; title: string }) {
  const condition = String(entity.attributes.condition ?? entity.state).replaceAll("_", " ");
  const temperature = entity.attributes.temperature;
  const unit = String(entity.attributes.temperature_unit ?? entity.attributes.unit_of_measurement ?? "");
  const humidity = entity.attributes.humidity;
  const windSpeed = entity.attributes.wind_speed;

  return (
    <div className="weather-content">
      <div className="widget-topline">
        <span className="widget-icon weather-icon"><CloudSun size={20} /></span>
        <span className="device-state">{condition}</span>
      </div>
      <p className="widget-title">{title}</p>
      <div className="weather-current">
        <span>{typeof temperature === "number" ? Math.round(temperature) : "--"}°</span>
        <small>{unit}</small>
      </div>
      <div className="weather-measurements">
        {typeof humidity === "number" && <span>Humidity <strong>{Math.round(humidity)}%</strong></span>}
        {typeof windSpeed === "number" && (
          <span>Wind <strong>{windSpeed} {String(entity.attributes.wind_speed_unit ?? "")}</strong></span>
        )}
      </div>
      {typeof entity.attributes.wind_bearing === "number" && (
        <p className="weather-wind-direction">Wind direction {Math.round(entity.attributes.wind_bearing)}°</p>
      )}
    </div>
  );
}

export function CalendarCard({ entity, title }: { entity: PublicEntity; title: string }) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        const path = new URL("api/calendar", document.baseURI).pathname;
        const response = await fetch(`${path}?entity_id=${encodeURIComponent(entity.entityId)}`, {
          cache: "no-store",
        });
        const result = await response.json() as { events?: CalendarEvent[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load calendar events.");
        if (active) {
          const now = Date.now();
          const currentOrNext = (result.events ?? []).find((item) => Date.parse(item.end) >= now);
          setEvent(currentOrNext ?? null);
          setError("");
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load calendar events.");
        }
      }
    };

    void loadEvents();
    const timer = window.setInterval(() => void loadEvents(), 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [entity.entityId]);

  const startsAt = event ? formatTime(event.start) : null;
  const location = event?.location ?? "";
  const isInProgress = entity.state === "on";

  return (
    <div className="calendar-content">
      <div className="widget-topline">
        <span className="widget-icon calendar-icon"><CalendarDays size={19} /></span>
        <span className="sensor-caption">{isInProgress ? "IN PROGRESS" : "UPCOMING"}</span>
      </div>
      <p className="widget-title">{title}</p>
      <div className="calendar-event">
        <strong>{event?.summary ?? (error ? "Calendar unavailable" : "No upcoming event")}</strong>
        {startsAt && <span>{startsAt}</span>}
        {location && <span className="calendar-location"><MapPin size={13} />{location}</span>}
        {error && <span className="calendar-error" role="alert">{error}</span>}
      </div>
    </div>
  );
}

export function SensorChartCard({
  entity,
  title,
  compact = false,
}: {
  entity: PublicEntity;
  title: string;
  compact?: boolean;
}) {
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const gradientId = `sensor-chart-${useId().replaceAll(":", "")}`;

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      if (active) setLoading(true);
      try {
        const path = new URL("api/history", document.baseURI).pathname;
        const response = await fetch(`${path}?entity_id=${encodeURIComponent(entity.entityId)}`, {
          cache: "no-store",
        });
        const result = await response.json() as { points?: HistoryPoint[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load sensor history.");
        if (active) {
          setPoints(result.points ?? []);
          setError("");
          setLoading(false);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load sensor history.");
          setLoading(false);
        }
      }
    };

    void loadHistory();
    const timer = window.setInterval(() => void loadHistory(), 5 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [entity.entityId, retryCount]);

  const unit = String(entity.attributes.unit_of_measurement ?? "");
  const firstTime = points.length ? formatTime(points[0].time) : null;
  const lastTime = points.length ? formatTime(points[points.length - 1].time) : null;
  const chartConfig: ChartConfig = {
    state: { label: title, color: "var(--theme-accent)" },
  };

  return (
    <div className={`chart-content${compact ? " chart-compact" : ""}`}>
      <div className="widget-topline">
        <span className="widget-icon chart-icon"><ChartNoAxesCombined size={19} /></span>
        <span className="sensor-caption">LAST 24 HOURS</span>
      </div>
      <p className="widget-title">{title}</p>
      <div className="chart-current">
        <strong>{Number.isFinite(Number(entity.state)) ? `${Number(entity.state).toFixed(1)}${unit}` : entity.state}</strong>
        <span>{points.length ? `${points.length} readings` : "Waiting for history"}</span>
      </div>
      {points.length > 1 ? (
        <ChartContainer
          config={chartConfig}
          className="sensor-history-chart"
          style={{ aspectRatio: "auto" }}
          glow
          aria-label={`${title} sensor history over the last 24 hours`}
        >
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-state)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-state)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(220, 239, 252, 0.12)" strokeDasharray="3 5" />
            <XAxis
              dataKey="time"
              tickFormatter={(value: string) => new Date(value).toLocaleTimeString([], { hour: "numeric" })}
              tickLine={false}
              axisLine={false}
              minTickGap={32}
              tick={{ fill: "rgba(227, 239, 249, 0.62)", fontSize: 10 }}
            />
            <ChartTooltip content={<ChartTooltipContent variant="liquid" indicator="line" />} />
            <Area
              type="monotone"
              dataKey="state"
              stroke="var(--color-state)"
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      ) : (
        <div className="chart-empty" role={error ? "alert" : "status"}>
          <span>{error || (loading ? "Loading sensor history…" : "No numeric history is available yet.")}</span>
          {error && (
            <button
              type="button"
              className="chart-retry-button"
              onClick={() => setRetryCount((current) => current + 1)}
              disabled={loading}
            >
              Try again
            </button>
          )}
        </div>
      )}
      <div className="chart-range"><span>{firstTime ?? "24h ago"}</span><span>{lastTime ?? "Now"}</span></div>
    </div>
  );
}
