import { API_KEYS } from '@/lib/console';

/** 对话能选的密钥：只有状态为启用的密钥才能发请求，已暂停或已过期的不列出 */
export const CHAT_KEYS = API_KEYS.filter((key) => key.status === 'active');

/** 默认选中第一个启用中的密钥 */
export const DEFAULT_CHAT_KEY_ID = CHAT_KEYS[0]?.id ?? '';
