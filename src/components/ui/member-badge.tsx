'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useHouseholdMembers } from '@/lib/data/provider';
import { memberInitial, memberSlot } from '@/lib/members';
import { cn } from '@/lib/utils';

// Literal class names so Tailwind generates them (slot order = lib/members MEMBER_SLOTS).
const SLOT_CLASSES = [
  'bg-member-1-soft text-member-1',
  'bg-member-2-soft text-member-2',
  'bg-member-3-soft text-member-3',
  'bg-member-4-soft text-member-4',
] as const;

export interface MemberBadgeProps {
  createdBy: string | null | undefined;
  createdByName: string | null | undefined;
  updatedBy?: string | null;
  updatedByName?: string | null;
  className?: string;
}

/**
 * A small circle with the initial of the family member who added an entry, in that
 * member's colour. Hidden while the household has only one member (it would say nothing).
 */
export function MemberBadge({
  createdBy,
  createdByName,
  updatedBy,
  updatedByName,
  className,
}: MemberBadgeProps) {
  const t = useTranslations('entry');
  const members = useHouseholdMembers();
  if (members.length < 2 || !createdBy) return null;

  const slot = memberSlot(createdBy, members);
  const name = createdByName ?? members.find((m) => m.userId === createdBy)?.displayName ?? '';
  const changedBySomeoneElse = !!updatedBy && updatedBy !== createdBy && !!updatedByName;
  const label = changedBySomeoneElse
    ? `${t('addedBy', { name })} · ${t('changedBy', { name: updatedByName })}`
    : t('addedBy', { name });

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-caption font-semibold leading-none',
        slot === null ? 'bg-surface-2 text-ink-muted' : SLOT_CLASSES[slot],
        className
      )}
    >
      {memberInitial(name)}
    </span>
  );
}
