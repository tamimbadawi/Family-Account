import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-14 w-full rounded-2xl bg-surface-2 px-4 py-2 text-body text-ink placeholder:text-ink-muted transition-all outline-none",
        "focus-visible:ring-2 focus-visible:ring-accent",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:ring-2 aria-invalid:ring-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
