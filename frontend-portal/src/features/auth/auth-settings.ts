'use client';

/**
 * M2 公开认证配置：解析 `/settings/public` 并暴露给账号页面。
 *
 * 契约来源：design/customer-console.md 第 2 节；类型固定于 ./types.ts。
 *
 * 边界：
 * - 只拣白名单字段，其他公开字段（site_name、home_content、菜单等）一律不进入
 *   AuthSettings，避免把无关内容带进账号流程。
 * - 严格 fail-closed：`xxx_enabled === true` 才算启用；启用但缺少必要配置
 *   （site_key / app_id / scene_id+prefix）时抛错，绝不降级成“未启用”而绕过验证。
 * - 读取失败就是失败：调用方必须把 error/loading 与“功能关闭”分开处理。
 * - 验证码优先级与旧组件一致：Turnstile > 腾讯 > 阿里云。
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { AuthSettings } from './types';
import { useAuth } from './auth-provider';

type JsonObject = Record<string, unknown>;

const CAPTCHA_PRIORITY = ['turnstile', 'tencent', 'aliyun'] as const;

/** 后端 OAuth 开关 -> 展示标签。只有开启的项才进入列表。 */
const OAUTH_LABELS: readonly { key: string; id: string; label: string }[] = [
  { key: 'github_oauth_enabled', id: 'github', label: 'GitHub' },
  { key: 'google_oauth_enabled', id: 'google', label: 'Google' },
  { key: 'linuxdo_oauth_enabled', id: 'linuxdo', label: 'LinuxDO' },
  { key: 'oidc_oauth_enabled', id: 'oidc', label: 'OIDC' },
  { key: 'wechat_oauth_enabled', id: 'wechat', label: '微信' },
  { key: 'dingtalk_oauth_enabled', id: 'dingtalk', label: '钉钉' },
];

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 严格布尔：只有字面 true 才算开启。 */
function flag(value: unknown): boolean {
  return value === true;
}

/** 非空字符串（去空白），否则 null。 */
function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * 解析 `/settings/public` 的业务 data。
 *
 * - 顶层必须是普通对象（允许 `{ code: 0, data }` 包装），否则抛错。
 * - 顶层 `enabled` 为 true 时，对应配置缺失即抛错（fail-closed）。
 * - 关闭的验证码不要求配置，也不进入 AuthSettings（返回 null）。
 */
export function parseAuthSettings(value: unknown): AuthSettings {
  if (!isObject(value)) {
    throw new Error('公开认证配置不是对象');
  }
  // 兼容业务包装：只在显式出现 code 字段时解包。
  let record = value;
  if (Object.prototype.hasOwnProperty.call(value, 'code')) {
    if (value.code !== 0) {
      throw new Error('公开认证配置请求失败');
    }
    if (!isObject(value.data)) {
      throw new Error('公开认证配置不是对象');
    }
    record = value.data;
  }

  const turnstileEnabled = flag(record.turnstile_enabled);
  const turnstileSiteKey = optionalText(record.turnstile_site_key);
  if (turnstileEnabled && turnstileSiteKey === null) {
    throw new Error('公开认证配置缺少 turnstile_site_key');
  }

  const tencentEnabled = flag(record.tencent_captcha_enabled);
  const tencentAppId = optionalText(record.tencent_captcha_app_id);
  if (tencentEnabled && tencentAppId === null) {
    throw new Error('公开认证配置缺少 tencent_captcha_app_id');
  }

  const aliyunEnabled = flag(record.aliyun_captcha_enabled);
  const aliyunSceneId = optionalText(record.aliyun_captcha_scene_id);
  const aliyunPrefix = optionalText(record.aliyun_captcha_prefix);
  const aliyunRegion = optionalText(record.aliyun_captcha_region);
  if (aliyunEnabled && (aliyunSceneId === null || aliyunPrefix === null)) {
    throw new Error('公开认证配置缺少阿里云验证码 scene_id 或 prefix');
  }

  const agreementDocuments = parseAgreementDocuments(record.login_agreement_documents);
  const agreementUpdatedAt = optionalText(record.login_agreement_updated_at);
  const agreementRevision =
    optionalText(record.login_agreement_revision) ??
    deriveAgreementRevision(agreementUpdatedAt, agreementDocuments);
  const agreementEnabled = flag(record.login_agreement_enabled) && agreementDocuments.length > 0;

  return {
    registrationEnabled: flag(record.registration_enabled),
    emailVerifyEnabled: flag(record.email_verify_enabled),
    passwordResetEnabled: flag(record.password_reset_enabled),
    invitationCodeEnabled: flag(record.invitation_code_enabled),
    totpEnabled: flag(record.totp_enabled),
    turnstileSiteKey: turnstileEnabled ? turnstileSiteKey : null,
    tencentAppId: tencentEnabled ? tencentAppId : null,
    aliyun:
      aliyunEnabled && aliyunSceneId !== null && aliyunPrefix !== null
        ? { sceneId: aliyunSceneId, prefix: aliyunPrefix, region: aliyunRegion ?? 'cn' }
        : null,
    emailSuffixes: parseEmailSuffixes(record.registration_email_suffix_whitelist),
    agreement: {
      enabled: agreementEnabled,
      revision: agreementRevision,
      documents: agreementDocuments,
    },
    oauthProviders: parseOAuthProviders(record),
    passkeyEnabled: flag(record.passkey_enabled),
  };
}

