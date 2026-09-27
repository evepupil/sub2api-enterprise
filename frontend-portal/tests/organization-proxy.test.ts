/**
 * M4 组织代理白名单测试（Vitest，Node 环境）。
 *
 * 契约来源：任务书「代理仅放行组织已列方法/正整数 path」，
 * 实现位于 src/lib/api/portal-proxy.ts。
 *
 * 只断言代理层的转发边界，不假装在 mock 里校验服务端权限：
 * - 放行：组织成员 / 邀请 / 配额请求 / 默认配额与策略的组织方法。
 * - 拒绝：未列出的方法、任意 organization/{id} 之类的组织管理路径、
 *   admin 路径、非正整数 path、以及任何编码/穿越尝试。
 * - 组织业务的最终授权由后端完成，这里只证明代理不会把非法请求转发出去。
 */
import { describe, expect, it } from 'vitest';

import { forwardPortalRequest, isAllowedPortalRequest } from '../src/lib/api/portal-proxy';

const BASE_URL = 'https://internal.example.test';

type FetchCall = {
  input: string;
  init: RequestInit;
};

type FetchHandler = (input: string, init: RequestInit) => Response | Promise<Response>;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function makeFetcher(handler: FetchHandler = () => jsonResponse({ ok: true })): {
  fetcher: typeof fetch;
  calls: FetchCall[];
} {
  const calls: FetchCall[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const normalizedInit = init ?? {};
    calls.push({ input: String(input), init: normalizedInit });
    return handler(String(input), normalizedInit);
  }) as typeof fetch;
  return { fetcher, calls };
}

function makeRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://portal.example.test${path}`, init);
}

// ===========================================================================
// 白名单：放行组织已列方法 / 正整数 path
// ===========================================================================

describe('组织代理放行已列方法', () => {
  it.each([
    ['GET', ['organization', 'members']],
    ['GET', ['organization', 'invitations']],
    ['GET', ['organization', 'default-quota']],
    ['GET', ['organization', 'quota-request-policy']],
    ['GET', ['organization', 'quota-requests']],
    ['GET', ['usage', 'organization', 'members']],
    ['PUT', ['organization', 'default-quota']],
    ['PUT', ['organization', 'quota-request-policy']],
    ['PUT', ['organization', 'members', '12', 'status']],
    ['PUT', ['organization', 'members', '12', 'display-name']],
    ['PUT', ['organization', 'members', '12', 'spending-limit']],
    ['PUT', ['organization', 'members', '12', 'quota']],
    ['POST', ['organization', 'invitations']],
    ['POST', ['organization', 'members', 'quota-batch']],
    ['POST', ['organization', 'members', 'spending-limit-split']],
    ['POST', ['organization', 'quota-requests']],
    ['POST', ['organization', 'quota-requests', '12', 'approve']],
    ['POST', ['organization', 'quota-requests', '12', 'reject']],
    ['POST', ['organization', 'quota-requests', '12', 'withdraw']],
    ['DELETE', ['organization', 'invitations', '12']],
  ])('allows %s %s', (method, pathSegments) => {
    expect(isAllowedPortalRequest(method, pathSegments)).toBe(true);
  });

  it('方法名大小写不敏感，但只认白名单里的方法', () => {
    expect(isAllowedPortalRequest('get', ['organization', 'members'])).toBe(true);
    expect(isAllowedPortalRequest('Post', ['organization', 'invitations'])).toBe(true);
    expect(isAllowedPortalRequest('HEAD', ['organization', 'members'])).toBe(false);
    expect(isAllowedPortalRequest('OPTIONS', ['organization', 'members'])).toBe(false);
  });
});

// ===========================================================================
// 拒绝：其他方法、其他组织管理 / admin、非正整数、编码穿越
// ===========================================================================

