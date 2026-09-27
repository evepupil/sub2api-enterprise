import { forwardOAuthCallback } from '@/lib/api/oauth-callback-proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  return forwardOAuthCallback(request, provider, {
    baseUrl: process.env.SUB2API_INTERNAL_URL,
    publicOrigin: process.env.PORTAL_PUBLIC_URL,
  });
}
