import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', '.next-build/**', 'out/**', 'build/**', '.preview/**', 'next-env.d.ts'],
  },
  // 本项目一律使用原生 <img>
  { rules: { '@next/next/no-img-element': 'off' } },
  // 根目录的 not-found.tsx 在语言路由之外，只能用原生 <a href="/"> 回首页。
  // 该规则会把 [locale] 动态目录误判成「匹配 /」，所以只对这一个文件关掉。
  { files: ['src/app/not-found.tsx'], rules: { '@next/next/no-html-link-for-pages': 'off' } },
];

export default eslintConfig;
