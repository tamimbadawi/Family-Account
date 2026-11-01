'use client';

export interface CurrencyToggleProps {
  currencies?: string[];
  value?: string;
  onChange?: (currency: string) => void;
  className?: string;
}

/**
 * Single currency mode: No currency toggle is ever displayed.
 */
export function CurrencyToggle() {
  return null;
}
