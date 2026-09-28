'use client';

import * as React from 'react';

import { InputGlow } from '../../components/effects/input-glow';
import { Input } from '../../components/ui/input';

export interface AuthInputProps extends React.ComponentProps<typeof Input> {
  /** 加在光晕外层上的类名：输入框处于 flex/grid 行内时，把原本的伸缩类放到这里。 */
  glowClassName?: string;
}

/**
 * 登录、注册、找回密码页专用输入框：现有输入框外加悬停光晕，其余属性原样交给 Input。
 * 控制台不使用，保持素净。
 */
export function AuthInput({ glowClassName, ...props }: AuthInputProps) {
  return (
    <InputGlow className={glowClassName}>
      <Input {...props} />
    </InputGlow>
  );
}
