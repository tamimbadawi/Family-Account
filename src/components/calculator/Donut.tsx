'use client';

import * as React from 'react';

/** A small SVG donut, Family Account style (64% inner radius). Slices are fractions that add up to 1. */
export function Donut({
  slices,
  size = 132,
  children,
  label,
}: {
  slices: { value: number; color: string }[];
  size?: number;
  children?: React.ReactNode;
  label: string;
}) {
  const r = size / 2;
  const stroke = r * 0.36;
  const rr = r - stroke / 2;
  const c = 2 * Math.PI * rr;
  const offsets = slices.reduce<number[]>((acc, s, i) => [...acc, (acc[i] ?? 0) + Math.max(0, s.value) * c], [0]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={r} cy={r} r={rr} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const len = Math.max(0, s.value) * c;
          return (
            <circle
              key={i}
              cx={r}
              cy={r}
              r={rr}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-offsets[i]}
              className="transition-[stroke-dasharray] duration-500"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
