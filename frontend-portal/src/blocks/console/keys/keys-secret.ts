/** 新密钥的前缀，和后端默认的密钥前缀、占位数据里的密钥一致 */
export const SECRET_PREFIX = 'sk-';
export const SECRET_BODY_LENGTH = 40;

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * 生成一个新密钥：`sk-` 加 40 位字母数字，随机数来自浏览器的安全随机源。
 * 只在点击事件里调用，渲染过程中不要调。
 */
export function generateKeySecret(): string {
  // 256 不能被 62 整除，超出整倍数的字节丢掉重取，避免前几个字符出现得更频繁
  const limit = 256 - (256 % ALPHABET.length);
  let body = '';
  while (body.length < SECRET_BODY_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(SECRET_BODY_LENGTH))) {
      if (byte < limit && body.length < SECRET_BODY_LENGTH) {
        body += ALPHABET.charAt(byte % ALPHABET.length);
      }
    }
  }
  return `${SECRET_PREFIX}${body}`;
}
