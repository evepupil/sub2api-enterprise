/**
 * 控制台里还没接后台的功能，首发先不显示（2026-10-07 用户定）。接好后把对应开关改成 true，入口和页面就回来了，代码都还在。
 * - chat：对话页（回复还是写死的）。关掉时侧栏没有「对话」入口、模型页没有「试一试」那一列，直接打开对话页跳回用量页。
 * - announcements：顶部公告条（内容是写死的样例）。
 * - notifications：通知铃铛（内容是写死的样例），侧栏底部和手机顶栏都不显示。
 * - recharge：账单页「充值」（在线支付还没接，点了只是关弹窗）。首发用兑换码，按钮和充值弹窗都不显示；
 *   后台的在线支付和原版 sub2api 一样（下单、付款、退款），以后照原版的支付页接。
 */
export interface ConsoleFeatures {
  chat: boolean;
  announcements: boolean;
  notifications: boolean;
  recharge: boolean;
}

export const CONSOLE_FEATURES: Readonly<ConsoleFeatures> = {
  chat: false,
  announcements: false,
  notifications: false,
  recharge: false,
};
