'use client';

import * as React from 'react';
import { Award, Coins, Landmark, PieChart, Scale, ShieldCheck, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import type { Fund, Offer } from '@/lib/market/types';
import { isFund } from '@/lib/calc/fund';
import { logoPath } from '@/lib/market/logos';
import { cn } from '@/lib/utils';

type Kind = { icon: LucideIcon; tint: string };

const FUND_KINDS: Record<string, Kind> = {
  equity: { icon: TrendingUp, tint: 'bg-kind-equity-soft text-kind-equity' },
  gold: { icon: Coins, tint: 'bg-kind-gold-soft text-kind-gold' },
  money_market: { icon: Wallet, tint: 'bg-accent-soft text-accent' },
  fixed_income: { icon: ShieldCheck, tint: 'bg-kind-bill-soft text-kind-bill' },
  balanced: { icon: Scale, tint: 'bg-kind-fund-soft text-kind-fund' },
  other: { icon: PieChart, tint: 'bg-kind-fund-soft text-kind-fund' },
};

export function kindOf(p: Offer | Fund): Kind {
  if (isFund(p)) return FUND_KINDS[p.fundType] ?? FUND_KINDS.other;
  return p.type === 'tbill' || p.type === 'tbond'
    ? { icon: Landmark, tint: 'bg-kind-bill-soft text-kind-bill' }
    : { icon: Award, tint: 'bg-kind-cert-soft text-kind-cert' };
}

/** Family Account style tinted circle: the bank's logo when we host one, else the kind's icon in its colour. */
export function KindIcon({ product, size = 'md', className }: { product: Offer | Fund; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const k = kindOf(product);
  const Icon = k.icon;
  const logo = isFund(product) ? logoPath(product.managerAr) : product.type === 'tbill' || product.type === 'tbond' ? null : logoPath(product.bankCode);
  const [broken, setBroken] = React.useState(false);
  const box = size === 'lg' ? 'size-14' : size === 'sm' ? 'size-9' : 'size-11';
  return (
    <span data-avatar aria-hidden className={cn('relative shrink-0 rounded-full flex items-center justify-center overflow-hidden', box, k.tint, className)}>
      {logo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" onError={() => setBroken(true)} className="size-full object-contain bg-white p-1.5" />
      ) : (
        <Icon className={size === 'lg' ? 'size-7' : size === 'sm' ? 'size-5' : 'size-6'} strokeWidth={1.75} />
      )}
    </span>
  );
}

/** A small tinted dot of the kind's colour (legends, mix lines). */
export function kindColorVar(p: Offer | Fund): string {
  if (isFund(p)) {
    return (
      {
        equity: 'var(--kind-equity)',
        gold: 'var(--kind-gold)',
        money_market: 'var(--accent)',
        fixed_income: 'var(--kind-bill)',
      }[p.fundType] ?? 'var(--kind-fund)'
    );
  }
  return p.type === 'tbill' || p.type === 'tbond' ? 'var(--kind-bill)' : 'var(--kind-cert)';
}
