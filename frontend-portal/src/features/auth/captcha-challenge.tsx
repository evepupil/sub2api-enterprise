'use client';

/**
 * M2 人机验证组件（widget 模式）。
 *
 * 契约来源：design/customer-console.md 第 2 节与任务书；类型固定于 ./types.ts。
 *
 * 边界：
 * - 只渲染官方 widget/按钮，绝不自动完成或绕过挑战，也不请求任何后端校验接口
 *   （captchaVerifyParam / ticket 由业务请求带到后端，由后端负责 verify）。
 * - 提供方优先级与旧组件一致：Turnstile > 腾讯 > 阿里云；三者都未配置时渲染 null，
 *   不加载任何外部脚本。
 * - 成功 → onProof(proof)；过期/失败/用户取消/resetKey 变化 → onProof(null)，
 *   保证过期凭证不会被继续提交。
 * - 所有 window/document 访问都发生在 effect 或事件处理器中，SSR 安全；
 *   组件卸载后不再回调父组件。
 */

import * as React from 'react';

import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import type { AuthSettings, CaptchaProof } from './types';
import {
  loadAliyunCaptcha,
  normalizeAliyunRegion,
  removeAliyunCaptchaNodes,
} from './captcha-aliyun';
import { loadTencentCaptcha, type TencentCaptchaInstance } from './captcha-tencent';
import { loadTurnstile, type TurnstileApi } from './captcha-turnstile';

export interface CaptchaChallengeProps {
  settings: AuthSettings;
  onProof: (proof: CaptchaProof | null) => void;
  /** 父组件递增该值以清除旧 proof 并重新开始验证（登录/注册失败后调用）。 */
  resetKey?: number;
}

type Provider = 'turnstile' | 'tencent' | 'aliyun';

/** 优先级：Turnstile > 腾讯 > 阿里云。返回 null 表示未启用验证码。 */
function resolveProvider(settings: AuthSettings): Provider | null {
  if (settings.turnstileSiteKey !== null) {
    return 'turnstile';
  }
  if (settings.tencentAppId !== null) {
    return 'tencent';
  }
  if (settings.aliyun !== null) {
    return 'aliyun';
  }
  return null;
}

function CaptchaErrorAlert({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert
      variant="destructive"
      title={message}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      }
    />
  );
}

/** 把回调放进 ref：父组件传内联函数时不会触发重新加载脚本或重建 widget。 */
function useLatestProof(onProof: (proof: CaptchaProof | null) => void) {
  const ref = React.useRef(onProof);
  React.useEffect(() => {
    ref.current = onProof;
  }, [onProof]);
  return ref;
}

/** 卸载标记：卸载后不再 setState / 回调父组件。 */
function useAlive() {
  const ref = React.useRef(true);
  React.useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

interface ChallengeProps {
  onProof: (proof: CaptchaProof | null) => void;
  resetKey: number;
}

function TurnstileChallenge({ siteKey, onProof, resetKey }: ChallengeProps & { siteKey: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const apiRef = React.useRef<TurnstileApi | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const proofRef = useLatestProof(onProof);
  const aliveRef = useAlive();
  const [retryKey, setRetryKey] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    void loadTurnstile()
      .then((api) => {
        if (cancelled || !aliveRef.current) {
          return;
        }
        apiRef.current = api;
        container.replaceChildren();
        const widgetId = api.render(container, {
          sitekey: siteKey,
          callback: (token: string) => {
            if (cancelled || !aliveRef.current) {
              return;
            }
            setError(null);
            proofRef.current({ turnstile_token: token });
          },
          'expired-callback': () => {
            if (cancelled || !aliveRef.current) {
              return;
            }
            setError('验证已过期，请重新完成验证');
            proofRef.current(null);
          },
          'timeout-callback': () => {
            if (cancelled || !aliveRef.current) {
              return;
            }
            setError('验证超时，请重新完成验证');
            proofRef.current(null);
          },
          'error-callback': () => {
            if (cancelled || !aliveRef.current) {
              return;
            }
            setError('验证码加载失败，请点击重试');
            proofRef.current(null);
          },
          theme: 'auto',
          size: 'flexible',
        });
        widgetIdRef.current = widgetId;
        setLoading(false);
      })
      .catch(() => {
        if (cancelled || !aliveRef.current) {
          return;
        }
        setLoading(false);
        setError('验证码加载失败，请点击重试');
        proofRef.current(null);
      });

    return () => {
      cancelled = true;
      const api = apiRef.current;
      const widgetId = widgetIdRef.current;
      apiRef.current = null;
      widgetIdRef.current = null;
      if (api !== null && widgetId !== null) {
        try {
          api.remove(widgetId);
        } catch {
          // 离开页面时移除失败不影响导航。
        }
      }
      container.replaceChildren();
    };
  }, [siteKey, retryKey, aliveRef, proofRef]);

  const previousResetRef = React.useRef(resetKey);
  React.useEffect(() => {
    if (previousResetRef.current === resetKey) {
      return;
    }
    previousResetRef.current = resetKey;
    proofRef.current(null);
    const api = apiRef.current;
    const widgetId = widgetIdRef.current;
    if (api !== null && widgetId !== null) {
      try {
        api.reset(widgetId);
      } catch {
        // 重置失败时保持“未验证”，用户可点重试重新加载。
      }
    }
  }, [resetKey, proofRef]);

  return (
    <div className="flex w-full flex-col gap-2" data-captcha-provider="turnstile">
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          正在加载人机验证…
        </p>
      ) : null}
      <div ref={containerRef} className="min-h-[65px] w-full" />
      {error !== null ? (
        <CaptchaErrorAlert message={error} onRetry={() => setRetryKey((value) => value + 1)} />
      ) : null}
    </div>
  );
}

