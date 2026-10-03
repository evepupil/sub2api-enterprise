import { SITE } from '@/lib/site';

/** 接入示例支持的三种客户端 */
export type SnippetKind = 'claude' | 'codex' | 'curl';

export const SNIPPET_KINDS: readonly SnippetKind[] = ['claude', 'codex', 'curl'];

/** curl 示例请求的模型 */
const SAMPLE_MODEL = 'gpt-6-sol';

/**
 * 接入示例的代码文本：地址取站点配置里的接口地址，密钥用这一行的完整密钥。
 * 写法和日志页的「复制为 curl」一致：长命令用反斜杠分行，整段复制就能在终端里跑。
 */
export function buildSnippet(kind: SnippetKind, secret: string): string {
  switch (kind) {
    case 'claude':
      return [
        `export ANTHROPIC_BASE_URL=${SITE.apiBase}`,
        `export ANTHROPIC_AUTH_TOKEN=${secret}`,
        'claude',
      ].join('\n');
    case 'codex':
      return [
        '# ~/.codex/config.toml',
        'model_provider = "nexus"',
        '',
        '[model_providers.nexus]',
        `name = "${SITE.name}"`,
        `base_url = "${SITE.apiBase}/v1"`,
        'env_key = "NEXUS_API_KEY"',
        '',
        '# shell',
        `export NEXUS_API_KEY=${secret}`,
      ].join('\n');
    case 'curl': {
      const body = JSON.stringify({
        model: SAMPLE_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
      });
      return [
        `curl ${SITE.apiBase}/v1/chat/completions \\`,
        `  -H "Authorization: Bearer ${secret}" \\`,
        '  -H "Content-Type: application/json" \\',
        `  -d '${body}'`,
      ].join('\n');
    }
  }
}
