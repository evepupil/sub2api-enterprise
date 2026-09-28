import { forwardPortalRequest } from '@/lib/api/portal-proxy';
import { portalRequestOrigin } from '../../../../../config/development-origins.mjs';

export const dynamic = 'force-dynamic';

type PortalRouteContext = {
  params: Promise<{ path: string[] }>;
};

async function delegate(request: Request, context: PortalRouteContext): Promise<Response> {
  const { path } = await context.params;
  return forwardPortalRequest(request, path, {
    baseUrl: process.env.SUB2API_INTERNAL_URL,
    publicOrigin: portalRequestOrigin(request, {
      NODE_ENV: process.env.NODE_ENV,
      PORTAL_PUBLIC_URL: process.env.PORTAL_PUBLIC_URL,
      PORTAL_DEV_ORIGINS: process.env.PORTAL_DEV_ORIGINS,
    }),
  });
}

export async function GET(request: Request, context: PortalRouteContext): Promise<Response> {
  return delegate(request, context);
}

export async function POST(request: Request, context: PortalRouteContext): Promise<Response> {
  return delegate(request, context);
}

export async function PUT(request: Request, context: PortalRouteContext): Promise<Response> {
  return delegate(request, context);
}

export async function PATCH(request: Request, context: PortalRouteContext): Promise<Response> {
  return delegate(request, context);
}

export async function DELETE(request: Request, context: PortalRouteContext): Promise<Response> {
  return delegate(request, context);
}