/** 邮箱后缀白名单：只保留非空字符串并去重，非法元素忽略（策略由注册表单二次校验）。 */
function parseEmailSuffixes(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('公开认证配置的邮箱后缀白名单不是数组');
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const suffix = optionalText(item);
    if (suffix === null || seen.has(suffix)) {
      continue;
    }
    seen.add(suffix);
    result.push(suffix);
  }
  return result;
}

/** 协议文档：id 与 title 必须非空，content_md 允许为空（纯文本，调用方负责渲染）。 */
function parseAgreementDocuments(value: unknown): { id: string; title: string; content: string }[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('公开认证配置的协议文档不是数组');
  }
  const documents: { id: string; title: string; content: string }[] = [];
  for (const item of value) {
    if (!isObject(item)) {
      continue;
    }
    const id = optionalText(item.id);
    const title = optionalText(item.title);
    if (id === null || title === null) {
      continue;
    }
    const content = typeof item.content_md === 'string' ? item.content_md : '';
    documents.push({ id, title, content });
  }
  return documents;
}

/** 后端未给 revision 时，用更新时间与文档标识派生一个稳定版本号（与旧组件一致）。 */
function deriveAgreementRevision(
  updatedAt: string | null,
  documents: readonly { id: string; title: string }[],
): string {
  if (updatedAt === null && documents.length === 0) {
    return '';
  }
  return `${updatedAt ?? ''}:${documents.map((doc) => `${doc.id}:${doc.title}`).join('|')}`;
}

/** OAuth 入口：只有后端明确开启的提供方才出现，标签用后端 provider name 或固定名。 */
function parseOAuthProviders(record: JsonObject): { id: string; label: string }[] {
  const providers: { id: string; label: string }[] = [];
  for (const provider of OAUTH_LABELS) {
    // 微信没有单独的“legacy 总开关”语义：任一已显式开启的能力（开放平台/公众号）
    // 都代表网页端可用，与旧组件判定保持一致。
    const enabled =
      flag(record[provider.key]) ||
      (provider.id === 'wechat' &&
        (flag(record.wechat_oauth_open_enabled) || flag(record.wechat_oauth_mp_enabled)));
    if (!enabled) {
      continue;
    }
    const label =
      provider.id === 'oidc'
        ? (optionalText(record.oidc_oauth_provider_name) ?? provider.label)
        : provider.label;
    providers.push({ id: provider.id, label });
  }
  return providers;
}

/**
 * 读取公开认证配置。queryKey 固定为 `['auth-settings']`，不做重试，
 * 请求走会话服务并显式 `auth: false`（公开接口不带令牌）。
 *
 * 失败时返回 error 状态，绝不返回“功能全关”的假配置。
 */
export function useAuthSettings(): UseQueryResult<AuthSettings, Error> {
  const { request } = useAuth();
  return useQuery<AuthSettings, Error>({
    queryKey: ['auth-settings'],
    retry: false,
    queryFn: async ({ signal }) => {
      const data = await request<unknown>('/settings/public', { auth: false, signal });
      return parseAuthSettings(data);
    },
  });
}

/** 验证码提供方优先级，供页面与测试引用。 */
export const CAPTCHA_PROVIDER_PRIORITY = CAPTCHA_PRIORITY;
