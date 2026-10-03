'use client';

import { ArrowRight, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { ANNOUNCEMENTS } from '@/lib/console/account';
import { cn } from '@/lib/utils';

const ROTATE_MS = 6000;

/**
 * 顶部公告条：深色底，多条公告每 6 秒轮换一次（系统要求减少动效时不自动轮换），
 * 右侧圆点可直接切换，关闭后本次访问不再显示。交互检查找 data-announcement。
 */
export function AnnouncementBar({ onClose }: { onClose: () => void }) {
  const t = useTranslations('console');
  const locale = useLocale() as AppLocale;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || ANNOUNCEMENTS.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % ANNOUNCEMENTS.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  const current = ANNOUNCEMENTS[index] ?? ANNOUNCEMENTS[0];
  if (!current) return null;

  return (
    <div
      data-announcement
      role="region"
      aria-label={t('announcement.label')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative flex h-10 shrink-0 items-center justify-center bg-primary px-12 text-primary-foreground"
    >
      <p className="flex min-w-0 items-center gap-2 text-sm" aria-live="polite">
        <span className="truncate">{current.text[locale]}</span>
        {current.href ? (
          <Link
            href={current.href}
            className="hidden shrink-0 items-center gap-1 font-medium underline underline-offset-4 sm:inline-flex"
          >
            {t('announcement.view')}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        ) : null}
      </p>
      <div className="absolute right-11 hidden items-center gap-1.5 md:flex">
        {ANNOUNCEMENTS.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={t('announcement.goto', { index: i + 1 })}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => setIndex(i)}
            className={cn(
              'size-1.5 rounded-full transition-colors',
              i === index ? 'bg-primary-foreground' : 'bg-primary-foreground/35',
            )}
          />
        ))}
      </div>
      <button
        type="button"
        data-announcement-close
        aria-label={t('announcement.close')}
        onClick={onClose}
        className="absolute right-3 rounded-md p-1 text-primary-foreground/70 transition-colors hover:text-primary-foreground"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
