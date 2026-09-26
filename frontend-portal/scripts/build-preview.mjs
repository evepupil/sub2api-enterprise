/**
 * M0 离线预览打包脚本。
 *
 * 把 src/preview/foundation-preview.tsx 的具名导出 FoundationPreview 打包成
 * 单个自包含 HTML 文件 .preview/index.html：JS（esbuild，IIFE）与 CSS
 * （PostCSS + Tailwind，编译真实 src/styles/globals.css）全部内联。
 *
 * 特性：
 * - 工程根目录由 import.meta.url 推导，与调用时的 cwd 无关。
 * - 单文件构建，不启动服务器、不监听端口、不用浏览器、不调用任何模型 API。
 * - 输出为 UTF-8 中文页面，带严格的 CSP，无任何外部资源依赖。
 *
 * 用法：node scripts/build-preview.mjs
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const ENTRY_MODULE = './src/preview/foundation-preview';
const ENTRY_FILE = path.join(projectRoot, 'src', 'preview', 'foundation-preview.tsx');
const CSS_FILE = path.join(projectRoot, 'src', 'styles', 'globals.css');
const TSCONFIG_FILE = path.join(projectRoot, 'tsconfig.json');
const OUT_DIR = path.join(projectRoot, '.preview');
const OUT_FILE = path.join(OUT_DIR, 'index.html');

/** 预览页入口：挂载 FoundationPreview 到 #root。 */
const ENTRY_SOURCE = [
  "import { createRoot } from 'react-dom/client';",
  `import { FoundationPreview } from '${ENTRY_MODULE}';`,
  '',
  "const container = document.getElementById('root');",
  'if (!container) {',
  "  throw new Error('预览页缺少 #root 挂载点');",
  '}',
  'createRoot(container).render(<FoundationPreview />);',
  '',
].join('\n');

/**
 * 内联到 HTML 里时转义可能提前闭合所在标签的序列。
 * @param {string} code
 * @param {'script' | 'style'} tag
 */
function escapeForInlineTag(code, tag) {
  const closing = new RegExp(`</${tag}`, 'gi');
  let escaped = code.replace(closing, `<\\/${tag}`);
  if (tag === 'script') {
    // 注释开头同样会让 HTML 解析器进入脚本数据状态，一并转义。
    escaped = escaped.replace(/<!--/g, '<\\!--');
  }
  return escaped;
}

/** 极简 HTML 文本转义，用于 title 等属性/文本位。 */
function escapeHtmlText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** 用 esbuild 把 TSX 入口打包成一段自包含的 IIFE 脚本。 */
async function bundleScript() {
  const result = await build({
    stdin: {
      contents: ENTRY_SOURCE,
      resolveDir: projectRoot,
      sourcefile: 'preview-entry.tsx',
      loader: 'tsx',
    },
    absWorkingDir: projectRoot,
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    jsx: 'automatic',
    tsconfig: TSCONFIG_FILE,
    minify: true,
    legalComments: 'inline',
    charset: 'utf8',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    // 预览页必须是单文件，任何被引用的位图/字体都以 data URL 内联。
    loader: {
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.webp': 'dataurl',
      '.avif': 'dataurl',
      '.ico': 'dataurl',
      '.svg': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.ttf': 'dataurl',
      '.otf': 'dataurl',
      '.eot': 'dataurl',
    },
    logLevel: 'info',
  });

  const output = result.outputFiles?.[0];
  if (!output) {
    throw new Error('esbuild 未产出任何 JS 输出');
  }
  return output.text;
}

/** 用 PostCSS + Tailwind 编译真实的 globals.css。 */
async function compileStyles() {
  const source = await readFile(CSS_FILE, 'utf8');
  const result = await postcss([tailwindcss({ base: projectRoot, optimize: false })]).process(
    source,
    {
      from: CSS_FILE,
      to: CSS_FILE,
      map: false,
    },
  );

  for (const warning of result.warnings()) {
    console.warn(`[css] ${warning.toString()}`);
  }
  return result.css;
}

function renderHtml({ script, style, title }) {
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data:',
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtmlText(title)}</title>
<style>${escapeForInlineTag(style, 'style')}</style>
</head>
<body>
<div id="root"></div>
<script>${escapeForInlineTag(script, 'script')}</script>
</body>
</html>
`;
}

function formatSize(bytes) {
  return `${bytes} B (${(bytes / 1024).toFixed(1)} KiB)`;
}

async function main() {
  if (!(await fileExists(ENTRY_FILE))) {
    throw new Error(
      `预览入口尚未就绪：${ENTRY_FILE}\n` +
        `该文件需具名导出 FoundationPreview。请先补齐入口再运行本脚本。`,
    );
  }
  if (!(await fileExists(CSS_FILE))) {
    throw new Error(`缺少样式文件：${CSS_FILE}`);
  }

  console.log(`[preview] 工程根目录 ${projectRoot}`);

  const script = await bundleScript();
  console.log(`[preview] JS 产物 ${formatSize(Buffer.byteLength(script, 'utf8'))}`);

  const style = await compileStyles();
  console.log(`[preview] CSS 产物 ${formatSize(Buffer.byteLength(style, 'utf8'))}`);

  const html = renderHtml({ script, style, title: '界面预览 · 模型服务' });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, html, 'utf8');

  const { size } = await stat(OUT_FILE);
  console.log(`[preview] 输出路径 ${OUT_FILE}`);
  console.log(`[preview] 输出大小 ${formatSize(size)}`);
}

main().catch((error) => {
  console.error('[preview] 构建失败');
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
