import { useTranslations } from 'next-intl';

/** 价目表上方的单位说明：价格都是美元 / 百万 Token（生图另注）。 */
export function CurrencyNote() {
  const t = useTranslations('pricing');

  return (
    <p data-currency-note className="text-xs text-subtle-foreground">
      {t('tables.unitUsd')}
    </p>
  );
}
