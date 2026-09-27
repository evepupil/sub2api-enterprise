'use client';

import { toDataURL } from 'qrcode';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { usePortalQuery } from '../console/use-portal-query';
import type { ApiRequester } from '../auth/types';
import {
  disableTotp,
  enableTotp,
  fetchTotpStatus,
  fetchVerificationMethod,
  safeErrorMessage,
  sendTotpEmailCode,
  startTotpSetup,
  type TotpCredential,
  type TotpSetup,
  type TotpVerificationMethod,
} from './api';

/** 邮箱验证码重发冷却秒数（接口未返回倒计时，用固定值）。 */
const EMAIL_CODE_COOLDOWN_SECONDS = 60;
/** 展示二维码的目标像素宽度。 */
const QR_CODE_SIZE = 192;

export interface TotpSectionProps {
  request: ApiRequester;
}

/**
 * 截止时间（epoch ms）对应的剩余整秒，最小为 0。deadline<=0 视为未开始。
 */
function remainingSeconds(deadline: number): number {
  if (deadline <= 0) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/**
 * 截止时间驱动的秒级倒计时。
 *
 * 用绝对 deadline 而不是“剩余秒数”，同一秒数重复开始也会重新计时；
 * `onExpire` 在剩余归零时只回调一次（属于定时器回调，不在 effect 内同步 setState）。
 */
function useDeadlineCountdown(deadline: number, onExpire?: () => void): number {
  const [remaining, setRemaining] = useState(() => remainingSeconds(deadline));
  const [trackedDeadline, setTrackedDeadline] = useState(deadline);
  const expireRef = useRef(onExpire);

  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);

  // deadline 变化时在同一次渲染内同步重置，避免旧值被误判为已到期。
  if (trackedDeadline !== deadline) {
    setTrackedDeadline(deadline);
    setRemaining(remainingSeconds(deadline));
  }

  useEffect(() => {
    if (deadline <= 0 || remainingSeconds(deadline) === 0) {
      return;
    }
    const timer = setInterval(() => {
      const left = remainingSeconds(deadline);
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        expireRef.current?.();
      }
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [deadline]);

  return remaining;
}

function formatEnabledAt(enabledAt: number | null): string | null {
  if (enabledAt === null) {
    return null;
  }
  const date = new Date(enabledAt * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

interface CredentialFieldProps {
  request: ApiRequester;
  method: TotpVerificationMethod;
  emailCode: string;
  password: string;
  onEmailCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  disabled: boolean;
  idPrefix: string;
}

/**
 * 按验证方式渲染输入：邮箱方式提供发送验证码与冷却倒计时，
 * 密码方式要求输入当前密码。发送验证码是写操作，失败后只提示不自动重试。
 */
function CredentialField({
  request,
  method,
  emailCode,
  password,
  onEmailCodeChange,
  onPasswordChange,
  disabled,
  idPrefix,
}: CredentialFieldProps) {
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [cooldownDeadline, setCooldownDeadline] = useState(0);
  const cooldown = useDeadlineCountdown(cooldownDeadline);
  const canSend = !disabled && !sending && cooldown === 0;

  async function handleSend() {
    if (!canSend) {
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      await sendTotpEmailCode(request);
      // 用绝对截止时间：连续两次发送都重新计满 60 秒。
      setCooldownDeadline(Date.now() + EMAIL_CODE_COOLDOWN_SECONDS * 1000);
    } catch (error) {
      setSendError(safeErrorMessage(error, '验证码发送失败，请稍后重试'));
    } finally {
      setSending(false);
    }
  }

  if (method === 'password') {
    return (
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-password`}>当前密码</Label>
        <Input
          id={`${idPrefix}-password`}
          name={`${idPrefix}-password`}
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={disabled}
          onChange={(event) => onPasswordChange(event.currentTarget.value)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-email-code`}>邮箱验证码</Label>
      <div className="flex items-start gap-2">
        <Input
          id={`${idPrefix}-email-code`}
          name={`${idPrefix}-email-code`}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={emailCode}
          disabled={disabled}
          onChange={(event) => onEmailCodeChange(event.currentTarget.value)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleSend}
          loading={sending}
          disabled={!canSend}
          className="shrink-0"
        >
          {cooldown > 0 ? `${cooldown} 秒后重发` : '发送验证码'}
        </Button>
      </div>
      {sendError !== null ? <p className="text-sm text-destructive">{sendError}</p> : null}
    </div>
  );
}

/** 双重验证：查看状态、启用（二维码 + secret + 6 位码）与关闭（确认弹窗）。 */
export function TotpSection({ request }: TotpSectionProps) {
  const statusQuery = usePortalQuery(
    ['settings', 'totp', 'status'],
    (queryRequest: ApiRequester, signal: AbortSignal) => fetchTotpStatus(queryRequest, signal),
  );
  const featureEnabled = statusQuery.data?.featureEnabled === true;
  const verificationQuery = usePortalQuery(
    ['settings', 'totp', 'verification-method'],
    (queryRequest: ApiRequester, signal: AbortSignal) =>
      fetchVerificationMethod(queryRequest, signal),
    { enabled: featureEnabled },
  );

  // 设置流程只在当前弹窗内存中保存 secret 与 setup_token，关闭即清空。
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupEmailCode, setSetupEmailCode] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [setupDeadline, setSetupDeadline] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [enabling, setEnabling] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);

  // 关闭确认弹窗。
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableEmailCode, setDisableEmailCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // 设置流程代次：打开/关闭/重新开始都递增。请求 await 后先确认本次仍有效，
  // 否则关闭弹窗或重启后，迟到的响应不得再写回 secret/setup_token。
  const setupFlowRef = useRef(0);
  const setupAbortRef = useRef<AbortController | null>(null);

  const setupCountdown = useDeadlineCountdown(setupDeadline, () => {
    // 倒计时到期即丢弃 setup_token 与 secret，旧 token 不能再提交。
    setupFlowRef.current += 1;
    setSetup(null);
    setSetupDeadline(0);
    setQrDataUrl(null);
    setTotpCode('');
    setCopied(false);
    setExpired(true);
  });

  // 卸载时作废在途 setup 请求并中止，secret 不残留。
  useEffect(() => {
    return () => {
      setupFlowRef.current += 1;
      setupAbortRef.current?.abort();
      setupAbortRef.current = null;
    };
  }, []);

  // 本地把 otpauth URI 渲染成图片，绝不把 otpauth 当作外链 img 的 src。
  // 只在异步回调里 setState；重置/到期时由 resetSetupFlow / onExpire 清空。
  useEffect(() => {
    if (setup === null) {
      return;
    }
    let cancelled = false;
    toDataURL(setup.qrCodeUrl, { margin: 1, width: QR_CODE_SIZE })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [setup]);

  function openSetupFlow() {
    setupFlowRef.current += 1;
    setSetupOpen(true);
  }

  function resetSetupFlow() {
    // 递增代次并中止在途请求，迟到的响应会被 handleStartSetup 丢弃。
    setupFlowRef.current += 1;
    setupAbortRef.current?.abort();
    setupAbortRef.current = null;
    setSetupOpen(false);
    setSetupEmailCode('');
    setSetupPassword('');
    setStarting(false);
    setStartError(null);
    setSetup(null);
    setSetupDeadline(0);
    setQrDataUrl(null);
    setTotpCode('');
    setEnabling(false);
    setEnableError(null);
    setCopied(false);
    setExpired(false);
  }

  function resetDisableFlow() {
    setDisableOpen(false);
    setDisableEmailCode('');
    setDisablePassword('');
    setDisabling(false);
    setDisableError(null);
  }

  function credentialFor(
    method: TotpVerificationMethod,
    emailCode: string,
    password: string,
  ): TotpCredential {
    return method === 'email' ? { emailCode } : { password };
  }

  async function handleStartSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (starting) {
      return;
    }
    const method = verificationQuery.data;
    if (method === undefined) {
      setStartError('验证方式暂时无法确认，请稍后重试');
      return;
    }
    const credential = credentialFor(method, setupEmailCode, setupPassword);
    const filled = 'emailCode' in credential ? credential.emailCode : credential.password;
    if (filled.trim().length === 0) {
      setStartError(method === 'email' ? '请输入邮箱验证码' : '请输入当前密码');
      return;
    }

    setStarting(true);
    setStartError(null);
    setExpired(false);

    // 本次请求的代次；递增同时作废上一次在途请求。
    const flow = ++setupFlowRef.current;
    setupAbortRef.current?.abort();
    const controller = new AbortController();
    setupAbortRef.current = controller;

    try {
      const result = await startTotpSetup(request, credential, controller.signal);
      if (setupFlowRef.current !== flow) {
        return;
      }
      setSetup(result);
      setSetupDeadline(Date.now() + result.countdown * 1000);
    } catch (error) {
      if (setupFlowRef.current !== flow) {
        return;
      }
      setStartError(safeErrorMessage(error, '无法开始设置，请检查验证信息后重试'));
    } finally {
      if (setupFlowRef.current === flow) {
        setStarting(false);
      }
    }
  }

  async function handleEnable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enabling || setup === null) {
      return;
    }
    if (!/^\d{6}$/.test(totpCode)) {
      setEnableError('请输入 6 位数字验证码');
      return;
    }
    setEnabling(true);
    setEnableError(null);
    try {
      const success = await enableTotp(request, {
        totpCode,
        setupToken: setup.setupToken,
      });
      if (!success) {
        setEnableError('启用未成功，请重试');
        return;
      }
      resetSetupFlow();
      await statusQuery.refetch();
    } catch (error) {
      setEnableError(safeErrorMessage(error, '启用失败，请检查验证码后重试'));
    } finally {
      setEnabling(false);
    }
  }

  async function handleDisable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabling) {
      return;
    }
    const method = verificationQuery.data;
    if (method === undefined) {
      setDisableError('验证方式暂时无法确认，请稍后重试');
      return;
    }
    const credential = credentialFor(method, disableEmailCode, disablePassword);
    const filled = 'emailCode' in credential ? credential.emailCode : credential.password;
    if (filled.trim().length === 0) {
      setDisableError(method === 'email' ? '请输入邮箱验证码' : '请输入当前密码');
      return;
    }

    setDisabling(true);
    setDisableError(null);
    try {
      const success = await disableTotp(request, credential);
      if (!success) {
        setDisableError('关闭未成功，请重试');
        return;
      }
      resetDisableFlow();
      await statusQuery.refetch();
    } catch (error) {
      setDisableError(safeErrorMessage(error, '关闭失败，请检查验证信息后重试'));
    } finally {
      setDisabling(false);
    }
  }

  async function handleCopySecret() {
    if (setup === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const method = verificationQuery.data;
  const verificationUnavailable =
    featureEnabled && verificationQuery.isError && statusQuery.data?.enabled !== true;

  /** 弹窗内的验证输入：按验证方式加载状态渲染输入框或重试。 */
  function renderCredential(
    idPrefix: string,
    emailCode: string,
    password: string,
    onEmailCodeChange: (value: string) => void,
    onPasswordChange: (value: string) => void,
    disabled: boolean,
  ) {
    if (verificationQuery.isPending) {
      return <Skeleton className="h-16 w-full" />;
    }
    if (method === undefined) {
      return (
        <Alert
          variant="destructive"
          title="验证方式暂时无法加载"
          action={
            <Button variant="outline" onClick={() => void verificationQuery.refetch()}>
              重试
            </Button>
          }
        />
      );
    }
    return (
      <CredentialField
        request={request}
        method={method}
        emailCode={emailCode}
        password={password}
        onEmailCodeChange={onEmailCodeChange}
        onPasswordChange={onPasswordChange}
        disabled={disabled}
        idPrefix={idPrefix}
      />
    );
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>双重验证</CardTitle>
          {statusQuery.data !== undefined ? (
            <Badge
              variant={
                statusQuery.data.featureEnabled && statusQuery.data.enabled ? 'success' : 'neutral'
              }
            >
              {statusQuery.data.featureEnabled && statusQuery.data.enabled ? '已开启' : '未开启'}
            </Badge>
          ) : null}
        </div>
        <CardDescription>使用身份验证器应用生成的一次性验证码保护账号。</CardDescription>
      </CardHeader>
      <CardContent>
        {statusQuery.isPending ? (
          <Skeleton className="h-9 w-40" />
        ) : statusQuery.isError ? (
          <Alert
            variant="destructive"
            title="双重验证状态暂时无法加载"
            action={
              <Button variant="outline" onClick={() => void statusQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : statusQuery.data === undefined || !statusQuery.data.featureEnabled ? (
          <p className="text-sm text-muted-foreground">双重验证未开启，当前站点未开放此功能。</p>
        ) : statusQuery.data.enabled ? (
          <div className="space-y-4">
            {statusQuery.data.enabledAt !== null ? (
              <p className="text-sm text-muted-foreground">
                上次开启时间：{formatEnabledAt(statusQuery.data.enabledAt) ?? '未知'}
              </p>
            ) : null}
            <Button variant="destructive" onClick={() => setDisableOpen(true)}>
              关闭双重验证
            </Button>
          </div>
        ) : verificationUnavailable ? (
          <Alert
            variant="destructive"
            title="验证方式暂时无法加载"
            action={
              <Button variant="outline" onClick={() => void verificationQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              开启后登录需要输入身份验证器中的 6 位验证码。
            </p>
            <Button onClick={openSetupFlow}>开启双重验证</Button>
          </div>
        )}
      </CardContent>

      {/* 启用：先验证身份，再展示二维码、secret 与验证码输入。 */}
      <Dialog open={setupOpen} onOpenChange={(open) => (open ? openSetupFlow() : resetSetupFlow())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>开启双重验证</DialogTitle>
            <DialogDescription>
              {setup === null
                ? '先完成身份验证，然后扫描二维码并输入验证码。'
                : '用身份验证器扫描二维码，或手动输入密钥，再填入生成的 6 位验证码。'}
            </DialogDescription>
          </DialogHeader>

          {setup === null ? (
            <form className="space-y-4 py-4" onSubmit={handleStartSetup} noValidate>
              {expired ? <Alert title="验证已过期，请重新开始" /> : null}
              {renderCredential(
                'totp-setup',
                setupEmailCode,
                setupPassword,
                (value) => {
                  setSetupEmailCode(value);
                  setStartError(null);
                },
                (value) => {
                  setSetupPassword(value);
                  setStartError(null);
                },
                starting,
              )}

              {startError !== null ? <Alert variant="destructive" title={startError} /> : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetSetupFlow}>
                  取消
                </Button>
                <Button type="submit" loading={starting} disabled={method === undefined}>
                  下一步
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form className="space-y-4 py-4" onSubmit={handleEnable} noValidate>
              <div className="flex flex-col items-center gap-3">
                {qrDataUrl !== null ? (
                  // 本地由 otpauth URI 生成的 data URL，非外部图片地址。
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="双重验证二维码"
                    width={QR_CODE_SIZE}
                    height={QR_CODE_SIZE}
                    className="rounded-control border border-border bg-card"
                  />
                ) : (
                  <Skeleton className="size-48" />
                )}
                <p className="text-xs text-muted-foreground">
                  {`剩余有效时间 ${setupCountdown} 秒`}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp-secret">密钥</Label>
                <div className="flex items-center gap-2">
                  <Input id="totp-secret" value={setup.secret} readOnly aria-readonly="true" />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void handleCopySecret()}
                  >
                    {copied ? '已复制' : '复制'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp-enable-code">6 位验证码</Label>
                <Input
                  id="totp-enable-code"
                  name="totp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={totpCode}
                  disabled={enabling}
                  onChange={(event) => {
                    setTotpCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6));
                    setEnableError(null);
                  }}
                />
              </div>

              {enableError !== null ? <Alert variant="destructive" title={enableError} /> : null}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetSetupFlow}>
                  取消
                </Button>
                <Button type="submit" loading={enabling} disabled={totpCode.length !== 6}>
                  确认开启
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 关闭：确认弹窗，按验证方式要求邮箱验证码或当前密码。 */}
      <Dialog
        open={disableOpen}
        onOpenChange={(open) => (open ? setDisableOpen(true) : resetDisableFlow())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>关闭双重验证</DialogTitle>
            <DialogDescription>关闭后登录将不再需要验证码，请确认这是你的操作。</DialogDescription>
          </DialogHeader>

          <form className="space-y-4 py-4" onSubmit={handleDisable} noValidate>
            {renderCredential(
              'totp-disable',
              disableEmailCode,
              disablePassword,
              (value) => {
                setDisableEmailCode(value);
                setDisableError(null);
              },
              (value) => {
                setDisablePassword(value);
                setDisableError(null);
              },
              disabling,
            )}

            {disableError !== null ? <Alert variant="destructive" title={disableError} /> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetDisableFlow}>
                取消
              </Button>
              <Button
                type="submit"
                variant="destructive"
                loading={disabling}
                disabled={method === undefined}
              >
                确认关闭
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
