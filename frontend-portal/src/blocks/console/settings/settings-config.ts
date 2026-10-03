/**
 * 账户设置页的固定数值：校验规则、占位数据，以及各个操作模拟的耗时。
 * 后端没有接，操作只改本页状态；耗时只是让按钮有「正在处理」的反馈。
 */

/** 名称最多多少个字 */
export const PROFILE_NAME_MAX = 32;

/** 新密码至少多少位 */
export const PASSWORD_MIN_LENGTH = 8;

/** 验证器 App 里动态码的位数 */
export const TWO_FACTOR_CODE_LENGTH = 6;

/** 占位的两步验证密钥，接后端后由服务端生成。显示时四位一组方便抄写，复制时去掉空格 */
export const TWO_FACTOR_SECRET = 'NXQK 2F7L 9WPA 4MTZ';

export const SAVE_PROFILE_MS = 800;
export const CHANGE_PASSWORD_MS = 1000;
export const ENABLE_TWO_FACTOR_MS = 800;
export const CONNECT_GOOGLE_MS = 1000;

/** 「已保存」「密码已修改」这类结果提示停留的时间 */
export const RESULT_FLASH_MS = 2000;
