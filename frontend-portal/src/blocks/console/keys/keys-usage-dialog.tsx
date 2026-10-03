'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { CopyButton } from '@/components/console/copy-button';
import { Dialog } from '@/components/console/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';

import type { KeyRow } from './keys-model';
import { buildSnippet, SNIPPET_KINDS, type SnippetKind } from './keys-snippets';

/**
 * 接入示例弹窗，只在打开时挂载：Claude Code、Codex CLI、curl 三种写法，
 * 代码里的密钥一律是这一行的完整密钥（不受列表里「显示 / 隐藏」影响），一键复制整段。
 */
export function KeysUsageDialog({ row, onClose }: { row: KeyRow; onClose: () => void }) {
  const t = useTranslations('consoleKeys');
  const [kind, setKind] = useState<SnippetKind>('claude');
  const code = buildSnippet(kind, row.secret);

  return (
    <Dialog
      id="key-usage"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      title={<span className="break-words">{t('usage.title', { name: row.name })}</span>}
    >
      <div className="space-y-4">
        <SegmentedControl
          name="key-snippet"
          value={kind}
          onChange={setKind}
          ariaLabel={t('usage.clientLabel')}
          options={SNIPPET_KINDS.map((value) => ({ value, label: t(`usage.${value}`) }))}
        />
        <div className="relative">
          {/* 代码超出宽度时在框内横向滚动，给键盘用户一个焦点才能滚得动 */}
          <pre
            tabIndex={0}
            className="overflow-x-auto rounded-xl bg-muted p-4 pr-12 font-mono text-xs text-foreground"
          >
            <code>{code}</code>
          </pre>
          <CopyButton
            name="key-snippet"
            value={code}
            label={t('usage.copy')}
            className="absolute right-2 top-2"
          />
        </div>
      </div>
    </Dialog>
  );
}
