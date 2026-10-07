import { describe, expect, it } from 'vitest';

import { parseBlocks, parseInline } from '@/lib/legal/markup';
import { messagesByLocale } from '@/messages';

describe('条款正文的标记', () => {
  it('拆出加粗、站内链接和占位，其余原样当文字', () => {
    expect(parseInline('**账户信息**：见[隐私政策](/privacy)，问 {email}，{name} 回复')).toEqual([
      { kind: 'strong', text: '账户信息' },
      { kind: 'text', text: '：见' },
      { kind: 'link', text: '隐私政策', href: '/privacy' },
      { kind: 'text', text: '，问 ' },
      { kind: 'email' },
      { kind: 'text', text: '，' },
      { kind: 'name' },
      { kind: 'text', text: ' 回复' },
    ]);
  });

  it('站外链接和不认识的占位不处理', () => {
    expect(parseInline('[外链](https://example.com) {other}')).toEqual([
      { kind: 'text', text: '[外链](https://example.com) {other}' },
    ]);
  });

  it('相邻的列表项合成一个列表，段落把列表隔开', () => {
    const blocks = parseBlocks(['你不得：', '- 一', '- 二', '另外：', '- 三']);
    expect(blocks.map((block) => block.kind)).toEqual(['paragraph', 'list', 'paragraph', 'list']);
    expect(blocks[1]).toEqual({
      kind: 'list',
      items: [[{ kind: 'text', text: '一' }], [{ kind: 'text', text: '二' }]],
    });
  });

  it('中英文条款的章节一一对应，链接都是站内页', () => {
    const { zh, en } = messagesByLocale;
    for (const doc of ['terms', 'privacy'] as const) {
      const ids = (locale: typeof zh) => locale.legal[doc].sections.map((section) => section.id);
      expect(ids(en), doc).toEqual(ids(zh));
      expect(new Set(ids(zh)).size, doc).toBe(ids(zh).length);
      for (const locale of [zh, en]) {
        const lines = [
          ...locale.legal[doc].intro,
          ...locale.legal[doc].sections.flatMap((section) => section.body),
        ];
        const hrefs = lines.flatMap((line) =>
          parseInline(line).flatMap((part) => (part.kind === 'link' ? [part.href] : [])),
        );
        for (const href of hrefs)
          expect(['/terms', '/privacy', '/catalog', '/pricing', '/channels']).toContain(href);
      }
    }
  });

  it('退款一节在服务条款里（页脚「退款政策」跳到这里）', () => {
    expect(messagesByLocale.zh.legal.terms.sections.map((section) => section.id)).toContain(
      'refund',
    );
  });
});
