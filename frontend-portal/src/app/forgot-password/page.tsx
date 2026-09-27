import type { Metadata } from 'next';

import { AuthScreen } from '@/features/auth/auth-screen';

export const metadata: Metadata = {
  title: '找回密码',
  robots: { index: false, follow: false },
};

export interface ForgotPasswordPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/** email 只作为输入预填，提交仍由服务端校验，不据此判断账号是否存在。 */
export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const rawEmail = params['email'];
  const email = Array.isArray(rawEmail) ? rawEmail[0] : rawEmail;

  return <AuthScreen mode="forgot-password" email={email} />;
}
