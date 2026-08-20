import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, variant = "default", ...props }, ref) => {
  const baseClasses = "rounded-lg border border-border/30 bg-card text-card-foreground shadow-sm transition-colors";

  const variantClasses = {
    default: baseClasses,
    glass: `bg-card/60 backdrop-blur-xl border-border/30 shadow-none`,
    elevated: `shadow-card-elevated`,
    premium: `bg-card/80 backdrop-blur-xl border-border/40 shadow-shadow-card`,
  };

  return (
    <div ref={ref} className={cn(baseClasses, variantClasses[variant], className)} {...props} />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, variant = "default", ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5", variant === "glass" ? "p-4" : "p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, variant = "default", ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", variant === "glass" ? "text-card-foreground" : void 0, className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, variant = "default", ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, variant = "default", ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, variant = "default", ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />,
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };