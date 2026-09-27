import { describe, expect, it } from 'vitest';
import { acceptOAuthLogin } from '../src/features/auth/oauth-utils';
import { parseOAuthFragment, pendingMode } from '../src/features/auth/oauth-response';
import type { ApiRequestOptions } from '../src/features/auth/types';

describe('OAuth response parsing', () => {
  it.each([
    ['choose_account_action_required', 'choose'],
    ['bind_login_required', 'bind-login'],
    ['email_completion', 'email-completion'],
    ['invitation_required', 'create-account'],
    ['registration_completion_required', 'create-account'],
  ])('maps backend step %s to %s', (step, expected) => {
    expect(pendingMode({ step })).toBe(expected);
  });

  it.each(['invitation_required', 'registration_completion_required'])(
    'maps an error payload %s to create-account',
    (error) => {
      expect(pendingMode({ error })).toBe('create-account');
    },
  );

  it('returns null for an unknown pending state', () => {
    expect(pendingMode({ step: 'future_backend_state' })).toBeNull();
    expect(pendingMode({ intent: 'unrecognized' })).toBeNull();
  });

  it('reads tokens only from the hash and preserves the supported fields', () => {
    const parsed = parseOAuthFragment(
      new URL(
        'https://portal.invalid/auth/callback?access_token=query-token#access_token=hash-token&refresh_token=refresh-token&expires_in=3600&token_type=Bearer&redirect=%2Fdashboard&client_secret=must-not-leak',
      ),
    );

    expect(parsed).toEqual({
      tokenResponse: {
        access_token: 'hash-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      },
      redirect: '/dashboard',
      hasError: false,
    });
    expect(JSON.stringify(parsed)).not.toContain('query-token');
    expect(JSON.stringify(parsed)).not.toContain('must-not-leak');
  });

  it('does not treat a query token as an OAuth login credential', () => {
    const parsed = parseOAuthFragment(
      new URL('https://portal.invalid/auth/callback?access_token=query-token#redirect=%2Fconsole'),
    );

    expect(parsed.tokenResponse).toBeNull();
    expect(parsed.redirect).toBeNull();
    expect(parsed.hasError).toBe(false);
  });

  it('does not log in with an empty access token and recognizes fragment errors', () => {
    const empty = parseOAuthFragment(
      new URL('https://portal.invalid/auth/callback#access_token=&refresh_token=refresh-token'),
    );
    const failed = parseOAuthFragment(
      new URL(
        'https://portal.invalid/auth/callback#error=access_denied&error_description=secret%20backend%20detail',
      ),
    );

    expect(empty.tokenResponse).toBeNull();
    expect(empty.hasError).toBe(false);
    expect(failed.tokenResponse).toBeNull();
    expect(failed.hasError).toBe(true);
    expect(JSON.stringify(failed)).not.toContain('secret backend detail');
  });
});

describe('acceptOAuthLogin', () => {
  const user = {
    id: 7,
    email: 'oauth@example.com',
    username: 'oauth-user',
    balance: 0,
    frozenBalance: 0,
    role: 'user',
    organization: null,
  };

  it('resolves token-only responses through auth/me before accepting the login', async () => {
    const requests: { path: string; options: ApiRequestOptions | undefined }[] = [];
    const accepted: unknown[] = [];
    const tokenResponse = {
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    };

    await acceptOAuthLogin(
      async (path: string, options?: ApiRequestOptions) => {
        requests.push({ path, options });
        return user;
      },
      async (value) => {
        accepted.push(value);
      },
      tokenResponse,
      'identity-1',
      () => 'identity-1',
    );

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      path: '/auth/me',
      options: {
        method: 'GET',
        auth: false,
        headers: { Authorization: 'Bearer access-token' },
      },
    });
    expect(accepted).toEqual([{ ...tokenResponse, user }]);
  });

  it('does not accept a token-only response when identity changed before auth/me', async () => {
    const requests: string[] = [];
    const accepted: unknown[] = [];

    await expect(
      acceptOAuthLogin(
        async (path: string) => {
          requests.push(path);
          return user;
        },
        async (value) => {
          accepted.push(value);
        },
        { access_token: 'access-token' },
        'identity-1',
        () => 'identity-2',
      ),
    ).rejects.toThrow('当前登录身份已变化');

    expect(requests).toHaveLength(0);
    expect(accepted).toHaveLength(0);
  });

  it('does not accept a token-only response when identity changed after auth/me', async () => {
    const requests: string[] = [];
    const accepted: unknown[] = [];
    let identityReads = 0;

    await expect(
      acceptOAuthLogin(
        async (path: string) => {
          requests.push(path);
          return user;
        },
        async (value) => {
          accepted.push(value);
        },
        { access_token: 'access-token' },
        'identity-1',
        () => {
          identityReads += 1;
          return identityReads === 1 ? 'identity-1' : 'identity-2';
        },
      ),
    ).rejects.toThrow('当前登录身份已变化');

    expect(requests).toEqual(['/auth/me']);
    expect(accepted).toHaveLength(0);
  });

  it('does not refetch a user already included in the OAuth response', async () => {
    const requests: string[] = [];
    const accepted: unknown[] = [];
    const tokenResponse = { access_token: 'access-token', user };

    await acceptOAuthLogin(
      async (path: string) => {
        requests.push(path);
        return user;
      },
      async (value) => {
        accepted.push(value);
      },
      tokenResponse,
      'identity-1',
      () => 'identity-1',
    );

    expect(requests).toHaveLength(0);
    expect(accepted).toEqual([tokenResponse]);
  });

  it.each([null, {}, { access_token: '' }, { access_token: '   ' }])(
    'rejects a token-only response without a usable access token: %o',
    async (value) => {
      const requests: string[] = [];
      const accepted: unknown[] = [];

      await expect(
        acceptOAuthLogin(
          async (path: string) => {
            requests.push(path);
            return user;
          },
          async (acceptedValue) => {
            accepted.push(acceptedValue);
          },
          value,
          'identity-1',
          () => 'identity-1',
        ),
      ).rejects.toThrow();

      expect(requests).toHaveLength(0);
      expect(accepted).toHaveLength(0);
    },
  );
});
