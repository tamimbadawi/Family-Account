'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Check, Download, Menu, MoreVertical, PlusSquare, Share, Sparkles } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const subscribeNever = () => () => {};

function getPlatformSnapshot(): 'ios' | 'android-chrome' | 'android-other' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'ios';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) {
    const isChrome = /chrome|crios/i.test(ua) && !/samsungbrowser|firefox|fxios/i.test(ua);
    return isChrome ? 'android-chrome' : 'android-other';
  }
  return 'ios';
}

function getServerPlatformSnapshot(): 'ios' | 'android-chrome' | 'android-other' {
  return 'ios';
}

export default function InstallPage() {
  const tInstall = useTranslations('install');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const platform = React.useSyncExternalStore(subscribeNever, getPlatformSnapshot, getServerPlatformSnapshot);

  const steps = React.useMemo(() => {
    if (platform === 'android-chrome') {
      return [
        {
          number: '1',
          text: tInstall('androidChromeStep1'),
          icon: <MoreVertical className="size-7" />,
          color: 'bg-accent-soft text-accent',
        },
        {
          number: '2',
          text: tInstall('androidChromeStep2'),
          icon: <Download className="size-7" />,
          color: 'bg-accent-soft text-accent',
        },
        {
          number: '3',
          text: tInstall('androidChromeStep3'),
          icon: <Sparkles className="size-7" />,
          color: 'bg-income/15 text-income',
        },
      ];
    }
    if (platform === 'android-other') {
      return [
        {
          number: '1',
          text: tInstall('androidOtherStep1'),
          icon: <Menu className="size-7" />,
          color: 'bg-accent-soft text-accent',
        },
        {
          number: '2',
          text: tInstall('androidOtherStep2'),
          icon: <Download className="size-7" />,
          color: 'bg-accent-soft text-accent',
        },
        {
          number: '3',
          text: tInstall('androidOtherStep3'),
          icon: <Sparkles className="size-7" />,
          color: 'bg-income/15 text-income',
        },
      ];
    }
    return [
      {
        number: '1',
        text: tInstall('step1'),
        icon: <Share className="size-7" />,
        color: 'bg-accent-soft text-accent',
      },
      {
        number: '2',
        text: tInstall('step2'),
        icon: <PlusSquare className="size-7" />,
        color: 'bg-accent-soft text-accent',
      },
      {
        number: '3',
        text: tInstall('step3'),
        icon: <Sparkles className="size-7" />,
        color: 'bg-income/15 text-income',
      },
    ];
  }, [platform, tInstall]);

  const note = platform === 'ios' ? tInstall('note') : tInstall('androidNote');

  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-between bg-canvas px-5 py-6 text-ink select-none">
      {/* Top Header */}
      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex size-11 items-center justify-center rounded-2xl bg-surface shadow-card text-ink hover:bg-surface-2 transition-colors rtl:rotate-180 cursor-pointer"
            aria-label={tCommon('back')}
          >
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="text-heading font-bold text-ink">
            {tInstall('title')}
          </h1>
        </div>

        {/* 3 Illustrated Step Cards */}
        <div className="mt-6 space-y-3.5">
          {steps.map((step) => (
            <Card
              key={step.number}
              className="flex flex-row items-center gap-4 bg-surface p-4 shadow-card rounded-card border-none"
            >
              <div
                className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${step.color} shadow-xs`}
              >
                {step.icon}
              </div>

              <div className="flex flex-1 items-center gap-3 min-w-0">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-bold tabular-nums text-ink-muted">
                  {step.number}
                </span>
                <p className="text-body font-semibold text-ink leading-snug">
                  {step.text}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Friendly explanation note */}
        <div className="mt-5 rounded-2xl bg-surface-2 p-4 text-center">
          <p className="text-caption text-ink-muted leading-relaxed">
            {note}
          </p>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="pt-6">
        <Button
          asChild
          className="h-14 w-full text-heading font-semibold text-accent-ink"
        >
          <Link href="/" className="text-accent-ink">
            <Check className="size-5" />
            <span>{tCommon('done')}</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
