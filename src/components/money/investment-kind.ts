import {
  Coins,
  ScrollText,
  TrendingUp,
  Building2,
  Gem,
  type LucideIcon,
} from 'lucide-react';
import type { InvestmentKind } from '@/lib/data/types';

export interface InvestmentKindInfo {
  kind: InvestmentKind;
  icon: LucideIcon;
  messageKey: string;
}

export const INVESTMENT_KINDS: InvestmentKind[] = [
  'gold',
  'certificate',
  'stocks',
  'property',
  'other',
];

export const INVESTMENT_KIND_MAP: Record<
  InvestmentKind,
  { icon: LucideIcon; messageKey: string }
> = {
  gold: { icon: Coins, messageKey: 'kindGold' },
  certificate: { icon: ScrollText, messageKey: 'kindCertificate' },
  stocks: { icon: TrendingUp, messageKey: 'kindStocks' },
  property: { icon: Building2, messageKey: 'kindProperty' },
  other: { icon: Gem, messageKey: 'kindOther' },
};
