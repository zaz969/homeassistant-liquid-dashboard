"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThemeSettings } from "@/lib/theme";
import { useLiquidBackdrop } from "@/components/ui/liquid/liquid-glass-provider";

type WallpaperId = ThemeSettings["wallpaper"];
type WallpaperStyle = {
  ribbonCount: number;
  thickness: number;
  amplitude: number;
  alpha: number;
  waveCount: number;
};

const wallpaperStyles: Record<WallpaperId, WallpaperStyle> = {
  ribbons: { ribbonCount: 4, thickness: 0.105, amplitude: 0.075, alpha: 0.36, waveCount: 2.2 },
  aurora: { ribbonCount: 3, thickness: 0.075, amplitude: 0.12, alpha: 0.25, waveCount: 1.55 },
  contours: { ribbonCount: 7, thickness: 0.004, amplitude: 0.035, alpha: 0.22, waveCount: 1.8 },
  drift: { ribbonCount: 3, thickness: 0.15, amplitude: 0.14, alpha: 0.32, waveCount: 1.2 },
};

function rgba(hex: string, alpha: number) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

interface WallpaperCanvasProps {
  wallpaper: WallpaperId;
  colors: ThemeSettings["colors"];
  animated: boolean;
  speed: ThemeSettings["speed"];
}

