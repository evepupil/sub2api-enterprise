import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/** 带语言前缀的站内导航：链接、跳转和当前路径都自动处理 /en 前缀。 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
