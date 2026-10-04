'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Columns3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button, buttonClass } from '@/components/console/button';
import { CONTROL_BUTTON } from '@/components/console/control-button';
import { cn } from '@/lib/utils';

export interface ColumnOption<T extends string> {
  id: T;
  label: string;
  /** 不能取消的列（如时间），勾选框勾着、置灰 */
  locked?: boolean;
}

/**
 * 表格的「列设置」：按钮点开一张勾选列表，勾好点「保存」才生效；「重置」把勾选回到默认（也要点保存），
 * 不保存直接关掉就不变。和筛选控件排在同一行，按钮高 40。
 * 交互检查：按钮 data-column-picker={name}，面板 data-column-panel={name}，勾选框 data-column={列}，
 * 重置 data-columns-reset，保存 data-columns-save。
 */
export function ColumnPicker<T extends string>({
  name,
  columns,
  visible,
  defaults,
  onSave,
}: {
  name: string;
  /** 所有可选的列，按表格顺序 */
  columns: readonly ColumnOption<T>[];
  /** 现在显示的列 */
  visible: readonly T[];
  defaults: readonly T[];
  onSave: (visible: T[]) => void;
}) {
  const t = useTranslations('console');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<readonly T[]>(visible);

  const handleOpenChange = (next: boolean) => {
    // 每次打开都从现在的设置开始勾
    if (next) setDraft(visible);
    setOpen(next);
  };
  const toggle = (id: T) =>
    setDraft((current) =>
      current.includes(id) ? current.filter((column) => column !== id) : [...current, id],
    );
  const save = () => {
    onSave(
      columns
        .filter((column) => column.locked === true || draft.includes(column.id))
        .map((column) => column.id),
    );
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          data-column-picker={name}
          className={buttonClass({ variant: 'secondary', className: CONTROL_BUTTON })}
        >
          <Columns3 aria-hidden />
          {t('table.columns')}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          data-column-panel={name}
          className="z-50 w-56 rounded-xl border border-border bg-card p-1.5 text-foreground shadow-card"
        >
          <fieldset>
            <legend className="sr-only">{t('table.columns')}</legend>
            {columns.map((column) => {
              const locked = column.locked === true;
              return (
                <label
                  key={column.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm',
                    locked ? 'text-subtle-foreground' : 'cursor-pointer hover:bg-muted',
                  )}
                >
                  <input
                    type="checkbox"
                    data-column={column.id}
                    className="size-4 accent-[var(--foreground)]"
                    checked={locked || draft.includes(column.id)}
                    disabled={locked}
                    onChange={() => toggle(column.id)}
                  />
                  {column.label}
                </label>
              );
            })}
          </fieldset>
          <div className="mt-1.5 flex justify-end gap-2 border-t border-border px-1 pb-0.5 pt-2">
            <Button variant="ghost" size="sm" data-columns-reset onClick={() => setDraft(defaults)}>
              {t('actions.reset')}
            </Button>
            <Button size="sm" data-columns-save onClick={save}>
              {t('actions.save')}
            </Button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
