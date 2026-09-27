import type { Metadata } from 'next';

import { ConsoleFrame } from '@/features/console/console-frame';

/** 私有控制台一律不进搜索引擎，也不参与构建期静态化（身份在浏览器端核实）。 */
export const metadata: Metadata = {
  title: {
    default: '控制台',
    template: '%s · 控制台',
  },
  robots: { index: false, follow: false },
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleFrame>{children}</ConsoleFrame>;
}
