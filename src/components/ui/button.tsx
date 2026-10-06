import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl text-body font-semibold whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-ink hover:opacity-95 shadow-xs",
        destructive: "bg-danger text-white hover:opacity-95 shadow-xs",
        outline: "border border-line bg-surface text-ink hover:bg-surface-2",
        secondary: "bg-surface-2 text-ink hover:bg-surface-2/80",
        ghost: "hover:bg-surface-2 text-ink",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-14 px-6 text-body",
        sm: "h-10 px-4 text-caption rounded-xl font-medium",
        lg: "h-16 px-8 text-heading rounded-2xl font-semibold",
        icon: "size-12 rounded-2xl",
        "icon-sm": "size-10 rounded-xl",
        "icon-lg": "size-14 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
