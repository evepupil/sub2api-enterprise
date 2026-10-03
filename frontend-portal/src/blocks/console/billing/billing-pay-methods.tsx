'use client';

import { CreditCard, MessageCircle, Wallet, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, type KeyboardEvent } from 'react';

import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/console';
import { cn } from '@/lib/utils';

const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  alipay: Wallet,
  wechat: MessageCircle,
  stripe: CreditCard,
};

/** 选中与未选中的卡片样式，按状态映射，不拼接类名 */
const CARD = {
  on: 'border-foreground bg-muted',
  off: 'border-border bg-card hover:bg-muted',
} as const;

/**
 * 支付方式单选卡：三张卡片组成一个单选组，Tab 只停在选中的那张，
 * 方向键在卡片之间切换并把焦点跟过去。
 */
export function BillingPayMethods({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  const t = useTranslations('consoleBilling');
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: 1 | -1) => {
    const total = PAYMENT_METHODS.length;
    const nextIndex = (from + step + total) % total;
    const next = PAYMENT_METHODS[nextIndex];
    if (!next) return;
    onChange(next);
    itemRefs.current[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    }
  };

  return (
    <div role="radiogroup" aria-label={t('recharge.method')} className="grid gap-2 sm:grid-cols-3">
      {PAYMENT_METHODS.map((method, index) => {
        const selected = method === value;
        const Icon = METHOD_ICONS[method];
        return (
          <button
            key={method}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            data-pay-method={method}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(method)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'flex h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-foreground transition-colors',
              selected ? CARD.on : CARD.off,
            )}
          >
            <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{t(`methods.${method}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
