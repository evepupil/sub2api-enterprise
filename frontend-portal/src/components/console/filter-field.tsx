import { Search } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** 筛选项：上方一行小标签，下方是控件。控件是输入框时传 htmlFor 关联标签。 */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const labelClass = 'block text-xs font-medium text-muted-foreground';
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {children}
    </div>
  );
}

/** 带放大镜图标的搜索框 */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, ...props }, ref) {
    return (
      <div className={cn('relative min-w-0', className)}>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground"
        />
        <Input ref={ref} type="search" autoComplete="off" className="pl-9" {...props} />
      </div>
    );
  },
);
