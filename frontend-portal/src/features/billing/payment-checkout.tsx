'use client';

import { toDataURL } from 'qrcode';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import type { PaymentLaunch } from './types';
import { formatBillingMoney } from './validation';
import { isWechatBrowser, paymentReturnUrl, safeExternalUrl } from './payment-redirect';
import { StripePaymentInline } from './payment-stripe';

/** 微信 JSAPI 只允许这六个字段，其余后端字段一律不传给支付桥。 */
const JSAPI_ALLOWED_KEYS = [
  'appId',
  'timeStamp',
  'nonceStr',
  'package',
  'signType',
  'paySign',
] as const;

/** 微信支付桥的最小接口；SDK 由微信客户端注入，缺失时明确报错。 */
interface WeixinJsBridge {
  invoke(
    api: string,
    params: Record<string, string>,
    callback: (result: { errMsg?: string }) => void,
  ): void;
}

function getWeixinBridge(): WeixinJsBridge | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const candidate = (window as unknown as { WeixinJSBridge?: WeixinJsBridge }).WeixinJSBridge;
  return candidate !== undefined && typeof candidate.invoke === 'function' ? candidate : null;
}

/** 展示二维码的目标像素宽度。 */
const QR_CODE_SIZE = 192;

/** 本地二维码状态；key 是内容，内容变化时重置，迟到结果按 key 丢弃。 */
interface QrState {
  key: string | null;
  dataUrl: string | null;
  failed: boolean;
}

function newQrState(key: string | null): QrState {
  return { key, dataUrl: null, failed: false };
}

/** useSyncExternalStore 的空订阅：UA 在会话内不会变化，只需客户端快照。 */
function subscribeNothing(): () => void {
  return () => {};
}

/** 按白名单裁剪 JSAPI 字段；缺字段时不伪造，返回 null 交给调用方报错。 */
function pickJsapiParams(jsapi: Record<string, string>): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (const key of JSAPI_ALLOWED_KEYS) {
    const value = jsapi[key];
    if (typeof value !== 'string' || value === '') {
      return null;
    }
    params[key] = value;
  }
  return params;
}

export interface PaymentCheckoutProps {
  /** 后端创建订单返回的付款入口；缺失字段表示该通道不可用。 */
  launch: PaymentLaunch;
  /** Stripe 可公开密钥；为空时不能进入 Stripe Element 流程。 */
  stripePublicKey: string | null;
  /** 触发订单状态查询；不代表已到账，到账以服务端订单状态为准。 */
  onCheck: () => void;
}

/**
 * 付款方式适配：按 launch 的真实 type 与 payload 选择付款入口。
 *
 * 契约来源：旧 frontend/src/components/payment/{paymentFlow.ts,
 * StripePaymentInline.vue} 的付款分支、frontend/src/views/user/AirwallexPaymentView.vue，
 * 以及 design/console-pages.md 余额与订单章节。
 *
 * 边界：
 * - client_secret / intent_id / jsapi 只在内存中使用，不写入 storage、不打印日志。
 * - 所有跳转地址先经 safeExternalUrl 校验（仅绝对 http(s)、无 userinfo），
 *   绝不使用 javascript:、data: 或本站任意 path。
 * - 二维码内容由本地 qrcode 库绘制为 data URL，不作为外部图片地址请求。
 * - 每个付款入口都提供订单状态查询按钮；支付动作结束只回调 onCheck，不宣称到账。
 * - 没有可用 payload 时只显示明确错误，绝不伪造付款链接。
 */
