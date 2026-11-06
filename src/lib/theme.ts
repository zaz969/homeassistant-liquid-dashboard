import { z } from "zod";

export const themePresets = {
  sonoma: {
    label: "Sonoma",
    colors: { backgroundA: "#56324e", backgroundB: "#dc8b55", backgroundC: "#5648a2", accent: "#8fd8ed" },
  },
  aurora: {
    label: "Aurora",
    colors: { backgroundA: "#063b4b", backgroundB: "#176fc5", backgroundC: "#6d297a", accent: "#79e2d0" },
  },
  tahoe: {
    label: "Tahoe",
    colors: { backgroundA: "#173b82", backgroundB: "#2476ce", backgroundC: "#76c6e8", accent: "#9bdcf5" },
  },
  graphite: {
    label: "Graphite",
    colors: { backgroundA: "#121923", backgroundB: "#303947", backgroundC: "#161d29", accent: "#a8c3d8" },
  },
} as const;

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const wallpaperPresets = [
  { id: "ribbons", label: "Flowing ribbons" },
  { id: "aurora", label: "Aurora glow" },
  { id: "contours", label: "Contour waves" },
  { id: "drift", label: "Liquid drift" },
] as const;
const wallpaperSchema = z.enum(["ribbons", "aurora", "contours", "drift"]);
type WallpaperStyle = z.infer<typeof wallpaperSchema>;

export const themeSchema = z.object({
  version: z.literal(1),
  palette: z.enum(["sonoma", "aurora", "tahoe", "graphite", "custom"]),
  wallpaper: wallpaperSchema,
  brandTitle: z.string().trim().min(1).max(32),
  topbarStyle: z.enum(["glass", "clear", "tinted", "minimal"]),
  fontScale: z.number().min(0.8).max(1.4),
  uiScale: z.number().min(0.8).max(1.2),
  glassTransparency: z.number().int().min(0).max(100),
  glassReflectivity: z.number().int().min(0).max(100),
  colors: z.object({
    backgroundA: colorSchema,
    backgroundB: colorSchema,
    backgroundC: colorSchema,
    accent: colorSchema,
  }).strict(),
  animated: z.boolean(),
  speed: z.enum(["slow", "medium", "fast"]),
}).strict();

export type ThemeSettings = z.infer<typeof themeSchema>;

export const defaultTheme: ThemeSettings = {
  version: 1,
  palette: "graphite",
  wallpaper: "contours",
  brandTitle: "At home",
  topbarStyle: "glass",
  fontScale: 1,
  uiScale: 1,
  glassTransparency: 90,
  glassReflectivity: 72,
  colors: themePresets.graphite.colors,
  animated: true,
  speed: "slow",
};

export function normalizeTheme(value: unknown): ThemeSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return themeSchema.parse(value);
  }
  const legacy = value as Record<string, unknown>;
  const wallpaper = legacy.wallpaper ?? legacy.palette;
  const migratedWallpaper: Record<string, WallpaperStyle> = {
    sonoma: "ribbons",
    aurora: "aurora",
    tahoe: "drift",
    graphite: "contours",
    custom: "ribbons",
  };
  return themeSchema.parse({
    ...legacy,
    wallpaper: typeof wallpaper === "string" ? migratedWallpaper[wallpaper] ?? wallpaper : wallpaper,
    brandTitle: legacy.brandTitle ?? defaultTheme.brandTitle,
    topbarStyle: legacy.topbarStyle ?? defaultTheme.topbarStyle,
    fontScale: legacy.fontScale ?? defaultTheme.fontScale,
    uiScale: legacy.uiScale ?? defaultTheme.uiScale,
    glassTransparency: legacy.glassTransparency ?? defaultTheme.glassTransparency,
    glassReflectivity: legacy.glassReflectivity ?? defaultTheme.glassReflectivity,
  });
}