describe('组织代理拒绝未列出的方法', () => {
  it.each([
    ['PATCH', ['organization', 'default-quota']],
    ['PATCH', ['organization', 'quota-request-policy']],
    ['PATCH', ['organization', 'members', '12', 'status']],
    ['PATCH', ['organization', 'members', '12', 'quota']],
    ['PATCH', ['organization', 'invitations']],
    ['PATCH', ['organization', 'quota-requests']],
    ['POST', ['organization', 'members']],
    ['POST', ['organization', 'members', '12', 'status']],
    ['POST', ['organization', 'default-quota']],
    ['PUT', ['organization', 'invitations']],
    ['PUT', ['organization', 'quota-requests']],
    ['PUT', ['organization', 'quota-requests', '12', 'approve']],
    ['DELETE', ['organization', 'members', '12']],
    ['DELETE', ['organization', 'default-quota']],
    ['DELETE', ['organization', 'quota-requests', '12']],
    ['DELETE', ['organization', 'invitations']],
    ['GET', ['organization', 'quota-requests', '12', 'approve']],
    ['GET', ['organization', 'members', '12', 'status']],
    ['GET', ['organization', 'members', '12', 'quota']],
    ['GET', ['organization', 'invitations', '12']],
  ])('rejects %s %s', (method, pathSegments) => {
    expect(isAllowedPortalRequest(method, pathSegments)).toBe(false);
  });
});

describe('组织代理拒绝其他组织管理路径', () => {
  it.each([
    ['GET', ['admin']],
    ['GET', ['admin', 'organization', 'members']],
    ['POST', ['admin', 'organization']],
    ['GET', ['organization', '1']],
    ['GET', ['organization', '1', 'members']],
    ['PUT', ['organization', '1']],
    ['PUT', ['organization', 'members', '12', 'role']],
    ['PUT', ['organization', 'members', '12', 'remove']],
    ['PUT', ['organization', 'members', '12', 'status', 'extra']],
    ['POST', ['organization', 'invitations', '12', 'accept']],
    ['POST', ['organization', 'invitations', '12', 'revoke']],
    ['POST', ['organization', 'quota-requests', '12']],
    ['POST', ['organization', 'quota-requests', '12', 'approve', 'extra']],
    ['POST', ['organization', 'quota-requests', '12', 'cancel']],
    ['POST', ['organization', 'quota-requests', '12', 'reject', 'extra']],
    ['POST', ['organization', 'members', '12', 'quota-batch']],
    ['POST', ['organization', 'members', 'quota-batch', 'extra']],
    ['POST', ['organization', 'members', 'spending-limit-split', 'extra']],
    ['GET', ['organization', 'quota-request-policy', 'extra']],
    ['GET', ['organization', 'default-quota', 'extra']],
    ['GET', ['organization', 'members', 'extra']],
    ['GET', ['usage', 'organization']],
    ['GET', ['usage', 'organization', 'members', 'extra']],
  ])('rejects %s %s', (method, pathSegments) => {
    expect(isAllowedPortalRequest(method, pathSegments)).toBe(false);
  });
});

describe('组织代理拒绝非正整数 path 与编码穿越', () => {
  it.each([
    ['PUT', ['organization', 'members', '0', 'status']],
    ['PUT', ['organization', 'members', '-1', 'status']],
    ['PUT', ['organization', 'members', '1.0', 'quota']],
    ['PUT', ['organization', 'members', '01', 'quota']],
    ['PUT', ['organization', 'members', '1a', 'quota']],
    ['PUT', ['organization', 'members', '', 'quota']],
    ['DELETE', ['organization', 'invitations', '0']],
    ['DELETE', ['organization', 'invitations', '-3']],
    ['DELETE', ['organization', 'invitations', '1.5']],
    ['POST', ['organization', 'quota-requests', '0', 'approve']],
    ['POST', ['organization', 'quota-requests', '01', 'reject']],
    ['POST', ['organization', 'quota-requests', '-1', 'withdraw']],
    ['GET', ['organization', 'members', '..']],
    ['PUT', ['organization', 'members', '..', 'status']],
    ['PUT', ['organization', 'members', '%2e%2e', 'status']],
    ['PUT', ['organization', 'members', '%2E%2E', 'status']],
    ['DELETE', ['organization', 'invitations', '%2e%2e']],
    ['GET', ['organization', '%2e%2e', 'members']],
    ['GET', ['organization', '..', 'members']],
    ['GET', ['organization', 'members', '%2F']],
    ['GET', ['organization', 'members', 'a/b']],
    ['GET', ['organization', 'members', 'a\\b']],
    ['GET', ['organization', 'members', '?next=admin']],
    ['PUT', ['organization', 'members', '12', '%2e%2e']],
    ['POST', ['organization', 'quota-requests', '%2e%2e', 'approve']],
    ['GET', ['organization', '..']],
  ])('rejects %s %s', (method, pathSegments) => {
    expect(isAllowedPortalRequest(method, pathSegments)).toBe(false);
  });
});

