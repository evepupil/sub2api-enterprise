import { forwardOAuthCallback } from '@/lib/api/oauth-callback-proxy';
import { portalRequestOrigin } from '../../../../../../../../config/development-origins.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  return forwardOAuthCallback(request, provider, {
    baseUrl: process.env.SUB2API_INTERNAL_URL,
    publicOrigin: portalRequestOrigin(request, {
      NODE_ENV: process.env.NODE_ENV,
      PORTAL_PUBLIC_URL: process.env.PORTAL_PUBLIC_URL,
      PORTAL_DEV_ORIGINS: process.env.PORTAL_DEV_ORIGINS,
    }),
  });
}