export default function WallpaperCanvas({
  wallpaper,
  colors,
  animated,
  speed,
}: WallpaperCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const attachCanvas = useCallback((element: HTMLCanvasElement | null) => {
    canvasRef.current = element;
    setCanvas(element);
  }, []);
  useLiquidBackdrop(canvas, { live: true, base: true });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    const surface = canvas;
    const drawingContext = context;

    const style = wallpaperStyles[wallpaper];
    const ribbonColors = [colors.accent, colors.backgroundB, colors.backgroundC, colors.accent];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cycleDuration = speed === "fast" ? 36 : speed === "medium" ? 60 : 96;
    let width = 0;
    let height = 0;
    let frameId = 0;
    let lastFrameTime = 0;
    let startTime = 0;
    let elapsedSeconds = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(elapsedSeconds);
    }

    function draw(elapsed: number) {
      const phase = (elapsed / cycleDuration) * Math.PI * 2;
      const background = drawingContext.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, colors.backgroundA);
      background.addColorStop(0.52, colors.backgroundB);
      background.addColorStop(1, colors.backgroundC);
      drawingContext.fillStyle = background;
      drawingContext.fillRect(0, 0, width, height);

      if (wallpaper === "aurora" && "createConicGradient" in drawingContext) {
        const conic = drawingContext.createConicGradient(
          phase * 0.22,
          width * (0.5 + 0.12 * Math.sin(phase)),
          height * (0.5 + 0.1 * Math.cos(phase)),
        );
        ribbonColors.forEach((color, index) => conic.addColorStop(index / ribbonColors.length, color));
        conic.addColorStop(1, ribbonColors[0]);
        drawingContext.globalAlpha = 0.22;
        drawingContext.filter = `blur(${Math.round(Math.min(width, height) * 0.045)}px)`;
        drawingContext.fillStyle = conic;
        drawingContext.fillRect(0, 0, width, height);
        drawingContext.filter = "none";
        drawingContext.globalAlpha = 1;
      }

      ribbonColors.slice(0, 3).forEach((color, index) => {
        const drift = phase * (index % 2 === 0 ? 1 : -0.75) + index * 2.2;
        const x = width * (0.5 + 0.3 * Math.sin(drift) + (pointerX - 0.5) * 0.045);
        const y = height * (0.45 + 0.32 * Math.cos(drift * 0.8) + (pointerY - 0.5) * 0.045);
        const radius = Math.max(width, height) * (0.42 + index * 0.06);
        const glow = drawingContext.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, rgba(color, 0.22));
        glow.addColorStop(1, rgba(color, 0));
        drawingContext.fillStyle = glow;
        drawingContext.fillRect(0, 0, width, height);
      });

      const points = Math.max(24, Math.ceil(width / 36));
      if (wallpaper === "contours") {
        for (let index = 0; index < style.ribbonCount; index += 1) {
          const color = ribbonColors[index % ribbonColors.length];
          drawingContext.beginPath();
          for (let point = 0; point <= points; point += 1) {
            const progress = point / points;
            const x = progress * width;
            const wave = Math.sin((progress + (pointerX - 0.5) * 0.08) * Math.PI * style.waveCount + phase * 0.5 + index * 0.42);
            const y = height * (0.12 + index * 0.13 + (pointerY - 0.5) * 0.04) + wave * height * style.amplitude;
            if (point === 0) drawingContext.moveTo(x, y);
            else drawingContext.lineTo(x, y);
          }
          drawingContext.strokeStyle = rgba(color, style.alpha);
          drawingContext.lineWidth = Math.max(1, height * style.thickness);
          drawingContext.stroke();
        }
        return;
      }

      for (let index = 0; index < style.ribbonCount; index += 1) {
        const color = ribbonColors[index % ribbonColors.length];
        const center = height * (0.19 + index * (0.62 / Math.max(style.ribbonCount - 1, 1)) + (pointerY - 0.5) * 0.04);
        const thickness = height * (style.thickness + (index % 3) * 0.012);
        const offset = Math.sin(phase * 0.72 + index * 1.6) * height * 0.045;
        const pathPoints: Array<[number, number]> = [];

        for (let point = 0; point <= points; point += 1) {
          const progress = point / points;
          const x = progress * width;
          const wave = Math.sin((progress + (pointerX - 0.5) * 0.08) * Math.PI * style.waveCount + phase * 0.68 + index * 1.25);
          const secondaryWave = Math.sin(progress * Math.PI * 4.1 - phase * 0.42 + index);
          const y = center + offset + wave * height * style.amplitude + secondaryWave * height * style.amplitude * 0.29;
          pathPoints.push([x, y]);
        }

        const ribbon = drawingContext.createLinearGradient(0, center - thickness, 0, center + thickness);
        ribbon.addColorStop(0, rgba(color, 0));
        ribbon.addColorStop(0.3, rgba(color, 0.09));
        ribbon.addColorStop(0.52, rgba(color, style.alpha));
        ribbon.addColorStop(0.76, rgba(color, style.alpha * 0.36));
        ribbon.addColorStop(1, rgba(color, 0));

        drawingContext.beginPath();
        pathPoints.forEach(([x, y], point) => {
          if (point === 0) drawingContext.moveTo(x, y);
          else drawingContext.lineTo(x, y);
        });
        for (let point = pathPoints.length - 1; point >= 0; point -= 1) {
          const [x, y] = pathPoints[point];
          const progress = point / points;
          const lowerWave = Math.sin(progress * Math.PI * style.waveCount + phase * 0.68 + index * 1.25);
          const lowerOffset = Math.sin(progress * Math.PI * 3.2 - phase * 0.54 + index * 1.7);
          drawingContext.lineTo(x, y + thickness + lowerWave * height * 0.012 + lowerOffset * height * 0.013);
        }
        drawingContext.closePath();
        drawingContext.fillStyle = ribbon;
        drawingContext.fill();

        drawingContext.beginPath();
        pathPoints.forEach(([x, y], point) => {
          if (point === 0) drawingContext.moveTo(x, y);
          else drawingContext.lineTo(x, y);
        });
        drawingContext.strokeStyle = rgba(color, style.alpha * 0.7);
        drawingContext.lineWidth = Math.max(1, height * 0.0015);
        drawingContext.stroke();
      }
    }

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      if (timestamp - lastFrameTime >= 33) {
        elapsedSeconds = (timestamp - startTime) / 1000;
        draw(elapsedSeconds);
        lastFrameTime = timestamp;
      }
      frameId = window.requestAnimationFrame(animate);
    }

    function updateMotion() {
      window.cancelAnimationFrame(frameId);
      if (animated && !reducedMotion.matches) {
        startTime = 0;
        lastFrameTime = 0;
        elapsedSeconds = 0;
        frameId = window.requestAnimationFrame(animate);
      } else {
        draw(elapsedSeconds);
      }
    }

    function updatePointer(event: PointerEvent) {
      pointerX = event.clientX / Math.max(window.innerWidth, 1);
      pointerY = event.clientY / Math.max(window.innerHeight, 1);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(document.documentElement);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    reducedMotion.addEventListener("change", updateMotion);
    resize();
    updateMotion();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", updatePointer);
      reducedMotion.removeEventListener("change", updateMotion);
    };
  }, [animated, colors, speed, wallpaper]);

  return (
    <canvas
      ref={attachCanvas}
      className="wallpaper-canvas"
      data-wallpaper={wallpaper}
      data-glass-backdrop=""
      aria-hidden="true"
    />
  );
}
