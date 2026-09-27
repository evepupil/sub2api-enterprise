'use client';

import { useEffect, useRef, useState } from 'react';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { paymentReturnUrl } from './payment-redirect';

/** 单次 Stripe 会话状态；key 变化表示换了一组 client_secret/key/订单，需要重新初始化。 */
interface StripeSession {
  key: string;
  ready: boolean;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  submitted: boolean;
}

function newSession(key: string): StripeSession {
  return { key, ready: false, loading: true, submitting: false, error: null, submitted: false };
}

export interface StripePaymentInlineProps {
  /** 后端返回的 PaymentIntent client_secret；只在本组件内存中使用，不落盘、不打印。 */
  clientSecret: string;
  /** Stripe 可公开的 publishable key；为空时由调用方阻止进入本组件。 */
  publishableKey: string;
  orderId: number;
  /** 支付动作结束（提交成功或用户完成跳转前）时触发，仅用于查询订单状态。 */
  onCheck: () => void;
}

/**
 * Stripe Payment Element 内嵌付款。
 *
 * 契约来源：旧 frontend/src/components/payment/StripePaymentInline.vue 的
 * loadStripe + elements + Payment Element + confirmPayment 分支，以及
 * design/console-pages.md 余额与订单章节。
 *
 * 边界：
 * - client_secret 只在组件内存中传给 Stripe SDK，不写入 storage、不打印日志。
 * - confirmPayment 使用 redirect: 'if_required'，return_url 由 paymentReturnUrl 生成，
 *   固定当前站点 /payment/result?order_id=<id>。
 * - 结果只回调 onCheck 触发订单状态查询，不显示“已到账”，到账以服务端为准。
 * - 有效性判定用「每次 effect 新建的局部 token」比较引用，而不是共享的可重置布尔值：
 *   旧会话即便后来换回同一 key 也不会重新变“有效”。清理只销毁本 effect 创建的 Element；
 *   迟到的异步结果既不写 ref、也不改状态。confirmPayment 完成后还要核对 token 与操作代次，
 *   换单或卸载后不再 setState、不再 onCheck。
 */
export function StripePaymentInline({
  clientSecret,
  publishableKey,
  orderId,
  onCheck,
}: StripePaymentInlineProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const elementRef = useRef<StripePaymentElement | null>(null);
  /** 当前生效会话的局部 token；只有创建它的 effect 能写入，卸载/换会话时置空。 */
  const liveRef = useRef<{ key: string } | null>(null);
  /** 提交操作代次：新一次提交或会话切换都会让旧提交失效。 */
  const opRef = useRef(0);

  const sessionKey = `${clientSecret}\u0000${publishableKey}\u0000${orderId}`;
  const [session, setSession] = useState<StripeSession>(() => newSession(sessionKey));
  // 换订单或换 client_secret 时在渲染期同步重置本地状态，不触发额外副作用。
  if (session.key !== sessionKey) {
    setSession(newSession(sessionKey));
  }

  function patchSession(key: string, patch: Partial<Omit<StripeSession, 'key'>>) {
    setSession((prev) => (prev.key === key ? { ...prev, ...patch } : prev));
  }

  useEffect(() => {
    let cancelled = false;
    let localElement: StripePaymentElement | null = null;
    // 本次 effect 独有的 token：即使之后又挂载出同样 key 的会话，旧 token 也永远不会再有效。
    const token = { key: sessionKey };
    liveRef.current = token;
    const isCurrent = () => liveRef.current === token;
    opRef.current += 1;

    void (async () => {
      try {
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(publishableKey);
        // 迟到的加载结果：本 effect 已清理，直接丢弃，不写 ref、不改状态。
        if (cancelled || !isCurrent()) {
          return;
        }
        if (stripe === null) {
          patchSession(token.key, {
            loading: false,
            error: '支付组件加载失败，请稍后重试或改用其他付款方式',
          });
          return;
        }

        const elements = stripe.elements({
          clientSecret,
          locale: 'zh',
          appearance: { theme: 'stripe' },
        });
        const element = elements.create('payment', { layout: 'tabs' });
        localElement = element;
        element.on('ready', () => {
          if (isCurrent()) {
            patchSession(token.key, { ready: true, loading: false });
          }
        });

        // 到这里没有 await，创建与挂载属于同一同步段，不会跨代次。
        stripeRef.current = stripe;
        elementsRef.current = elements;
        elementRef.current = element;
        if (mountRef.current !== null) {
          element.mount(mountRef.current);
        }
      } catch {
        if (isCurrent()) {
          patchSession(token.key, {
            loading: false,
            error: '支付组件加载失败，请稍后重试或改用其他付款方式',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      if (liveRef.current === token) {
        liveRef.current = null;
      }
      // 只销毁本 effect 创建的 Element，不动可能已换代的 ref。
      localElement?.destroy();
      if (elementRef.current === localElement) {
        elementRef.current = null;
      }
      elementsRef.current = null;
      stripeRef.current = null;
    };
  }, [clientSecret, publishableKey, orderId, sessionKey]);

  async function handleConfirm() {
    const token = liveRef.current;
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (session.submitting || token === null || stripe === null || elements === null) {
      return;
    }
    const op = opRef.current + 1;
    opRef.current = op;
    // 只有「本会话仍然生效」且「没有更新的提交」时，异步结果才允许写状态。
    const isCurrent = () => liveRef.current === token && opRef.current === op;
    patchSession(token.key, { submitting: true, error: null });
    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: paymentReturnUrl(orderId) },
        redirect: 'if_required',
      });
      // 卸载、换单或已有更新的提交时不再改状态、不再触发查询。
      if (!isCurrent()) {
        return;
      }
      if (result.error !== undefined) {
        patchSession(token.key, {
          error: result.error.message ?? '支付未完成，请重试或更换支付方式',
        });
        return;
      }
      // 提交成功不代表到账，只提示已提交并触发订单状态查询。
      patchSession(token.key, { submitted: true });
      onCheck();
    } catch {
      if (isCurrent()) {
        patchSession(token.key, { error: '支付请求失败，请稍后重试或改用其他付款方式' });
      }
    } finally {
      if (isCurrent()) {
        patchSession(token.key, { submitting: false });
      }
    }
  }

  return (
    <div className="space-y-4">
      {session.error !== null ? <Alert variant="destructive" title={session.error} /> : null}
      {session.submitted ? (
        <Alert title="已提交支付" description="正在查询订单状态，到账以订单状态为准。" />
      ) : null}
      <div ref={mountRef} className="min-h-48" />
      {session.loading && session.error === null ? <Skeleton className="h-10 w-full" /> : null}
      <Button
        type="button"
        className="w-full"
        loading={session.submitting}
        disabled={!session.ready || session.submitted}
        onClick={handleConfirm}
      >
        {session.submitting ? '支付处理中' : '确认支付'}
      </Button>
    </div>
  );
}
