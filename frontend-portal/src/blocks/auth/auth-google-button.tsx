'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/**
 * 「或使用以下方式」分隔线 + 谷歌按钮，登录、注册页共用；后台开了谷歌登录才显示（由调用方判断）。
 * 点了先交给调用方准备好要跳去的地址（注册页会先存下已填的内容），再整页跳转；跳转前按钮转圈，防止连点。
 */
export function AuthGoogleButton({
  label,
  startUrl,
  dataAttribute,
}: {
  label: string;
  /** 点击时才算地址（注册页要带上当时填的邀请码、组织名称等） */
  startUrl: () => string;
  dataAttribute: 'data-google-login' | 'data-google-register';
}) {
  const t = useTranslations('auth');
  const [leaving, setLeaving] = useState(false);

  // 从谷歌按浏览器「返回」回来时页面可能是缓存里恢复的，按钮还在转圈：恢复成可点
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setLeaving(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  return (
    <>
      <div className="mt-6 flex items-center gap-3 text-xs text-subtle-foreground">
        <span aria-hidden className="h-px flex-1 bg-border" />
        {t('divider')}
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="secondary"
        block
        className="mt-6"
        loading={leaving}
        onClick={() => {
          setLeaving(true);
          window.location.assign(startUrl());
        }}
        {...{ [dataAttribute]: true }}
      >
        {leaving ? null : (
          <img
            src="/brands/google.svg"
            alt=""
            aria-hidden
            width={16}
            height={16}
            decoding="async"
            className="size-4"
          />
        )}
        {label}
      </Button>
    </>
  );
}

export default AuthGoogleButton;
