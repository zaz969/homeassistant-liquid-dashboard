"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { liquidProps, resolveVariant, type LiquidProps } from "@/lib/liquid-glass/material";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & LiquidProps & {
    variant?: "liquid" | "default";
  }
>(({ className, children, variant, material, tint, glass, webgl, style, ...props }, ref) => {
  const resolved = resolveVariant<"liquid" | "default">(variant, material);
  const appearance =
    resolved.variant === "liquid"
      ? liquidProps(
          { role: "control", material: resolved.material, tint, glass, webgl: webgl ?? false },
          { className: cn("flex h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-sm", className), style },
        )
      : { className: cn("flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm", className), style };
  return (
    <SelectPrimitive.Trigger ref={ref} {...appearance} {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="size-4 opacity-60" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & LiquidProps & {
    variant?: "liquid" | "default";
    portalContainer?: HTMLElement | null;
  }
>(({ className, children, position = "popper", variant, material, tint, glass, webgl, style, portalContainer, ...props }, ref) => {
  const resolved = resolveVariant<"liquid" | "default">(variant, material);
  const glassProps =
    resolved.variant === "liquid"
      ? liquidProps({ role: "overlay", material: resolved.material, tint, glass, webgl: webgl ?? false })
      : null;
  return (
    <SelectPrimitive.Portal container={portalContainer}>
      <SelectPrimitive.Content
        ref={ref}
        {...glassProps}
        style={{ ...glassProps?.style, ...style }}
        className={cn(
          "z-50 max-h-80 min-w-[8rem] overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 text-slate-100 shadow-xl backdrop-blur-xl",
          className,
        )}
        position={position}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1"><ChevronUp className="size-4" /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1">
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1"><ChevronDown className="size-4" /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn("relative flex min-h-10 w-full cursor-default select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none focus:bg-white/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-3 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("px-3 py-1.5 text-xs font-semibold text-slate-400", className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectLabel };
