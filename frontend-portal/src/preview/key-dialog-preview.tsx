'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function KeyDialogPreview({ onSave }: { onSave: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [hasError, setHasError] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setSaved(false);
    if (!nextOpen) {
      setName('');
      setHasError(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setHasError(true);
      return;
    }
    onSave(trimmedName);
    setSaved(true);
    handleOpenChange(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>浮层</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button data-testid="create-preview-key">创建密钥</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>创建密钥</DialogTitle>
                <DialogDescription>此操作只保存在当前预览</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-5">
                <Label htmlFor="dialog-key-name">密钥名称</Label>
                <Input
                  autoFocus
                  id="dialog-key-name"
                  data-testid="key-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.currentTarget.value);
                    if (hasError) setHasError(false);
                  }}
                  placeholder="例如：工作项目"
                  aria-invalid={hasError}
                  aria-describedby={hasError ? 'dialog-key-name-error' : undefined}
                />
                {hasError ? (
                  <p id="dialog-key-name-error" className="text-sm text-destructive">
                    名称不能为空
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    取消
                  </Button>
                </DialogClose>
                <Button data-testid="save-preview-key" type="submit">
                  保存到预览
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {saved ? (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
            已保存到当前预览
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
