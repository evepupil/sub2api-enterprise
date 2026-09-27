import type { ApiRequester, CaptchaProof } from './types';

interface PasskeyBeginResponse {
  session_token: string;
  options: { publicKey: Record<string, unknown> };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('通行密钥选项格式不正确');
  }
  return value as Record<string, unknown>;
}

function base64UrlToBuffer(value: unknown): ArrayBuffer {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('通行密钥选项缺少二进制字段');
  }
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const binary = window.atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function bufferToBase64Url(value: ArrayBuffer | null): string | null {
  if (value === null) return null;
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
}

function toRequestOptions(value: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  const options: Record<string, unknown> = { ...value };
  options.challenge = base64UrlToBuffer(options.challenge);
  if (Array.isArray(options.allowCredentials)) {
    options.allowCredentials = options.allowCredentials.map((item) => {
      const descriptor = asRecord(item);
      return { ...descriptor, id: base64UrlToBuffer(descriptor.id) };
    });
  }
  return options as unknown as PublicKeyCredentialRequestOptions;
}

function serializeCredential(credential: PublicKeyCredential): Record<string, unknown> {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: bufferToBase64Url(response.userHandle),
    },
  };
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

export async function loginWithPasskey(
  request: ApiRequester,
  proof?: CaptchaProof,
): Promise<unknown> {
  if (!isPasskeySupported()) {
    throw new Error('此浏览器不支持通行密钥登录');
  }

  const begin = await request<PasskeyBeginResponse>('/auth/passkey/login/begin', {
    method: 'POST',
    auth: false,
    body: proof ?? {},
  });
  if (
    typeof begin.session_token !== 'string' ||
    begin.session_token.length === 0 ||
    typeof begin.options !== 'object' ||
    begin.options === null
  ) {
    throw new Error('通行密钥初始化响应格式不正确');
  }

  const credential = await navigator.credentials.get({
    publicKey: toRequestOptions(begin.options.publicKey),
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error('通行密钥验证已取消');
  }

  return request<unknown>('/auth/passkey/login/finish', {
    method: 'POST',
    auth: false,
    body: {
      session_token: begin.session_token,
      credential: serializeCredential(credential),
    },
  });
}
