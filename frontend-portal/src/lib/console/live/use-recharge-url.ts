'use client';

import { useEffect, useState } from 'react';

import { fetchAuthSettings } from '@/lib/auth/register-client';

/**
 * 后台填的充值地址（卡网店铺，见 AuthSettings.rechargeUrl；官网服务器缓存 30 秒）。
 * 还没读到、读不到或没填时为 null：账单页的「充值」「购买兑换码」都不显示。
 */
export function useRechargeUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetchAuthSettings().then((settings) => {
      if (active) setUrl(settings?.rechargeUrl ? settings.rechargeUrl : null);
    });
    return () => {
      active = false;
    };
  }, []);
  return url;
}
