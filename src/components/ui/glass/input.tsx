"use client";

import * as React from "react";
import { Input as BaseInput } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hoverEffects, type HoverEffect } from "@/lib/hover-effects";

export interface InputProps extends React.ComponentProps<typeof BaseInput> {
  icon?: React.ReactNode;
  error?: boolean;
  hover?: HoverEffect;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, error, hover = "none", ...props }, ref) => (
    <div className="relative">
      {icon && <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">{icon}</div>}
      <BaseInput
        ref={ref}
        className={cn(
          "relative overflow-hidden transition-all duration-200 focus-visible:scale-[1.01]",
          icon && "pl-10",
          error && "border-destructive focus-visible:ring-destructive",
          hoverEffects({ hover }),
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Input.displayName = "Input";
