/**
 * 登录、两步验证、注册表单共用的整表错误提示（比如「邮箱或密码不正确」），放在提交按钮上方。
 * 没有消息时不占位。role="alert" 让读屏软件出错时立即读出。
 */
export function AuthFormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      data-auth-alert
      className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </p>
  );
}
