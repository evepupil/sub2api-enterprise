'use client';

import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { DateRange } from 'react-day-picker';
import type { PreviewKey } from './fixtures';
import { DateRangePreview } from './date-range-preview';
import { FeedbackPreview } from './feedback-preview';
import { KeyDialogPreview } from './key-dialog-preview';
import { KeysPreviewTable } from './keys-preview-table';

export function ComponentsPreview({
  rows,
  onKeyCreate,
  dateRange,
  onDateRangeChange,
}: {
  rows: readonly PreviewKey[];
  onKeyCreate: (name: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}) {
  const [lastButtonAction, setLastButtonAction] = useState('');

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>按钮</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setLastButtonAction('保存控件已触发，未保存数据')}>保存</Button>
            <Button variant="outline" onClick={() => setLastButtonAction('取消控件已触发')}>
              取消
            </Button>
            <Button variant="ghost" onClick={() => setLastButtonAction('查看更多控件已触发')}>
              查看更多
            </Button>
            <Button
              variant="destructive"
              onClick={() => setLastButtonAction('删除控件已触发，未执行业务操作')}
            >
              删除
            </Button>
            <Button loading>保存中</Button>
            <Button disabled>不可操作</Button>
          </div>
          {lastButtonAction ? (
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {lastButtonAction}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>表单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="sample-key-name">密钥名称</Label>
            <Input id="sample-key-name" placeholder="例如：工作项目" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sample-key-group">使用分组</Label>
            <Select defaultValue="standard">
              <SelectTrigger id="sample-key-group">
                <SelectValue placeholder="选择分组" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">标准通道</SelectItem>
                <SelectItem value="team">团队通道</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sample-invalid-name">输入错误示例</Label>
            <Input
              id="sample-invalid-name"
              value=""
              readOnly
              placeholder="密钥名称"
              aria-invalid="true"
              aria-describedby="sample-name-error"
            />
            <p id="sample-name-error" className="text-sm text-destructive">
              名称不能为空
            </p>
          </div>
        </CardContent>
      </Card>

      <KeyDialogPreview onSave={onKeyCreate} />
      <DateRangePreview value={dateRange} onChange={onDateRangeChange} />

      <Card>
        <CardHeader>
          <CardTitle>表格</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <KeysPreviewTable rows={rows} />
        </CardContent>
      </Card>

      <FeedbackPreview rows={rows} />
    </div>
  );
}
