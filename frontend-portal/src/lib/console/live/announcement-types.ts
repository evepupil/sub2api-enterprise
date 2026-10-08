/**
 * 控制台铃铛里的公告（后台「公告管理」发布、发给当前用户的那些）。官网服务器整理好后交给浏览器，两边共用这个形状。
 */
export interface ConsoleAnnouncement {
  id: number;
  title: string;
  /** 正文，Markdown 写法（后台公告编辑器里写的原文） */
  content: string;
  /** 显示的发布时间（毫秒）：后台定了开始时间就用开始时间，否则用创建时间；都读不到时为 null */
  publishedAt: number | null;
  read: boolean;
}

/** 铃铛最多列这么多条（后台先给没读的、同样已读或没读的按新到旧，和原版 sub2api 一样只看前 20 条） */
export const ANNOUNCEMENT_LIMIT = 20;
