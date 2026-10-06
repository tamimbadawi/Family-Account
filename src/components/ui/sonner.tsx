"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group font-sans"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface group-[.toaster]:text-ink group-[.toaster]:border-line group-[.toaster]:shadow-card group-[.toaster]:rounded-card group-[.toaster]:p-4 group-[.toaster]:text-body",
          description: "group-[.toast]:text-ink-muted group-[.toast]:text-caption",
          actionButton:
            "group-[.toast]:bg-accent group-[.toast]:text-accent-ink group-[.toast]:rounded-xl group-[.toast]:h-10 group-[.toast]:px-4 group-[.toast]:font-semibold group-[.toast]:text-body",
          cancelButton:
            "group-[.toast]:bg-surface-2 group-[.toast]:text-ink group-[.toast]:rounded-xl group-[.toast]:h-10 group-[.toast]:px-4 group-[.toast]:text-body",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5 text-income" />,
        info: <InfoIcon className="size-5 text-accent" />,
        warning: <TriangleAlertIcon className="size-5 text-warning" />,
        error: <OctagonXIcon className="size-5 text-danger" />,
        loading: <Loader2Icon className="size-5 animate-spin text-ink-muted" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
