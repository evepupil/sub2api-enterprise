# M0 工程与共享界面实施规格

M1 官网实现补充见 [官网实施规格](design/public-site.md) 及其四份页面规格；M0 主题和组件契约继续作为基础。

状态：实施规格 · 最近更新：2026-09-27

依据：[视觉基线](docs/前端设计.md) · [模块归档](docs/模块设计/工程与共享界面.md) · [M0](docs/roadmap.md#m0) · [预览页面规格](design/foundation-preview.md)

## 0. 范围与验收

M0 建立 Next.js 独立工程、统一主题、基础控件、官网外壳与客户控制台外壳。当前不连接业务 API、不实现账号或收费，不把样例记录发布到业务路径。首版范围严格沿用已确认文档。

真实内容：临时品牌“模型服务”，既定导航标签、界面颜色和版式。预览数据：全部为人工构造的组件样例，集中在 `src/preview/fixtures.ts`，不会进入业务接口或业务路由。

预览有三个视图：控件、官网外壳、控制台外壳。共用一个 `FoundationPreview` 客户组件，实际 Next.js 的 `/design` 只有显式环境开关开启时可访问，设置 noindex；默认不公开。另可生成带内嵌资源的离线 HTML，不启动服务。

验收门禁：格式、静态分析、严格类型、核心导航规则测试、生产构建、离线预览构建。UI 外观不写单测；浏览器截图、键盘、弹层和手机检查必须单独记录，工具不可用时不得标为通过。

## 1. 工程约定

- 工程：`C:\code\sub2api-enterprise\frontend-portal`，不写原 `frontend/`、`backend/` 的依赖、源码或输出。
- Next.js 16.3.6、React/React DOM 19.3.0，TypeScript 采用已核对兼容的稳定版。独立 pnpm 锁文件，包管理版本 10.34.5，Windows Node 24。
- Tailwind v4 + `@tailwindcss/postcss`，Prettier、ESLint 的 Next 配置，Vitest（Node 环境，仅规则测试）。无远程字体构建依赖。
- 基础控件按 shadcn/ui 的可组合源码方式组织，用 Radix 原语负责弹层、焦点与键盘行为；只用这一套控件。不运行 CLI 批量下载页面模板。
- TypeScript 开启 `strict`、`noUncheckedIndexedAccess`、`noUnusedLocals`、`noUnusedParameters`，不使用 `any` 或关掉检查掩盖问题。
- 门禁 `pnpm check` 顺序执行 format:check、lint、typecheck、test、build；构建使用 Next Webpack，避免把尚未验证的构建器行为引入本轮。
- 提供 `pnpm preview:offline` 只生成 `.preview/index.html`，不监听端口；构建脚本不能隐式启动服务。
- 页面根目录 `src/app/layout.tsx` 引入主题；`/` 暂用 Next `notFound()`，不公开未完成的首页；`/design` 由 `PORTAL_UI_PREVIEW=1` 控制，读取开关的页面明确动态渲染。预览不属于十四个产品页面。

## 2. 主题规则

颜色只在 `src/styles/tokens.css` 定义；`globals.css` 导入 Tailwind 与主题。通过 `@theme inline` 映射出下面的语义工具类，不在组件里硬编码十六进制或任意像素值。

| 语义名称 | 值 |
|---|---|
| background / foreground | #F7F8FA / #17191D |
| card / card-foreground | #FFFFFF / #17191D |
| primary / primary-foreground | #17191D / #FFFFFF |
| secondary / secondary-foreground | #F1F3F5 / #17191D |
| muted / muted-foreground | #F1F3F5 / #68717D |
| border / input | #E2E5E9 |
| ring | #17191D |
| destructive | #B42318 |
| success / warning | #18794E / #8A6100 |
| popover / popover-foreground | #FFFFFF / #17191D |
| chart-1…6 | #4263EB、#0F8B8D、#8B5CF6、#E49B3B、#64748B、#C76A77 |

间距使用 Tailwind 4px 基准：1/2/3/4/5/6/8/12/16，对应 4/8/12/16/20/24/32/48/64px。圆角变量：`control` 6px、`card` 8px、`dialog` 10px。尺寸变量映射 `h-control` 36px、`h-touch/w-touch` 44px、`h-header` 64px、`w-sidebar` 216px、`max-w-site` 1408px、`max-w-dialog` 480px、`min-w-table` 680px（宽表格在容器内滚动）。断点：md 768px、xl 1280px。

字号：`text-xs`12、`text-table`13、`text-sm`14、`text-base`16、`text-lg`18、`text-xl`20、`text-page`28、`text-hero`48。字体 Inter、Noto Sans SC、Microsoft YaHei、system sans；不下载字体，数字 tabular-nums。正文 1.5，标题 1.2。

控件默认 36px，手机触控至少44px；焦点 2px 轮廓，offset2px。过渡只使用120–180ms的颜色、边框、透明度；减少动态偏好关闭过渡。普通卡片无大阴影，弹层统一轻阴影。

## 3. 目录与文件归属

```text
src/
  app/                 Next 路由、元数据和入口
  styles/              tokens.css、globals.css
  components/ui/       共享基础控件
  components/layout/   Brand、PublicShell、ConsoleShell、PageHeader
  lib/utils.ts         cn，服务端也可使用
  lib/navigation.ts    纯导航规则与类型
  preview/             FoundationPreview、样例数据、各视图
scripts/               离线打包与构建配置
tests/                 导航规则测试
```

基础路只写配置、主题、app 根入口和 utils。控件路写 ui 与 navigation 实现。外壳路写 layout、preview、app/design 和 scripts 离线打包，不改公共配置。测试由独立测试路编写。

## 4. 共用签名

每个组件独立文件，按需标 `use client`，导出采用具名导出。

| 文件 | 导出与契约 |
|---|---|
| `lib/utils.ts` | `cn(...inputs: ClassValue[]): string`，clsx + tailwind-merge，无客户端指令 |
| `ui/button.tsx` | `Button` 接收原生按钮属性、`variant?: default/outline/ghost/destructive`、`size?: default/sm/icon`、`asChild?: boolean`、`loading?: boolean`；loading 禁止重复触发，保留子内容和尺寸，声明 aria-busy |
| `ui/input.tsx` | `Input` 接收原生 input 属性；支持 aria-invalid 和 disabled |
| `ui/label.tsx` | `Label` 接收原生 label 属性，可配 htmlFor |
| `ui/badge.tsx` | `Badge` 接收 span 属性和 `variant?: neutral/success/warning/destructive`，不能只靠颜色表达含义 |
| `ui/card.tsx` | `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter`，原生 div/heading 属性；Description 按需要选用 |
| `ui/table.tsx` | `Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption`，语义 table 元素与横向滚动容器，外层 min-w-0 |
| `ui/skeleton.tsx` | `Skeleton` 接收 div 属性，aria-hidden；减少动态偏好停闪动 |
| `ui/empty-state.tsx` | `EmptyState({title,description?,action?})`，不默认填说明；action 是可用的 ReactNode |
| `ui/alert.tsx` | `Alert({title,description?,action?,variant?: default/destructive})`，错误反馈 role=alert |
| `ui/select.tsx` | `Select, SelectTrigger, SelectValue, SelectContent, SelectItem`，shadcn/Radix 组合接口，content 使用 Portal |
| `ui/dialog.tsx` | `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose`，Radix 组合接口；portal、遮罩、Esc、焦点归还，标题必须可关联 |
| `ui/popover.tsx` | `Popover, PopoverTrigger, PopoverContent`，Radix组合接口 |
| `ui/calendar.tsx` | `Calendar` 为 DayPicker 9 的包装，接受其原属性；默认简中、周一开始、range 模式由调用者指定。仅日期，无时分或预选业务规则 |
| `lib/navigation.ts` | `type Audience='personal'|'owner'|'member'`；`type NavigationItem={href:string;label:string;icon:'overview'|'key'|'usage'|'wallet'|'team'|'settings'|'help'}`；`getConsoleNavigation(audience):NavigationItem[]`；`isNavigationActive(pathname,href):boolean` |
| `layout/brand.tsx` | `Brand({href?:string})`，临时菱形SVG + “模型服务” |
| `layout/public-shell.tsx` | `PublicShell({children,activePath?:string,onNavigate?:(href:string)=>void})`；首页 `/`、模型 `/catalog`、服务状态 `/status`、帮助 `/help`，登录 `/login`、进入控制台 `/console`；传 onNavigate 时预览拦截到本地状态，未传时为正常链接 |
| `layout/console-shell.tsx` | `ConsoleShell({children,audience,activePath,accountLabel,onNavigate?})`；身份只影响导航，不承担鉴权 |
| `layout/page-header.tsx` | `PageHeader({title,actions?:ReactNode})`，长标题换行，移动端操作另起一行 |
| `preview/foundation-preview.tsx` | `FoundationPreview()`，无网络、无业务 side effect，读下面页面规格 |

导航事实：所有身份都显示概览 `/console`、密钥 `/console/keys`、用量 `/console/usage`、设置 `/console/settings`、帮助 `/help`。personal/owner 加余额订单 `/console/billing`；owner 加组织成员 `/console/team` 和组织用量 `/console/team/usage`；member 不显示管理或付款入口。该导航只是界面，真实权限在 M2/M4 后端核对。

活跃判断：忽略 query/hash 与尾斜杠；`/console` 仅精确匹配；其他项为精确或以 href + `/` 开头，避免 `/console/keys-old` 命中密钥。若父子菜单都匹配，渲染时取最长匹配项作为唯一当前项。

公开导航根路径 `/` 也只能精确匹配；当前项必须设置 `aria-current="page"`，其他项省略。手机与桌面使用同一组固定链接和匹配规则，模型链接不得指向 `/models`（该路径属于既有 API）。

## 5. 文案与真实性

控件预览可显示“界面预览”“组件”“官网外壳”“控制台外壳”以及“示例数据”标识，此处的目标用户是开发与验收人员。正式产品外壳本身没有开发备注和未来计划。

所有样例金额与统计集中在 fixtures。预览里的“创建密钥”只打开控件演示对话框；提交文案为“保存到预览”，成功提示“已保存到当前预览”，不声称后台成功。

## 6. 验收记录要求

记录实际通过的门禁和运行条件。M0 的基础代码可提交，但没有实际渲染与交互证据时，路线图仍保持进行中并说明剩余验收项。不要用 DOM 静态检查代替视觉验证。

用户禁止自行启动 dev/preview/HTTP 服务，此规则优先于技能中默认启动服务的步骤。先完成代码、可离线预览和全部静态门禁，再报告仍需完成的浏览器验收。
