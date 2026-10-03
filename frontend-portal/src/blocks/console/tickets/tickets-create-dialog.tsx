'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Dialog } from '@/components/console/dialog';
import { Select, type SelectOption } from '@/components/console/select';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TICKET_CATEGORIES, TICKET_LIMITS, type Ticket, type TicketCategory } from '@/lib/console';

import {
  buildTicket,
  EMPTY_TICKET_DRAFT,
  REQUEST_ID_PREFIX,
  TICKET_DRAFT_FIELDS,
  validateTicketDraft,
  type TicketDraft,
  type TicketDraftErrors,
  type TicketDraftField,
} from './tickets-logic';

/** 提交后的加载时长，结束后新工单才出现在列表里（后端未接，只在本页内存里加一条） */
const SUBMIT_DELAY_MS = 1000;

/** 提交按钮在弹窗底部、表单在弹窗主体，靠 form 属性把两者连起来，输入框里按回车也能提交 */
const FORM_ID = 'new-ticket-form';

/** 每个会出错的字段对应的输入框 id：校验失败后把焦点放到第一个出错的输入框上 */
const FIELD_IDS: Record<TicketDraftField, string> = {
  subject: 'ticket-subject',
  requestId: 'ticket-request',
  body: 'ticket-body',
};

/**
 * 新建工单弹窗。父级只在需要时渲染它，所以每次打开都是一份全新的空白表单。
 * 校验不过时所有出错字段同时标红、焦点落第一个；通过后加载 1 秒，生成新工单交给页面。
 * 提交中不允许关闭弹窗，避免用户以为取消了、工单却被创建出来。
 */
export function TicketsCreateDialog({
  tickets,
  onClose,
  onCreated,
}: {
  /** 现有工单，用来算新工单的编号 */
  tickets: readonly Ticket[];
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}) {
  const t = useTranslations('consoleTickets');
  const tc = useTranslations('console');
  const [draft, setDraft] = useState<TicketDraft>(EMPTY_TICKET_DRAFT);
  const [errors, setErrors] = useState<TicketDraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  // 卸载时清掉还没走完的提交定时器
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  /** 输入即清掉该字段的错误，其他字段的错误保持不变 */
  const setText = (field: TicketDraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const found = validateTicketDraft(draft);
    const firstField = TICKET_DRAFT_FIELDS.find((field) => found[field]);
    if (firstField) {
      setErrors(found);
      document.getElementById(FIELD_IDS[firstField])?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      onCreated(buildTicket(draft, tickets));
    }, SUBMIT_DELAY_MS);
  };

  const errorText = (field: TicketDraftField): string | null => {
    const code = errors[field];
    if (!code) return null;
    return t(`form.errors.${code}`, {
      max: TICKET_LIMITS.subjectMax,
      min: TICKET_LIMITS.bodyMin,
      prefix: REQUEST_ID_PREFIX,
    });
  };

  const describedBy = (field: TicketDraftField) =>
    errors[field] ? `${FIELD_IDS[field]}-error` : undefined;

  const categoryOptions: SelectOption<TicketCategory>[] = TICKET_CATEGORIES.map((category) => ({
    value: category,
    label: t(`category.${category}`),
  }));

  return (
    <Dialog
      initialFocus="ticket-subject"
      id="new-ticket"
      open
      onOpenChange={(open) => {
        if (!open && !submitting) onClose();
      }}
      title={t('form.title')}
      footer={
        <>
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            {tc('actions.cancel')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={submitting} data-ticket-submit>
            {t('form.submit')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('form.subject')} htmlFor={FIELD_IDS.subject} error={errorText('subject')}>
          <Input
            id={FIELD_IDS.subject}
            autoComplete="off"
            readOnly={submitting}
            value={draft.subject}
            onChange={(event) => setText('subject', event.target.value)}
            aria-invalid={errors.subject ? true : undefined}
            aria-describedby={describedBy('subject')}
          />
        </Field>

        {/* 下拉的触发按钮没有 id，这里用文字标签加 aria-label，不用指向它的 <label> */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('form.category')}</p>
          <Select
            name="ticket-category"
            value={draft.category}
            onChange={(category) => setDraft((current) => ({ ...current, category }))}
            options={categoryOptions}
            ariaLabel={t('form.category')}
            disabled={submitting}
          />
        </div>

        <Field
          label={t('form.request')}
          htmlFor={FIELD_IDS.requestId}
          error={errorText('requestId')}
        >
          <Input
            id={FIELD_IDS.requestId}
            autoComplete="off"
            readOnly={submitting}
            placeholder={t('form.requestPlaceholder')}
            value={draft.requestId}
            onChange={(event) => setText('requestId', event.target.value)}
            aria-invalid={errors.requestId ? true : undefined}
            aria-describedby={describedBy('requestId')}
            className="font-mono"
          />
        </Field>

        <Field label={t('form.body')} htmlFor={FIELD_IDS.body} error={errorText('body')}>
          {/* 字数在输入框右下角的底栏里：输入区滚动时文字不会压到字数上 */}
          <Textarea
            id={FIELD_IDS.body}
            rows={6}
            maxLength={TICKET_LIMITS.bodyMax}
            readOnly={submitting}
            value={draft.body}
            onChange={(event) => setText('body', event.target.value)}
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={describedBy('body')}
            className="resize-y"
            footer={
              <span aria-hidden>
                {t('form.counter', { count: draft.body.length, max: TICKET_LIMITS.bodyMax })}
              </span>
            }
          />
        </Field>
      </form>
    </Dialog>
  );
}
