"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";
import { liquidProps, resolveVariant, type LiquidProps } from "@/lib/liquid-glass/material";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & LiquidProps & {
    variant?: "liquid" | "default";
  }
>(({ className, variant, material, tint, glass, webgl, ...props }, ref) => {
  const resolved = resolveVariant<"liquid" | "default">(variant, material);
  const rootClass =
    resolved.variant === "liquid"
      ? "group relative inline-flex h-8 w-[60px] shrink-0 cursor-pointer items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      : "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input";

  return (
    <SwitchPrimitives.Root
      ref={ref}
      className={cn(rootClass, className)}
      {...props}
    >
      {resolved.variant === "liquid" ? (
        <>
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-white/20 transition-colors group-data-[state=checked]:bg-green-500/45"
          />
          <SwitchPrimitives.Thumb
            {...liquidProps(
              { role: "knob", material: resolved.material, tint, glass, webgl: webgl ?? false },
              {
                className:
                  "pointer-events-none relative block h-7 w-9 rounded-full bg-white shadow-md transition-[translate] duration-[450ms] ease-[cubic-bezier(.34,1.56,.64,1)]",
              },
            )}
          />
        </>
      ) : (
        <SwitchPrimitives.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
      )}
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
