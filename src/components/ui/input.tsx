import * as React from "react";
import { cn } from "@/lib/utils";
import { liquidProps, resolveVariant, type LiquidProps } from "@/lib/liquid-glass/material";

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & LiquidProps & { variant?: "liquid" | "default" }
>(({ className, type, variant, material, tint, glass, webgl, style, ...props }, ref) => {
  const resolved = resolveVariant<"liquid" | "default">(variant, material);
  const base =
    "file:text-foreground placeholder:text-muted-foreground flex w-full min-w-0 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";
  const own =
    resolved.variant === "liquid"
      ? liquidProps(
          { role: "control", material: resolved.material, tint, glass, webgl: webgl ?? false },
          { className: cn(base, "h-11 rounded-xl px-3", className), style },
        )
      : {
          className: cn(base, "h-9 rounded-md border border-input bg-transparent px-3", className),
          style,
        };
  return <input ref={ref} type={type} data-slot="input" {...own} {...props} />;
});
Input.displayName = "Input";

export { Input };
