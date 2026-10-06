'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

export interface NoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function NoteField({
  value,
  onChange,
  placeholder,
  className = '',
}: NoteFieldProps) {
  const t = useTranslations('entry');

  return (
    <div className={`w-full ${className}`}>
      <Input
        type="text"
        maxLength={500}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t('note')}
        className="h-14 rounded-2xl bg-surface-2 text-body"
      />
    </div>
  );
}
