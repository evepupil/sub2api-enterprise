import type { Metadata } from 'next';

import { AuthScreen } from '@/features/auth/auth-screen';

export const metadata: Metadata = {
  title: '登录',
  robots: { index: false, follow: false },
};

export interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** 只把原始 `next` 交给 AuthScreen；安全性由 safeReturnPath 在客户端校验。 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext = params['next'];
  const nextPath = Array.isArray(rawNext) ? rawNext[0] : rawNext;

  return <AuthScreen mode="login" nextPath={nextPath} />;
}
