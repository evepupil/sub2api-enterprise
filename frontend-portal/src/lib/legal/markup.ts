/**
 * 服务条款、隐私政策正文的极简标记（正文在 src/messages/<语言>/legal.json）：
 * - 以「- 」开头的一行是列表项，相邻的列表项合成一个列表，其余每行是一段；
 * - 行内：**文字** 加粗，[文字](/站内地址) 站内链接，{name} 换成站点名，{email} 换成客服邮箱链接。
 * 只认这几种写法，其余原样当文字。
 */

export type LegalInline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'name' }
  | { kind: 'email' };

export type LegalBlock =
  { kind: 'paragraph'; inlines: LegalInline[] } | { kind: 'list'; items: LegalInline[][] };

const LIST_PREFIX = '- ';

/** 加粗 | 站内链接（只认 / 开头的地址）| 占位 */
const INLINE_PATTERN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)|\{(name|email)\}/g;

/** 把一行拆成文字、加粗、链接、占位几段 */
export function parseInline(line: string): LegalInline[] {
  const parts: LegalInline[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE_PATTERN)) {
    const start = match.index;
    if (start > last) parts.push({ kind: 'text', text: line.slice(last, start) });
    const [, strong, linkText, href, placeholder] = match;
    if (strong !== undefined) parts.push({ kind: 'strong', text: strong });
    else if (linkText !== undefined && href !== undefined)
      parts.push({ kind: 'link', text: linkText, href });
    else parts.push({ kind: placeholder === 'email' ? 'email' : 'name' });
    last = start + match[0].length;
  }
  if (last < line.length) parts.push({ kind: 'text', text: line.slice(last) });
  return parts;
}

/** 把一节的正文行分成段落和列表 */
export function parseBlocks(lines: readonly string[]): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  for (const line of lines) {
    if (line.startsWith(LIST_PREFIX)) {
      const item = parseInline(line.slice(LIST_PREFIX.length));
      const previous = blocks.at(-1);
      if (previous?.kind === 'list') previous.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
    } else {
      blocks.push({ kind: 'paragraph', inlines: parseInline(line) });
    }
  }
  return blocks;
}
