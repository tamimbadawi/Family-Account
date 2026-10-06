import * as React from 'react';
import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Building2,
  Car,
  CircleDot,
  Coins,
  GraduationCap,
  HeartPulse,
  House,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smile,
  Sparkles,
  Tag,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  house: House,
  'shopping-basket': ShoppingBasket,
  car: Car,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  sparkles: Sparkles,
  shirt: Shirt,
  smile: Smile,
  receipt: Receipt,
  banknote: Banknote,
  'building-2': Building2,
  'arrow-left-right': ArrowLeftRight,
  briefcase: Briefcase,
  coins: Coins,
  'shopping-bag': ShoppingBag,
  utensils: Utensils,
  wallet: Wallet,
  tag: Tag,
  users: Users,
};

export interface CategoryIconProps extends Omit<React.ComponentProps<'svg'>, 'name'> {
  name?: string | null;
  className?: string;
}

export function CategoryIcon({ name, className = 'size-6', ...props }: CategoryIconProps) {
  const IconComponent = (name && ICON_MAP[name.toLowerCase()]) || CircleDot;
  return <IconComponent className={className} {...props} />;
}