export function PaymentCheckout({ launch, stripePublicKey, onCheck }: PaymentCheckoutProps) {
  const [qr, setQr] = useState<QrState>(() => newQrState(launch.qrCode));
  const [actionError, setActionError] = useState<string | null>(null);
  /** Airwallex 同步锁：持有正在付款的订单号，防止双击并发 init / 重复 redirect。 */
  const airwallexLockRef = useRef<number | null>(null);
  /** 触发过 Airwallex 流程的订单号，仅用于按钮 loading 展示；按订单号比较，旧单值不影响新单。 */
  const [busyOrder, setBusyOrder] = useState<number | null>(null);
  /** 当前挂载的订单代次；卸载后置空，用于丢弃旧单的迟到回调。 */
  const mountedOrderRef = useRef<number | null>(launch.orderId);
  // 只在客户端读取 UA：服务端快照为 false，水合后由 React 重新读取真实值，
  // 避免在 effect 里 setState 造成级联渲染。
  const wechat = useSyncExternalStore(
    subscribeNothing,
    () => isWechatBrowser(navigator.userAgent),
    () => false,
  );

  // 换订单或二维码内容变化时在渲染期同步重置本地状态，不触发额外副作用。
  if (qr.key !== launch.qrCode) {
    setQr(newQrState(launch.qrCode));
  }
  const airwallexBusy = busyOrder === launch.orderId;

  // 卸载（关闭弹窗 / 切账号导致重挂）后置空代次，旧单不再跳转、不再 onCheck、不再 setState；
  // 同步锁一并释放，避免同一订单重新挂载后按钮永久卡住。
  useEffect(() => {
    mountedOrderRef.current = launch.orderId;
    return () => {
      mountedOrderRef.current = null;
      airwallexLockRef.current = null;
    };
  }, [launch.orderId]);

  const oauthUrl = launch.oauthUrl === null ? null : safeExternalUrl(launch.oauthUrl);
  const payUrl = launch.payUrl === null ? null : safeExternalUrl(launch.payUrl);
  const jsapiParams = launch.jsapi === null ? null : pickJsapiParams(launch.jsapi);
  const isAirwallex = launch.paymentType.trim().toLowerCase() === 'airwallex';
  const airwallexReady = isAirwallex && launch.clientSecret !== null && launch.intentId !== null;
  const canUseStripe = !isAirwallex && launch.clientSecret !== null && stripePublicKey !== null;

  // 本地把二维码内容渲染成 data URL；卸载或内容变化时忽略迟到结果。
  useEffect(() => {
    const content = launch.qrCode;
    if (content === null || content === '') {
      return;
    }
    let cancelled = false;
    toDataURL(content, { margin: 1, width: QR_CODE_SIZE })
      .then((url) => {
        if (!cancelled) {
          setQr((prev) => (prev.key === content ? { ...prev, dataUrl: url } : prev));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQr((prev) => (prev.key === content ? { ...prev, failed: true } : prev));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [launch.qrCode]);

  function openExternal(url: string) {
    setActionError(null);
    try {
      window.location.assign(url);
    } catch {
      setActionError('无法打开付款页面，请检查浏览器设置或改用其他付款方式');
      return;
    }
    onCheck();
  }

  function handleWechatPay() {
    setActionError(null);
    const bridge = getWeixinBridge();
    if (bridge === null) {
      setActionError('当前微信环境未提供支付组件，请在微信中打开页面后重试，或改用其他付款方式');
      return;
    }
    if (jsapiParams === null) {
      setActionError('微信支付参数不完整，请返回订单列表重新发起支付');
      return;
    }
    try {
      bridge.invoke('getBrandWCPayRequest', jsapiParams, (result) => {
        // 支付桥回调可能在弹窗关闭或换单后才到达，此时不再改状态、不再触发查询。
        if (mountedOrderRef.current !== launch.orderId) {
          return;
        }
        if (result.errMsg === 'get_brand_wcpay_request:ok') {
          onCheck();
          return;
        }
        setActionError('微信支付未完成，可在订单列表查询状态后重试');
      });
    } catch {
      setActionError('微信支付调用失败，可在订单列表查询状态后重试');
    }
  }

  function handleAirwallexPay() {
    const orderId = launch.orderId;
    // 同步 ref 锁 + busy 状态：同一订单双击或重入时直接返回，不会并发 init / redirect。
    if (airwallexLockRef.current === orderId) {
      return;
    }
    const clientSecret = launch.clientSecret;
    const intentId = launch.intentId;
    if (clientSecret === null || intentId === null) {
      setActionError('Airwallex 支付参数不完整，请返回订单列表重新发起支付');
      return;
    }
    airwallexLockRef.current = orderId;
    setBusyOrder(orderId);
    setActionError(null);
    /** 本次操作是否仍属于当前挂载且同一订单。 */
    const isCurrent = () => mountedOrderRef.current === orderId;
    /** 本次操作是否仍是当前有效锁（未被新订单接管）。 */
    const holdsLock = () => airwallexLockRef.current === orderId;
    void (async () => {
      try {
        const airwallex = await import('@airwallex/components-sdk');
        if (!isCurrent() || !holdsLock()) {
          return;
        }
        const result = await airwallex.init({
          env: launch.paymentEnvironment === 'prod' ? 'prod' : 'demo',
          enabledElements: ['payments'],
          locale: 'zh',
        });
        if (!isCurrent() || !holdsLock()) {
          return;
        }
        const payments = result.payments;
        if (payments === undefined) {
          setActionError('Airwallex 支付组件加载失败，请稍后重试或改用其他付款方式');
          return;
        }
        let successUrl: string;
        try {
          successUrl = paymentReturnUrl(orderId);
        } catch {
          if (isCurrent()) {
            setActionError('当前站点地址无效，无法完成回跳，请稍后重试');
          }
          return;
        }
        const redirectResult = payments.redirectToCheckout({
          intent_id: intentId,
          client_secret: clientSecret,
          currency: launch.currency,
          country_code: launch.countryCode ?? '',
          successUrl,
        });
        // 跳转与状态回调前再核对一次：已卸载、已换单或被新订单接管则不动作。
        if (!isCurrent() || !holdsLock()) {
          return;
        }
        if (typeof redirectResult === 'string' && redirectResult !== '') {
          window.location.assign(redirectResult);
        }
        onCheck();
      } catch {
        if (isCurrent() && holdsLock()) {
          setActionError('Airwallex 支付组件加载失败，请稍后重试或改用其他付款方式');
        }
      } finally {
        if (holdsLock()) {
          airwallexLockRef.current = null;
        }
        if (isCurrent()) {
          setBusyOrder((prev) => (prev === orderId ? null : prev));
        }
      }
    })();
  }

  const statusButton = (
    <Button type="button" variant="outline" className="w-full" onClick={onCheck}>
      查询订单状态
    </Button>
  );

  const summary = (
    <p className="text-sm text-muted-foreground">
      订单 #{launch.orderId} · 应付 {formatBillingMoney(launch.payAmount, launch.currency)}
    </p>
  );

  let entry: ReactNode;
  if (airwallexReady) {
    entry = (
      <Button type="button" className="w-full" loading={airwallexBusy} onClick={handleAirwallexPay}>
        {airwallexBusy ? '正在打开 Airwallex' : '前往 Airwallex 付款'}
      </Button>
    );
  } else if (oauthUrl !== null) {
    entry = (
      <Button type="button" className="w-full" onClick={() => openExternal(oauthUrl)}>
        前往授权并付款
      </Button>
    );
  } else if (jsapiParams !== null) {
    entry = (
      <div className="space-y-2">
        <Button type="button" className="w-full" disabled={!wechat} onClick={handleWechatPay}>
          微信内付款
        </Button>
        {!wechat ? (
          <p className="text-sm text-muted-foreground">请在微信中打开本页面后使用微信支付。</p>
        ) : null}
      </div>
    );
  } else if (canUseStripe) {
    entry = (
      <StripePaymentInline
        clientSecret={launch.clientSecret ?? ''}
        publishableKey={stripePublicKey ?? ''}
        orderId={launch.orderId}
        onCheck={onCheck}
      />
    );
  } else if (isAirwallex) {
    entry = (
      <Alert
        variant="destructive"
        title="支付暂不可用"
        description="支付配置不完整，请稍后重试或选择其他支付方式。"
      />
    );
  } else if (launch.clientSecret !== null) {
    entry = (
      <Alert
        variant="destructive"
        title="支付暂不可用"
        description="支付配置不完整，请稍后重试或选择其他支付方式。"
      />
    );
  } else if (payUrl !== null) {
    entry = (
      <Button type="button" className="w-full" onClick={() => openExternal(payUrl)}>
        前往付款页面
      </Button>
    );
  } else if (launch.qrCode !== null) {
    entry = (
      <div className="flex flex-col items-center gap-3">
        {qr.dataUrl !== null ? (
          // 本地由二维码内容生成的 data URL，不是外部图片地址，无法用 next/image 优化。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr.dataUrl}
            alt="支付二维码"
            width={QR_CODE_SIZE}
            height={QR_CODE_SIZE}
            className="rounded-control border border-border bg-card"
          />
        ) : qr.failed ? (
          <Alert variant="destructive" title="二维码生成失败，请改用其他付款方式或查询订单状态" />
        ) : (
          <Skeleton className="size-48" />
        )}
        <p className="text-sm text-muted-foreground">请使用对应 App 扫码完成支付。</p>
      </div>
    );
  } else {
    entry = (
      <Alert
        variant="destructive"
        title="当前订单没有可用的付款入口"
        description="请返回订单列表稍后查询状态，确认后再重新发起支付。"
      />
    );
  }

  return (
    <div className="space-y-4">
      {summary}
      {actionError !== null ? <Alert variant="destructive" title={actionError} /> : null}
      {entry}
      {statusButton}
    </div>
  );
}
