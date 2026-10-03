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
  // 控制台的按钮统一 6px 小圆角：控制台代码只能从 @/components/console/button 取按钮，官网的胶囊按钮不准直接用。
  // 模型页正在重写（接后端），重写时把按钮换成控制台入口，再删掉下面 ignores 里的模型页。
  {
    files: ['src/blocks/console/**', 'src/components/console/**'],
    ignores: ['src/components/console/button.tsx', 'src/blocks/console/models/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/components/ui/button',
              message: '控制台的按钮从 @/components/console/button 取（统一 6px 圆角）',
            },
            {
              name: '@/components/ui/button-styles',
              message: '控制台的按钮样式从 @/components/console/button 取（统一 6px 圆角）',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
