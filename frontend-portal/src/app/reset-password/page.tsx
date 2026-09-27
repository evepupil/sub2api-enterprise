import type { Metadata } from 'next';

import { AuthScreen } from '@/features/auth/auth-screen';

export const metadata: Metadata = {
  title: '重置密码',
  robots: { index: false, follow: false },
};

export interface ResetPasswordPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** 恢复链接带来的 email 与 token 原样透传；缺失由 AuthScreen 显示链接无效。 */
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const rawEmail = params['email'];
  const rawToken = params['token'];
  const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  return <AuthScreen mode="reset-password" email={email} token={token} />;
}
