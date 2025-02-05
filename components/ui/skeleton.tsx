// components/ui/skeleton.tsx

import * as React from "react"
import { cn } from "../../lib/utils" // or wherever your cn (classNames) helper is

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200", 
        className
      )}
      {...props}
    />
  )
}
