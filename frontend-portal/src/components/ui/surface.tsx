'use client';

import * as React from 'react';

/**
 * 界面区域标记：控制台外壳提供 "console"，其余页面没有区域标记。
 *
 * 弹窗、下拉、气泡层经 Portal 挂到 body，脱离了控制台外壳的元素树；
 * 这些内容组件读取本上下文，把同样的 data-surface 写到自己的根元素上，
 * 控制台专属样式（styles/console.css，以 [data-surface='console'] 为作用域）才能覆盖到弹层内部。
 */
export type SurfaceArea = 'console';

const SurfaceContext = React.createContext<SurfaceArea | undefined>(undefined);

export function SurfaceProvider({
  area,
  children,
}: {
  area: SurfaceArea;
  children: React.ReactNode;
}) {
  return <SurfaceContext.Provider value={area}>{children}</SurfaceContext.Provider>;
}

/** 当前所在界面区域；不在任何区域内时为 undefined。 */
export function useSurfaceArea(): SurfaceArea | undefined {
  return React.useContext(SurfaceContext);
}
