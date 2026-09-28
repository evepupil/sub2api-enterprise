/**
 * HTML 转义行为测试（Vitest，Node 环境）。
 *
 * 契约来源：任务书「补 escapeHtml 行为测试」给出的行为描述——& < > " ' 五个字符分别
 * 转成对应实体、含尖括号的注入片段转义后不再含尖括号、已经是实体的文本会被再次转义、
 * 普通中文与数字原样不变、空字符串返回空字符串。按描述出题，不照抄 src/lib/html.ts
 * 的实现反推用例。
 */
import { describe, expect, it } from 'vitest';

import { escapeHtml } from '../src/lib/html';

describe('escapeHtml', () => {
  describe('五个特殊字符分别转成对应实体', () => {
    it.each<[string, string]>([
      ['&', '&amp;'],
      ['<', '&lt;'],
      ['>', '&gt;'],
      ['"', '&quot;'],
      ["'", '&#39;'],
    ])('%s -> %s', (input, expected) => {
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  it('注入片段转义后不再包含尖括号', () => {
    const text = escapeHtml('<img src=x onerror=alert(1)>');
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });

  it('已经是实体的文本会被再次转义：&lt; -> &amp;lt;', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('普通中文与数字原样不变', () => {
    expect(escapeHtml('普通文本123')).toBe('普通文本123');
  });

  it('空字符串返回空字符串', () => {
    expect(escapeHtml('')).toBe('');
  });
});
