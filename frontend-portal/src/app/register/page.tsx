import type { Metadata } from 'next';

import { AuthScreen } from '@/features/auth/auth-screen';

export const metadata: Metadata = {
  title: '注册',
  robots: { index: false, follow: false },
};

export interface RegisterPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const rawNext = params['next'];
  const nextPath = Array.isArray(rawNext) ? rawNext[0] : rawNext;

  return <AuthScreen mode="register" nextPath={nextPath} />;
}
