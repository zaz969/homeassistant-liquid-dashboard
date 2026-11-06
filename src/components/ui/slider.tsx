"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { liquidProps, resolveVariant, type LiquidProps } from "@/lib/liquid-glass/material";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & LiquidProps & {
    variant?: "liquid" | "default";
  }
>(({ className, variant, material, tint, glass, webgl, ...props }, ref) => {
  const resolved = resolveVariant<"liquid" | "default">(variant, material);
  const values = props.value ?? props.defaultValue ?? [0];
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex h-8 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-white/20">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: values.length }, (_, index) =>
        resolved.variant === "liquid" ? (
          <SliderPrimitive.Thumb
            key={index}
            {...liquidProps(
              { role: "knob", material: resolved.material, tint, glass, webgl: webgl ?? false },
              {
                className:
                  "block h-6 w-6 cursor-grab rounded-full border border-white/80 bg-white shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              },
            )}
          />
        ) : (
          <SliderPrimitive.Thumb
            key={index}
            className="block h-5 w-5 rounded-full border-2 border-primary bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          />
        ),
      )}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
