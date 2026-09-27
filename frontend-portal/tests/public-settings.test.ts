/**
 * M1 公开设置解析（public-settings）业务规则测试。
 *
 * 契约来源：design/public-site.md 第 3 节「匿名配置按白名单」与
 * src/features/public/types.ts 的 PublicSettings。
 *
 * 事实：
 * - parsePublicSettings 只返回白名单字段 siteName/contactInfo/documentationUrl/registrationEnabled，
 *   绝不透传 home_content、公告、HTML 或任何额外字段。
 * - 站名缺失/为空回落默认「模型服务」。
 * - contact_info 是纯文本，绝不当链接使用；QQ 等文本原样保留。
 * - doc_url 只接受 http(s)、无 userinfo 的绝对 URL；javascript:/data:/协议相对/相对地址为 null。
 * - registration_enabled 严格 === true 才是 true。
 * - 顶层不是普通对象时抛错（由请求层转为 unavailable）。
 * - safeHttpUrl / parseOrigin 是配套的 URL 守卫，分别验证任意 http(s) 链接与根 origin。
 *
 * 只测业务逻辑，不镜像 CSS/JSX。
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PUBLIC_SETTINGS,
  parseOrigin,
  parsePublicSettings,
  safeHttpUrl,
} from '../src/features/public/settings';

describe('parsePublicSettings 白名单字段', () => {
  it('只返回四个白名单字段，不透传额外字段', () => {
    const result = parsePublicSettings({
      site_name: '示例站点',
      contact_info: '客服 QQ：123456',
      doc_url: 'https://docs.example.com/guide',
      registration_enabled: true,
      home_content: '<h1>不该出现</h1>',
      announcement: '内部公告',
      html: '<script>alert(1)</script>',
      extra: { nested: true },
    });

    expect(Object.keys(result).sort()).toEqual(
      ['contactInfo', 'documentationUrl', 'registrationEnabled', 'siteName'].sort(),
    );
    expect(result).toEqual({
      siteName: '示例站点',
      contactInfo: '客服 QQ：123456',
      documentationUrl: 'https://docs.example.com/guide',
      registrationEnabled: true,
    });
  });

  it('不把 home_content 或 HTML 内容当作站名或客服信息', () => {
    const result = parsePublicSettings({
      home_content: '<p>首页内容</p>',
      html: '<b>加粗</b>',
    });

    expect(result.siteName).toBe(DEFAULT_PUBLIC_SETTINGS.siteName);
    expect(result.contactInfo).toBeNull();
  });

  it.each([null, undefined, 'string', 42, true, [], ['site_name']])(
    '顶层不是普通对象（%s）时抛错',
    (value) => {
      expect(() => parsePublicSettings(value)).toThrow();
    },
  );

  it('空对象回落到安全默认值', () => {
    const result = parsePublicSettings({});

    expect(result).toEqual({
      siteName: DEFAULT_PUBLIC_SETTINGS.siteName,
      contactInfo: null,
      documentationUrl: null,
      registrationEnabled: false,
    });
  });
});

describe('parsePublicSettings 站名', () => {
  it('采用非空站名并去除首尾空白', () => {
    expect(parsePublicSettings({ site_name: '  我的模型服务  ' }).siteName).toBe('我的模型服务');
  });

  it.each([undefined, null, '', '   ', 0, false, {}, []])(
    '站名缺失或非法（%s）回落到默认「模型服务」',
    (siteName) => {
      expect(parsePublicSettings({ site_name: siteName }).siteName).toBe('模型服务');
    },
  );
});

describe('parsePublicSettings 客服信息按纯文本', () => {
  it('保留 QQ 文本，不解析成 URL', () => {
    expect(parsePublicSettings({ contact_info: '客服 QQ：123456789' }).contactInfo).toBe(
      '客服 QQ：123456789',
    );
  });

  it('保留邮箱与其他纯文本原样', () => {
    expect(parsePublicSettings({ contact_info: 'support@example.com' }).contactInfo).toBe(
      'support@example.com',
    );
    expect(parsePublicSettings({ contact_info: '工作时间 9:00-18:00' }).contactInfo).toBe(
      '工作时间 9:00-18:00',
    );
  });

  it('不把看起来像 URL 的客服信息转成文档链接', () => {
    const result = parsePublicSettings({ contact_info: 'https://evil.example.com' });

    expect(result.contactInfo).toBe('https://evil.example.com');
    expect(result.documentationUrl).toBeNull();
  });

  it('去除首尾空白', () => {
    expect(parsePublicSettings({ contact_info: '  客服  ' }).contactInfo).toBe('客服');
  });

  it.each([undefined, null, '', '   ', 42, {}, []])(
    '客服信息缺失或非法（%s）为 null',
    (contactInfo) => {
      expect(parsePublicSettings({ contact_info: contactInfo }).contactInfo).toBeNull();
    },
  );
});

describe('parsePublicSettings 文档链接协议限制', () => {
  it.each([
    'https://docs.example.com',
    'https://docs.example.com/guide?x=1#top',
    'http://docs.example.com/guide',
  ])('接受 http(s) 绝对链接：%s', (docUrl) => {
    expect(parsePublicSettings({ doc_url: docUrl }).documentationUrl).toBe(
      new URL(docUrl).toString(),
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    '//docs.example.com/guide',
    '/guide',
    'guide',
    'ftp://docs.example.com',
    'mailto:support@example.com',
    'https://user:pass@docs.example.com/guide',
    'https://user@docs.example.com/guide',
    'not a url',
    '',
    '   ',
  ])('拒绝非 http(s)/协议相对/相对/含凭证的文档链接：%s', (docUrl) => {
    expect(parsePublicSettings({ doc_url: docUrl }).documentationUrl).toBeNull();
  });

  it.each([undefined, null, 42, true, {}, []])('文档链接非法类型（%s）为 null', (docUrl) => {
    expect(parsePublicSettings({ doc_url: docUrl }).documentationUrl).toBeNull();
  });
});

describe('parsePublicSettings 注册开关严格布尔', () => {
  it('=== true 时为 true', () => {
    expect(parsePublicSettings({ registration_enabled: true }).registrationEnabled).toBe(true);
  });

  it.each([undefined, null, false, 'true', '1', 1, 0, {}, []])(
    '非严格 true（%s）为 false',
    (value) => {
      expect(parsePublicSettings({ registration_enabled: value }).registrationEnabled).toBe(false);
    },
  );
});

describe('safeHttpUrl', () => {
  it.each([
    'https://docs.example.com',
    'https://docs.example.com/guide?x=1#top',
    'http://localhost:8080/path',
  ])('接受 http(s) 绝对链接：%s', (value) => {
    expect(safeHttpUrl(value)).toBe(new URL(value).toString());
  });

  it('去除首尾空白后返回', () => {
    expect(safeHttpUrl('  https://docs.example.com  ')).toBe('https://docs.example.com/');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'file:///etc/passwd',
    'mailto:support@example.com',
    '//docs.example.com',
    '/guide',
    'guide',
    'https://user:pass@docs.example.com',
    'https://user@docs.example.com',
    '',
    '   ',
    'not a url',
  ])('拒绝非 http(s)/协议相对/相对/含凭证：%s', (value) => {
    expect(safeHttpUrl(value)).toBeNull();
  });

  it.each([undefined, null, 42, true, {}, []])('非字符串（%s）为 null', (value) => {
    expect(safeHttpUrl(value)).toBeNull();
  });
});

describe('parseOrigin', () => {
  it.each([
    ['https://backend.example.com', 'https://backend.example.com'],
    ['https://backend.example.com/', 'https://backend.example.com'],
    ['http://localhost:8080', 'http://localhost:8080'],
    ['http://localhost:8080/', 'http://localhost:8080'],
  ])('接受根 origin 并规范化为 protocol//host：%s', (value, expected) => {
    expect(parseOrigin(value)).toBe(expected);
  });

  it.each([
    'https://backend.example.com/path',
    'https://backend.example.com/path/',
    'https://backend.example.com?query=1',
    'https://backend.example.com#hash',
    'https://user:pass@backend.example.com',
    'https://user@backend.example.com',
    'javascript:alert(1)',
    'ftp://backend.example.com',
    '//backend.example.com',
    'backend.example.com',
    '/path',
    '',
    '   ',
    'not a url',
  ])('拒绝带路径/查询/hash/凭证或非 http(s)：%s', (value) => {
    expect(parseOrigin(value)).toBeNull();
  });

  it.each([undefined, null, 42, true, {}, []])('非字符串（%s）为 null', (value) => {
    expect(parseOrigin(value)).toBeNull();
  });
});
