import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { liquidProps, resolveVariant, type LiquidProps } from "@/lib/liquid-glass/material";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        liquid: "text-foreground",
        default: "border border-transparent bg-primary text-primary-foreground shadow",
        secondary: "border border-transparent bg-secondary text-secondary-foreground",
        destructive: "border border-transparent bg-destructive text-destructive-foreground shadow",
        outline: "border text-foreground",
      },
    },
    defaultVariants: { variant: "liquid" },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;
export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, LiquidProps {
  variant?: BadgeVariant | null;
}

function Badge({ className, variant, material, tint, glass, webgl, style, ...props }: BadgeProps) {
  const resolved = resolveVariant<BadgeVariant>(variant ?? undefined, material);
  const glassProps =
    resolved.variant === "liquid"
      ? liquidProps({ role: "inline", material: resolved.material, tint, glass, webgl: webgl ?? false })
      : null;
  return (
    <div
      {...glassProps}
      className={cn(badgeVariants({ variant: resolved.variant }), glassProps?.className, className)}
      style={{ ...glassProps?.style, ...style }}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
