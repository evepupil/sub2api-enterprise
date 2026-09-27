import { OAuthCallback } from '@/features/auth/oauth-callback';

/** Backend OAuth providers default to this callback path. */
export default function OAuthCallbackAliasPage() {
  return <OAuthCallback />;
}
