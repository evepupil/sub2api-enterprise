import { Badge } from '@/components/ui/badge';
import type { AppLocale } from '@/i18n/routing';
import { formatDiscount } from '@/lib/catalog';

/** 折扣标：中文「3折」，英文「70% off」。不打折时不显示。 */
export function DiscountBadge({
  discount,
  locale,
  className,
}: {
  discount: number | null;
  locale: AppLocale;
  className?: string;
}) {
  const text = formatDiscount(discount, locale);
  if (!text) return null;
  return (
    <Badge tone="success" data-discount className={className}>
      {text}
    </Badge>
  );
}
