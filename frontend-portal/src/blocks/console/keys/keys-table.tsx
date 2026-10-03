'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Table, TableShell, Th } from '@/components/console/data-table';

import { KeysRow, type KeysRowHandlers } from './keys-row';
import type { KeyRow } from './keys-model';

/** 密钥表：整张表最小 1100 宽，小屏横向滚动，操作列固定在右侧 */
export function KeysTable({
  rows,
  revealed,
  footer,
  handlers,
}: {
  /** 当前页的行 */
  rows: readonly KeyRow[];
  /** 正在显示完整密钥的行 */
  revealed: ReadonlySet<string>;
  footer: ReactNode;
  /** 每一行的操作，按密钥编号生成 */
  handlers: (row: KeyRow) => KeysRowHandlers;
}) {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  return (
    <TableShell id="keys" footer={footer}>
      <Table minWidth={1100}>
        <thead>
          <tr>
            <Th>{t('table.name')}</Th>
            <Th>{t('table.secret')}</Th>
            <Th>{t('table.group')}</Th>
            <Th>{t('table.status')}</Th>
            <Th>{t('table.usage')}</Th>
            <Th>{t('table.quota')}</Th>
            <Th>{t('table.expiry')}</Th>
            <Th sticky="right" align="right">
              {tc('table.actions')}
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <KeysRow key={row.id} row={row} revealed={revealed.has(row.id)} {...handlers(row)} />
          ))}
        </tbody>
      </Table>
    </TableShell>
  );
}
