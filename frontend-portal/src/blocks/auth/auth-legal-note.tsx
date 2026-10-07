'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

const LINK_CLASS = 'underline underline-offset-4 hover:text-foreground';

const LINKS = {
  terms: (chunks: ReactNode) => (
    <Link href="/terms" target="_blank" className={LINK_CLASS}>
      {chunks}
    </Link>
  ),
  privacy: (chunks: ReactNode) => (
    <Link href="/privacy" target="_blank" className={LINK_CLASS}>
      {chunks}
    </Link>
  ),
};

/** 登录、注册、谷歌完成注册页底部的「同意服务条款和隐私政策」：条款在新标签页打开，填了一半的表单不丢 */
export function AuthLegalNote({ action }: { action: 'login' | 'register' }) {
  const t = useTranslations('auth');
  return (
    <p className="mt-8 text-center text-xs leading-5 text-subtle-foreground">
      {action === 'login' ? t.rich('login.terms', LINKS) : t.rich('register.terms', LINKS)}
    </p>
  );
}
