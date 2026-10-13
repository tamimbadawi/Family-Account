import { Banknote, Building2, CreditCard, Wallet as WalletIcon } from 'lucide-react';
import type { WalletType } from '@/lib/data/types';

export function getWalletTypeIcon(type: WalletType) {
  switch (type) {
    case 'cash':
      return Banknote;
    case 'bank':
      return Building2;
    case 'card':
      return CreditCard;
    case 'wallet':
    default:
      return WalletIcon;
  }
}
