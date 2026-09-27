import { forwardPortalRequest } from '@/lib/api/portal-proxy';

export const dynamic = 'force-dynamic';

type PortalRouteContext = {
  params: Promise<{ path: string[] }>;
};

async function delegate(request: Request, context: PortalRouteContext): Promise<Response> {
  const { path } = await context.params;
  return forwardPortalRequest(request, path, {
    baseUrl: process.env.SUB2API_INTERNAL_URL,
    publicOrigin: process.env.PORTAL_PUBLIC_URL,
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
