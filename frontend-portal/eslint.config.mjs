import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ['.next/**', '.next-build/**', 'out/**', 'build/**', '.preview/**', 'next-env.d.ts'],
  },
];

export default eslintConfig;
