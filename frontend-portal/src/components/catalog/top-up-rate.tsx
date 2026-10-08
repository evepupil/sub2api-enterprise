import { useTranslations } from 'next-intl';

/**
 * 充值比例小字「充值 1 元 = 1 美元」：价格都写美元，放在模型页、价格页页首，
 * 免得访客只看到美元价就被劝退（2026-10-08 用户要求）。比例本身加粗。
 */
export function TopUpRate() {
  const t = useTranslations('common');
  return t.rich('units.topUpRate', {
    b: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
  });
}

export default TopUpRate;
