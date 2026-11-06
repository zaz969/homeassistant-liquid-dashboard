"use client";

import * as React from "react";
import {
  Card as BaseCard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hoverEffects, type HoverEffect } from "@/lib/hover-effects";

export interface CardProps extends React.ComponentProps<typeof BaseCard> {
  gradient?: boolean;
  animated?: boolean;
  hover?: HoverEffect;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, gradient = false, animated = false, hover = "none", children, ...props }, ref) => (
    <BaseCard
      ref={ref}
      className={cn(
        "relative overflow-hidden",
        gradient && "[--lg-tint:oklch(0.62_0.2_290)] [--lg-tint-amt:14%]",
        animated && "transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_18px_40px_-16px_var(--lg-drop)]",
        hoverEffects({ hover }),
        className,
      )}
      {...props}
    >
      {children}
    </BaseCard>
  ),
);
Card.displayName = "Card";

export {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
