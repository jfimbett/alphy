// components/ui/card.tsx
"use client"

import * as React from "react"

// If you have a utility for merging class names, e.g. `clsx` or a custom `cn` helper, use it here.
// Otherwise, here's a quick fallback:
function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

// A generic Card container.
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-white text-black shadow-sm", 
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Card.displayName = "Card"

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardHeader({ className, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("border-b p-4", className)}
      {...props}
    />
  )
}

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function CardTitle({ className, ...props }: CardTitleProps) {
  return (
    <h3
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export function CardContent({ className, ...props }: CardContentProps) {
  return (
    <div
      className={cn("p-4", className)}
      {...props}
    />
  )
}
