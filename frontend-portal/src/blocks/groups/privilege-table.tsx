import { ArrowRight, Check, Minus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { buttonClass } from '@/components/ui/button-styles';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { Link } from '@/i18n/navigation';
import {
  EDITIONS,
  localize,
  PRIVILEGE_ROWS,
  type EditionId,
  type PrivilegeCell,
} from '@/lib/catalog';
import { cn } from '@/lib/utils';

/** 重点通道（专用通道）那一列整列铺 muted 底色，表头圆上角、最后一行圆下角 */
const COL_CELL = 'bg-muted';

function CellValue({ value }: { value: PrivilegeCell }) {
  const t = useTranslations('groups');
  const locale = useLocale();

  if (typeof value === 'boolean') {
    // 布尔格画图标，文字进 sr-only 给读屏软件
    return value ? (
      <>
        <Check className="mx-auto size-4 text-foreground" aria-hidden />
        <span className="sr-only">{t('compare.included')}</span>
      </>
    ) : (
      <>
        <Minus className="mx-auto size-4 text-subtle-foreground" aria-hidden />
        <span className="sr-only">{t('compare.excluded')}</span>
      </>
    );
  }
  return <span className="tabular-nums text-muted-foreground">{localize(value, locale)}</span>;
}

/** 通道特权对比：逐行对比三种通道的权益（不含倍率），重点通道（与通道卡的深色卡一致）整列高亮。 */
export function PrivilegeTable() {
  const t = useTranslations('groups');
  const common = useTranslations('common');
  const locale = useLocale();
  const highlighted = EDITIONS.find((e) => e.featured)?.id;
  const editionIds: readonly EditionId[] = EDITIONS.map((e) => e.id);
  const lastRowId = PRIVILEGE_ROWS[PRIVILEGE_ROWS.length - 1]?.id;

  return (
    <section id="compare" className="py-20 md:py-28">
      <Container>
        <SectionHeading title={t('compare.title')} />
        <div className="relative mt-12 overflow-x-auto">
          <table data-privilege-table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="w-2/5" />
                {editionIds.map((id) => {
                  const meta = EDITIONS.find((e) => e.id === id);
                  const name = meta ? localize(meta.name, locale) : id;
                  return (
                    <th
                      key={id}
                      scope="col"
                      data-edition-col={id}
                      data-selected={id === highlighted ? 'true' : 'false'}
                      className={cn(
                        'px-4 pb-4 pt-5 text-center text-base font-semibold text-foreground',
                        id === highlighted && 'rounded-t-xl bg-muted',
                      )}
                    >
                      {name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PRIVILEGE_ROWS.map((row) => (
                <tr key={row.id} data-privilege-row={row.id} className="border-t border-border">
                  <th scope="row" className="py-4 pr-4 text-left font-normal text-foreground">
                    {localize(row.label, locale)}
                  </th>
                  {editionIds.map((id) => (
                    <td
                      key={id}
                      className={cn(
                        'px-4 py-4 text-center',
                        id === highlighted && COL_CELL,
                        id === highlighted && row.id === lastRowId && 'rounded-b-xl',
                      )}
                    >
                      <CellValue value={row.values[id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/pricing" className={buttonClass({ variant: 'secondary' })}>
            {common('actions.viewPricing')}
            <ArrowRight />
          </Link>
        </div>
      </Container>
    </section>
  );
}