// ===========================================================================
// 转发层：放行请求真的转发，拒绝请求不触网
// ===========================================================================

describe('forwardPortalRequest 组织转发', () => {
  it('放行 GET /organization/members 并保留查询串', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/organization/members?scope=organization&page=2'),
      ['organization', 'members'],
      { baseUrl: BASE_URL, fetcher },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(
      `${BASE_URL}/api/v1/organization/members?scope=organization&page=2`,
    );
    expect(calls[0]?.init.method).toBe('GET');
  });

  it('放行 GET /usage/organization/members', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/usage/organization/members?scope=organization'),
      ['usage', 'organization', 'members'],
      { baseUrl: BASE_URL, fetcher },
    );

    expect(response.status).toBe(200);
    expect(calls[0]?.input).toBe(
      `${BASE_URL}/api/v1/usage/organization/members?scope=organization`,
    );
  });

  it('放行 PUT /organization/members/12/status 与 JSON 请求体', async () => {
    const { fetcher, calls } = makeFetcher();
    const response = await forwardPortalRequest(
      makeRequest('/api/portal/organization/members/12/status', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'disabled' }),
      }),
      ['organization', 'members', '12', 'status'],
      { baseUrl: BASE_URL, publicOrigin: 'https://portal.example.test', fetcher },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`${BASE_URL}/api/v1/organization/members/12/status`);
    expect(calls[0]?.init.method).toBe('PUT');
  });

  it.each([
    ['POST', ['organization', 'invitations'], '/api/v1/organization/invitations'],
    [
      'POST',
      ['organization', 'quota-requests', '12', 'approve'],
      '/api/v1/organization/quota-requests/12/approve',
    ],
    ['DELETE', ['organization', 'invitations', '12'], '/api/v1/organization/invitations/12'],
    [
      'POST',
      ['organization', 'members', 'quota-batch'],
      '/api/v1/organization/members/quota-batch',
    ],
    [
      'POST',
      ['organization', 'members', 'spending-limit-split'],
      '/api/v1/organization/members/spending-limit-split',
    ],
    ['PUT', ['organization', 'default-quota'], '/api/v1/organization/default-quota'],
    ['PUT', ['organization', 'quota-request-policy'], '/api/v1/organization/quota-request-policy'],
  ])('放行 %s %s 并转发到固定上游', async (method, pathSegments, expectedPath) => {
    const { fetcher, calls } = makeFetcher();
    const init: RequestInit =
      method === 'GET'
        ? {}
        : { method, headers: { 'content-type': 'application/json' }, body: '{}' };
    const response = await forwardPortalRequest(
      makeRequest(`/api/portal/${pathSegments.join('/')}`, init),
      pathSegments,
      { baseUrl: BASE_URL, publicOrigin: 'https://portal.example.test', fetcher },
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe(`${BASE_URL}${expectedPath}`);
    expect(calls[0]?.init.method).toBe(method);
  });

  it.each([
    ['PATCH', ['organization', 'default-quota']],
    ['POST', ['organization', 'members', '12', 'status']],
    ['DELETE', ['organization', 'members', '12']],
    ['GET', ['admin', 'organization', 'members']],
    ['PUT', ['organization', 'members', '0', 'status']],
    ['PUT', ['organization', 'members', '12', 'role']],
    ['GET', ['organization', 'members', '%2e%2e']],
    ['POST', ['organization', 'quota-requests', '12', 'cancel']],
  ])('拒绝 %s %s：返回 404 且不触网', async (method, pathSegments) => {
    const { fetcher, calls } = makeFetcher();
    const init: RequestInit =
      method === 'GET'
        ? { method }
        : { method, headers: { 'content-type': 'application/json' }, body: '{}' };
    const response = await forwardPortalRequest(
      makeRequest(`/api/portal/${pathSegments.join('/')}`, init),
      pathSegments,
      { baseUrl: BASE_URL, publicOrigin: 'https://portal.example.test', fetcher },
    );

    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });
});
