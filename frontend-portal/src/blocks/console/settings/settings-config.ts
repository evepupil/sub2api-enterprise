import { PASSWORD_MIN_LENGTH } from '@/lib/auth/register-form';
import { USERNAME_MAX } from '@/lib/console/live/account-types';

/** 账户设置页的固定数值：校验规则（和后台一致，新密码至少 6 位，同注册）与提示停留的时间。 */
export { PASSWORD_MIN_LENGTH };

/** 名称最多多少个字 */
export const PROFILE_NAME_MAX = USERNAME_MAX;

/** 「已保存」这类结果提示停留的时间 */
export const RESULT_FLASH_MS = 2000;

/** 密码改好后，提示停留多久再跳回登录页（旧的登录已失效） */
export const RELOGIN_DELAY_MS = 1500;