function TencentChallenge({ appId, onProof, resetKey }: ChallengeProps & { appId: string }) {
  const instanceRef = React.useRef<TencentCaptchaInstance | null>(null);
  const proofRef = useLatestProof(onProof);
  const aliveRef = useAlive();
  const [status, setStatus] = React.useState<'idle' | 'verifying' | 'verified'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const destroyInstance = React.useCallback(() => {
    const instance = instanceRef.current;
    instanceRef.current = null;
    if (instance !== null) {
      try {
        instance.destroy();
      } catch {
        // SDK 未完全初始化时 destroy 可能抛错，忽略即可。
      }
    }
  }, []);

  React.useEffect(() => () => destroyInstance(), [destroyInstance]);

  const startVerify = React.useCallback(() => {
    setError(null);
    setStatus('verifying');
    void loadTencentCaptcha()
      .then((TencentCaptcha) => {
        if (!aliveRef.current) {
          return;
        }
        destroyInstance();
        const instance = new TencentCaptcha(
          appId,
          (result) => {
            if (!aliveRef.current) {
              return;
            }
            instanceRef.current = null;
            if (result.ret === 2) {
              setStatus('idle');
              setError('已取消验证，可重新验证');
              proofRef.current(null);
              return;
            }
            const ticket = result.ticket?.trim() ?? '';
            const randstr = result.randstr?.trim() ?? '';
            if (
              result.ret !== 0 ||
              ticket === '' ||
              randstr === '' ||
              ticket.startsWith('trerror_') ||
              result.errorCode !== undefined
            ) {
              setStatus('idle');
              setError('验证失败，请重新验证');
              proofRef.current(null);
              return;
            }
            setStatus('verified');
            setError(null);
            proofRef.current({
              tencent_captcha_ticket: ticket,
              tencent_captcha_randstr: randstr,
            });
          },
          { userLanguage: 'zh-cn' },
        );
        instanceRef.current = instance;
        instance.show();
      })
      .catch(() => {
        if (!aliveRef.current) {
          return;
        }
        setStatus('idle');
        setError('验证码加载失败，请点击重试');
        proofRef.current(null);
      });
  }, [appId, destroyInstance, aliveRef, proofRef]);

  const previousResetRef = React.useRef(resetKey);
  React.useEffect(() => {
    if (previousResetRef.current === resetKey) {
      return;
    }
    previousResetRef.current = resetKey;
    destroyInstance();
    setStatus('idle');
    setError(null);
    proofRef.current(null);
  }, [resetKey, destroyInstance, proofRef]);

  const label =
    status === 'verified' ? '已验证' : status === 'verifying' ? '验证中…' : '完成安全验证';

  return (
    <div className="flex w-full flex-col gap-2" data-captcha-provider="tencent">
      <Button
        variant={status === 'verified' ? 'outline' : 'default'}
        onClick={startVerify}
        disabled={status !== 'idle'}
        aria-busy={status === 'verifying'}
      >
        {label}
      </Button>
      {error !== null ? <CaptchaErrorAlert message={error} onRetry={startVerify} /> : null}
    </div>
  );
}

const ALIYUN_POPUP_OPEN_TIMEOUT_MS = 8000;
const ALIYUN_POPUP_WATCH_INTERVAL_MS = 300;

