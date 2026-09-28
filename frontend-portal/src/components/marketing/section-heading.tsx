import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * 营销区块标题：eyebrow（可选）+ 语义 h2 标题 + 说明（可选）。
 *
 * 契约来源：design/proactiv-redesign.md 第 3 节。
 * 无客户端依赖，服务端组件可直接渲染；标题层级固定为 h2，页面 h1 由 hero 提供。
 * align 只控制标题块的居中/左对齐；在宽屏下由 CSS 决定操作区与标题的排布。
 */
export interface SectionHeadingProps extends React.ComponentProps<'div'> {
  /** 小标签，如“平台能力”“客户故事”；省略时不渲染该行。 */
  eyebrow?: string;
  /** 区块标题，必填，渲染为语义 h2。 */
  title: string;
  /** 一段说明，省略时不渲染。 */
  description?: string;
  /** 对齐方式，默认左对齐；居中用于平台能力等对称区块。 */
  align?: 'left' | 'center';
  /** 关联的区块 id（用于 aria-labelledby），同时写入标题元素。 */
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  id,
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      data-slot="section-heading"
      data-align={align}
      className={cn('marketing-section-heading', className)}
      {...props}
    >
      {eyebrow !== undefined && eyebrow !== '' ? (
        <p className="marketing-eyebrow">{eyebrow}</p>
      ) : null}
      <h2 id={id} className="max-w-full break-words">
        {title}
      </h2>
      {description !== undefined && description !== '' ? <p>{description}</p> : null}
    </div>
  );
}
