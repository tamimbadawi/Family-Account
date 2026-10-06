"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40",
        "data-[size=default]:h-8 data-[size=default]:w-14 data-[size=sm]:h-6 data-[size=sm]:w-11",
        "data-[state=checked]:bg-accent data-[state=unchecked]:bg-line",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-card ring-0 transition-transform",
          "group-data-[size=default]/switch:size-7 group-data-[size=sm]/switch:size-5",
          "ltr:data-[state=checked]:translate-x-6 ltr:data-[state=unchecked]:translate-x-0",
          "rtl:data-[state=checked]:-translate-x-6 rtl:data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
