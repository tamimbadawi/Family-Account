import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-hero",
        "text-display",
        "text-title",
        "text-heading",
        "text-body",
        "text-caption",
      ],
      "text-color": [
        "text-canvas",
        "text-surface",
        "text-surface-2",
        "text-line",
        "text-ink",
        "text-ink-muted",
        "text-ink-faint",
        "text-accent",
        "text-accent-ink",
        "text-accent-soft",
        "text-income",
        "text-income-soft",
        "text-expense",
        "text-expense-soft",
        "text-transfer",
        "text-warning",
        "text-danger",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}

