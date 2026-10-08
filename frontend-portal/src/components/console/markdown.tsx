import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Markdown 正文（控制台公告详情用）：段落、标题、加粗、列表、链接、图片、引用、代码、表格。
 * 安全：正文里的原始 HTML 标签直接丢掉（只留标签中间的文字），链接与图片地址用 react-markdown 默认的过滤
 * （javascript: 之类的地址会被清掉）；站外链接新窗口打开。
 * 各元素只取要用的属性，不把解析器的内部字段带到页面上。
 */
const COMPONENTS: Components = {
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h3 className="mb-2 mt-5 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-2 mt-5 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => <h4 className="mb-1.5 mt-4 font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-4 font-semibold first:mt-0">{children}</h4>,
  h5: ({ children }) => <h4 className="mb-1.5 mt-4 font-semibold first:mt-0">{children}</h4>,
  h6: ({ children }) => <h4 className="mb-1.5 mt-4 font-semibold first:mt-0">{children}</h4>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ href, children }) => {
    // 地址被过滤掉（如 javascript:）时只留文字，不留一个点了会刷新本页的空链接
    if (typeof href !== 'string' || href === '') return <span>{children}</span>;
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="font-medium underline underline-offset-2 hover:text-muted-foreground"
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) =>
    typeof src === 'string' && src !== '' ? (
      <img
        src={src}
        alt={alt ?? ''}
        loading="lazy"
        className="my-3 h-auto max-w-full rounded-lg border border-border"
      />
    ) : null,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-border-strong pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-xs">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-muted px-2 py-1.5 font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1.5">{children}</td>,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div data-markdown className="break-words text-sm leading-6 text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
