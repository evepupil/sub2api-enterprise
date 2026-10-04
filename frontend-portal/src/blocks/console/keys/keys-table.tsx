'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Table, TableShell, Th } from '@/components/console/data-table';
import type { LiveKey } from '@/lib/console/live/keys-types';

import { KeysRow, type KeysRowHandlers } from './keys-row';

/** 密钥表：整张表最小 1020 宽，小屏横向滚动，操作列固定在右侧 */
export function KeysTable({
  rows,
  revealed,
  busy,
  footer,
  handlers,
}: {
  /** 当前页的行 */
  rows: readonly LiveKey[];
  /** 正在显示完整密钥的行 */
  revealed: ReadonlySet<number>;
  /** 正在暂停 / 启用 / 删除的行，按钮先不让点 */
  busy: ReadonlySet<number>;
  footer: ReactNode;
  /** 每一行的操作，按密钥 ID 生成 */
  handlers: (row: LiveKey) => KeysRowHandlers;
}) {
  const t = useTranslations('consoleKeys');
  const tc = useTranslations('console');
  return (
    <TableShell id="keys" footer={footer}>
      <Table minWidth={1020}>
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
            <KeysRow
              key={row.id}
              row={row}
              revealed={revealed.has(row.id)}
              busy={busy.has(row.id)}
              {...handlers(row)}
            />
          ))}
        </tbody>
      </Table>
    </TableShell>
  );
}