function AliyunChallenge({
  config,
  onProof,
  resetKey,
}: ChallengeProps & { config: { sceneId: string; prefix: string; region: string } }) {
  const rawId = React.useId();
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const buttonId = `aliyun-captcha-button-${uid}`;
  const elementId = `aliyun-captcha-element-${uid}`;
  const proofRef = useLatestProof(onProof);
  const aliveRef = useAlive();
  const watchTimerRef = React.useRef<number | null>(null);
  const watchStartRef = React.useRef<(() => void) | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'verifying' | 'verified'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const stopWatch = (): void => {
      if (watchTimerRef.current !== null) {
        window.clearInterval(watchTimerRef.current);
        watchTimerRef.current = null;
      }
    };

    void loadAliyunCaptcha({
      prefix: config.prefix,
      region: normalizeAliyunRegion(config.region),
    })
      .then(() => {
        if (cancelled || !aliveRef.current) {
          return;
        }
        const init = window.initAliyunCaptcha;
        if (init === undefined) {
          throw new Error('阿里云验证码接口未就绪');
        }
        init({
          SceneId: config.sceneId,
          prefix: config.prefix,
          mode: 'popup',
          element: `#${elementId}`,
          button: `#${buttonId}`,
          // 这里不请求后端校验：把一次性 captchaVerifyParam 作为 proof 交给父组件，
          // 随业务请求的 turnstile_token 字段提交，由后端调用阿里云校验。
          captchaVerifyCallback: (captchaVerifyParam: string) => {
            if (aliveRef.current) {
              stopWatch();
              setStatus('verified');
              setError(null);
              proofRef.current({ turnstile_token: captchaVerifyParam });
            }
            return { captchaResult: true };
          },
          onBizResultCallback: () => undefined,
          getInstance: () => undefined,
          slideStyle: { width: 360, height: 40 },
          language: 'cn',
        });
      })
      .catch(() => {
        if (cancelled || !aliveRef.current) {
          return;
        }
        setStatus('idle');
        setError('验证码加载失败，请点击重试');
        proofRef.current(null);
      });

    // SDK 没有“用户关闭弹窗”回调，靠轮询弹窗可见性兜底：
    // 弹窗出现过又消失且未产生参数 → 用户主动关闭；迟迟不出现 → 打开失败。
    // initAliyunCaptcha 的事件绑定是异步完成的，首次 click 可能落空，
    // 因此弹窗出现前每隔一个 tick 重试触发一次。
    const startWatch = (): void => {
      if (watchTimerRef.current !== null) {
        return;
      }
      const startedAt = Date.now();
      let seen = false;
      watchTimerRef.current = window.setInterval(() => {
        if (!aliveRef.current) {
          stopWatch();
          return;
        }
        const popup = document.getElementById('aliyunCaptcha-window-popup');
        const visible = popup !== null && window.getComputedStyle(popup).display !== 'none';
        if (visible) {
          seen = true;
          return;
        }
        if (seen || Date.now() - startedAt > ALIYUN_POPUP_OPEN_TIMEOUT_MS) {
          stopWatch();
          setStatus('idle');
          setError(seen ? '已取消验证，可重新验证' : '验证窗口打开失败，请点击重试');
          proofRef.current(null);
          return;
        }
        document.getElementById(buttonId)?.click();
      }, ALIYUN_POPUP_WATCH_INTERVAL_MS);
    };

    watchStartRef.current = startWatch;

    return () => {
      cancelled = true;
      stopWatch();
      watchStartRef.current = null;
      removeAliyunCaptchaNodes();
    };
  }, [config.sceneId, config.prefix, config.region, buttonId, elementId, aliveRef, proofRef]);

  const handleClick = (): void => {
    if (status !== 'idle') {
      return;
    }
    setError(null);
    setStatus('verifying');
    watchStartRef.current?.();
  };

  const previousResetRef = React.useRef(resetKey);
  React.useEffect(() => {
    if (previousResetRef.current === resetKey) {
      return;
    }
    previousResetRef.current = resetKey;
    if (watchTimerRef.current !== null) {
      window.clearInterval(watchTimerRef.current);
      watchTimerRef.current = null;
    }
    setStatus('idle');
    setError(null);
    proofRef.current(null);
  }, [resetKey, proofRef]);

  const label =
    status === 'verified' ? '已验证' : status === 'verifying' ? '验证中…' : '点击完成安全验证';

  return (
    <div className="flex w-full flex-col gap-2" data-captcha-provider="aliyun">
      <Button
        id={buttonId}
        variant={status === 'verified' ? 'outline' : 'default'}
        onClick={handleClick}
        disabled={status !== 'idle'}
        aria-busy={status === 'verifying'}
      >
        {label}
      </Button>
      <div id={elementId} />
      {error !== null ? <CaptchaErrorAlert message={error} onRetry={handleClick} /> : null}
    </div>
  );
}

/**
 * 人机验证入口：按 settings 选择提供方，未启用时渲染 null（不加载任何外部脚本）。
 * proof 由父组件持有并随业务请求提交；组件自身不做后端校验。
 */
export function CaptchaChallenge({ settings, onProof, resetKey = 0 }: CaptchaChallengeProps) {
  const provider = resolveProvider(settings);
  if (provider === 'turnstile' && settings.turnstileSiteKey !== null) {
    return (
      <TurnstileChallenge
        siteKey={settings.turnstileSiteKey}
        onProof={onProof}
        resetKey={resetKey}
      />
    );
  }
  if (provider === 'tencent' && settings.tencentAppId !== null) {
    return <TencentChallenge appId={settings.tencentAppId} onProof={onProof} resetKey={resetKey} />;
  }
  if (provider === 'aliyun' && settings.aliyun !== null) {
    const aliyun = settings.aliyun;
    return (
      <AliyunChallenge
        // scene/prefix/region 变化时重新挂载，避免沿用上一个场景的验证状态。
        key={`${aliyun.sceneId}:${aliyun.prefix}:${aliyun.region}`}
        config={aliyun}
        onProof={onProof}
        resetKey={resetKey}
      />
    );
  }
  return null;
}
