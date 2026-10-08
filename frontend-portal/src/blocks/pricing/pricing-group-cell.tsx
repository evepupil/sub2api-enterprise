import type { ReactNode } from 'react';

import { RateBadge } from '@/components/catalog/rate-badge';
import type { SiteModel } from '@/lib/catalog/live';

/** 价目表的分组格（文本、生图两张表共用）：分组名、这个分组的倍率；children 放这个分组独有的补充（如超长上下文档单价）。 */
export function PriceGroupCell({ model, children }: { model: SiteModel; children?: ReactNode }) {
  return (
    <td data-cell="group" className="px-5 py-4 align-top">
      <div className="flex flex-wrap items-center gap-2">
        <span className="whitespace-nowrap text-foreground">{model.group.name}</span>
        <RateBadge rate={model.group.rate} />
      </div>
      {children}
    </td>
  );
}

export default PriceGroupCell;
