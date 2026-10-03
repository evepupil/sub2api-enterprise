import type { routing } from '@/i18n/routing';
import type { Messages } from '@/messages';

// 让 useTranslations / getTranslations 的命名空间与键名都有类型检查
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: Messages;
  }
}
