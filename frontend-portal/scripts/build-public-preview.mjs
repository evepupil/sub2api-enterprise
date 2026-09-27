/**
 * M1 官网离线预览打包脚本。
 *
 * 把 src/preview/public-preview.tsx 的具名导出 PublicPreview（与正式页面共用
 * 同一套视图组件和 fixture）打包成单个自包含 HTML 文件 .preview/public.html：
 * JS（esbuild，IIFE）与 CSS（PostCSS + Tailwind，编译真实 src/styles/globals.css）
 * 全部内联。
 *
 * 特性：
 * - 工程根目录由 import.meta.url 推导，与调用时的 cwd 无关。
 * - 单文件构建，不启动服务器、不监听端口、不用浏览器、不调用任何模型 API。
 * - 视图里以字符串形式引用的确定资源（首页示意图、厂家标志）在 JS 产物里
 *   按字符串替换为本地文件的 data URL，保证离线可加载；只做字符串替换，
 *   不执行资源、不解析或改写其他内容。
 * - 输出为 UTF-8 中文页面，带严格 CSP（无 HTTP、无外部连接），无任何外部资源依赖。
 *
 * 用法：node scripts/build-public-preview.mjs
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

const ENTRY_MODULE = './src/preview/public-preview';
const ENTRY_FILE = path.join(projectRoot, 'src', 'preview', 'public-preview.tsx');
const CSS_FILE = path.join(projectRoot, 'src', 'styles', 'globals.css');
const TSCONFIG_FILE = path.join(projectRoot, 'tsconfig.json');
const PUBLIC_DIR = path.join(projectRoot, 'public');
const OUT_DIR = path.join(projectRoot, '.preview');
const OUT_FILE = path.join(OUT_DIR, 'public.html');

/**
 * 视图中以字符串形式出现的确定资源路径 → 本地文件。
 * 只有这些固定路径会被替换，不做通配或运行时解析。
 */
const INLINE_ASSETS = [
  {
    specifier: '/illustrations/dashboard-preview.png',
    file: 'illustrations/dashboard-preview.png',
  },
  { specifier: '/providers/openai.svg', file: 'providers/openai.svg' },
  { specifier: '/providers/anthropic.svg', file: 'providers/anthropic.svg' },
  { specifier: '/providers/google.svg', file: 'providers/google.svg' },
];

/** 预览页入口：挂载 PublicPreview 到 #root。 */
const ENTRY_SOURCE = [
  "import { createRoot } from 'react-dom/client';",
  `import { PublicPreview } from '${ENTRY_MODULE}';`,
  '',
  "const container = document.getElementById('root');",
  'if (!container) {',
  "  throw new Error('预览页缺少 #root 挂载点');",
  '}',
  'createRoot(container).render(<PublicPreview />);',
  '',
].join('\n');

const MIME_TYPES = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

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
      sourcefile: 'public-preview-entry.tsx',
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
    // 被 import 引用的位图/字体同样内联；字符串形式的公开路径由下方替换处理。
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

/**
 * 把 JS 产物里固定资源字符串替换为本地文件的 data URL。
 * 只做字面量替换，不执行、不解析被替换的内容。
 */
async function inlineAssetStrings(script) {
  let output = script;
  for (const asset of INLINE_ASSETS) {
    const count = output.split(asset.specifier).length - 1;
    if (count === 0) {
      console.warn(`[assets] 未在产物中找到 ${asset.specifier}，跳过（对应视图可能尚未落地）`);
      continue;
    }
    const absolute = path.join(PUBLIC_DIR, asset.file);
    if (!(await fileExists(absolute))) {
      throw new Error(`缺少资源文件：${absolute}（被 ${asset.specifier} 引用）`);
    }
    const extension = path.extname(absolute).toLowerCase();
    const mime = MIME_TYPES[extension];
    if (!mime) {
      throw new Error(`未登记的资源类型：${extension}（${absolute}）`);
    }
    const data = await readFile(absolute);
    const dataUrl = `data:${mime};base64,${data.toString('base64')}`;
    output = output.split(asset.specifier).join(dataUrl);
    console.log(`[assets] ${asset.specifier} → data URL（${data.byteLength} B，替换 ${count} 处）`);
  }
  return output;
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
        `该文件需具名导出 PublicPreview。请先补齐入口再运行本脚本。`,
    );
  }
  if (!(await fileExists(CSS_FILE))) {
    throw new Error(`缺少样式文件：${CSS_FILE}`);
  }

  console.log(`[preview] 工程根目录 ${projectRoot}`);

  const rawScript = await bundleScript();
  const script = await inlineAssetStrings(rawScript);
  console.log(`[preview] JS 产物 ${formatSize(Buffer.byteLength(script, 'utf8'))}`);

  const style = await compileStyles();
  console.log(`[preview] CSS 产物 ${formatSize(Buffer.byteLength(style, 'utf8'))}`);

  const html = renderHtml({ script, style, title: '官网预览 · 模型服务' });

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
