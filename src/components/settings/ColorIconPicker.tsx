'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { CategoryIcon } from '@/components/ui/category-icon';

export const PRESET_COLORS = [
  '#0F766E', // Teal
  '#15803D', // Green
  '#C2410C', // Orange
  '#BE123C', // Rose
  '#7C3AED', // Violet
  '#2563EB', // Blue
  '#D97706', // Amber
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#DB2777', // Pink
  '#059669', // Emerald
  '#475569', // Slate
];

export const CURATED_ICONS = [
  'house',
  'shopping-basket',
  'shopping-bag',
  'car',
  'fuel',
  'heart-pulse',
  'graduation-cap',
  'sparkles',
  'shirt',
  'smile',
  'receipt',
  'banknote',
  'building-2',
  'briefcase',
  'coins',
  'utensils',
  'wallet',
  'tag',
  'users',
  'baby',
  'gift',
  'smartphone',
  'zap',
  'droplet',
  'flame',
  'wifi',
  'bus',
  'train',
  'plane',
  'coffee',
  'pizza',
  'apple',
  'dumbbell',
  'film',
  'music',
  'tv',
  'book',
  'wrench',
  'hammer',
  'landmark',
];

export interface ColorIconPickerProps {
  selectedColor: string;
  selectedIcon: string;
  onSelectColor: (color: string) => void;
  onSelectIcon: (icon: string) => void;
}

export function ColorIconPicker({
  selectedColor,
  selectedIcon,
  onSelectColor,
  onSelectIcon,
}: ColorIconPickerProps) {
  const t = useTranslations('settings');
  return (
    <div className="space-y-6">
      {/* Colors Grid */}
      <div className="space-y-2">
        <span className="text-caption font-semibold text-ink-muted">
          {t('color')}
        </span>
        <div className="grid grid-cols-6 gap-3">
          {PRESET_COLORS.map((color) => {
            const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => onSelectColor(color)}
                style={{ backgroundColor: color }}
                className="flex size-12 items-center justify-center rounded-full shadow-sm transition-transform active:scale-95 cursor-pointer relative"
              >
                {isSelected && (
                  <Check className="size-5 text-white stroke-[3]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Icons Grid */}
      <div className="space-y-2">
        <span className="text-caption font-semibold text-ink-muted">
          {t('icon')}
        </span>
        <div className="grid grid-cols-5 gap-2.5 p-1">
          {CURATED_ICONS.map((iconName) => {
            const isSelected = selectedIcon.toLowerCase() === iconName.toLowerCase();
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => onSelectIcon(iconName)}
                className={`flex size-12 items-center justify-center rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-accent/15 text-accent ring-2 ring-accent'
                    : 'bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink'
                }`}
              >
                <CategoryIcon name={iconName} className="size-6" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
