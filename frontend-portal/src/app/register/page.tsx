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
  const invitationCode =
    typeof params.invitation_code === 'string' && params.invitation_code.length <= 256
      ? params.invitation_code.trim()
      : undefined;

  return (
    <AuthScreen
      key={invitationCode ?? 'personal'}
      mode="register"
      nextPath={nextPath}
      invitationCode={invitationCode}
    />
  );
}
