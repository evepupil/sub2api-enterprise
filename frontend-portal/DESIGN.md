# Nexus API 客户官网 —— 站点层规格（唯一事实来源）

> 所有实现会话动手前先读完本文件，再读 `design/` 下属于自己那一页的规格。本文件和 `design/*.md` 是契约，**实现会话不得修改**。
> 这份规格故意写满：这类站该有的东西先全部摆上，数据先编。删减是主控验收时的事，实现会话只负责按规格做出来。
> 规格分两层：本文件定全站的东西，**每路必读全文**；`design/<页面>.md` 写逐区块规格，**每路只读自己那一页**。

项目根：`C:\code\sub2api-enterprise\frontend-portal`（下文路径都相对这里）。

---

## 0. 定位与参照

一个面向个人开发者和企业的 AI 模型 API 服务站官网：一个 API 调用 Claude、GPT、Gemini 等文本模型和 GPT Image、Nano Banana 等生图模型，按量付费，分个人版、专业版、企业版三个服务版本（可用率承诺、渠道质量和价格不同）。本次只做官网：首页、模型、价格、分组、登录、注册，文档入口占位，控制台不做，后端不接。

用户来这里干这几件事：

1. 在首页弄清楚这是什么服务、能调哪些模型、怎么收费，然后注册。
2. 在模型页按厂商、协议、上下文筛选模型，切换三个版本看每个模型的价格和近 24 小时可用率。
3. 在价格页按版本、按币种查每个模型的输入、输出、缓存和生图单价。
4. 在分组页看每个版本下各分组的倍率和特权，弄清「实际扣费 = 模型基础价 × 分组倍率」。
5. 以个人或组织身份登录、注册。

目标观感：**像素级复刻 Aceternity「AI SaaS Template」（Every AI）的观感，内容全部换成我们的。** 白底近黑字、Geist 字体、超大加粗标题、黑色胶囊按钮、带光线流动的网格背景、滚动后浮起的胶囊顶栏、深色重点卡、页脚超大水印字；暗色主题整体反转。

| 参照 | 抄什么 |
|---|---|
| Aceternity AI SaaS Template 首页 `ai-saas-template-aceternity.vercel.app` | 全站视觉与首页结构：顶栏（左品牌加菜单、右主题按钮/登录/注册胶囊，滚动后变成浮动胶囊）；首屏（网格加光线背景、带投影的小胶囊公告、两行 96px 标题、20px 灰色副标题、黑色「Get started」加「Contact us →」）；首屏下方带大圆角外框的控制台截图；「Trusted by」四个标志轮换；「Packed with features」带虚线分隔的四格拼贴（生图卡、聊天手机卡、开关列表卡、地球加技术胶囊跑马灯卡）；4×2 特性格（图标、标题、说明，悬停左侧出现竖条）；三列纵向滚动的评价卡瀑布流；深色带颗粒的号召块；页脚（品牌、版权、三列链接、底部超大浅灰渐变水印字） |
| 同模板 `/pricing` | 分组页：居中标题、Monthly/Yearly 黑底分段切换、四张并排套餐卡（第三张深蓝渐变重点卡、白色按钮）、带对勾圆点的特权列表、逐行对勾的对比表、底部标志墙 |
| 同模板 `/login`、`/signup` | 登录注册：左半屏表单（品牌、标题、标签加输入框、黑色整宽按钮、分隔线「Or continue with」、第三方登录整宽按钮、条款小字），右半屏浅灰底加虚线框，中间叠放头像加一句话 |
| onehop.ai `/models` | 模型页的信息组织：左侧筛选栏（上下文长度、厂商、支持协议，每项带数量）、顶部模型数量加搜索框加排序下拉、分类标签（全部/文本/图像带数量）、三列模型卡（厂商标志与名称、模型名、调用名、一句描述、协议标签、上下文、价格加折扣标、可用率与 24 格状态条） |
| onehop.ai `/pricing` | 价格页的信息组织：币种切换（美元/人民币）、按厂商分段的价目表（模型、输入、输出、上下文，超长上下文档写在模型名下面一行）、生图价目表（每张价或每百万 Token 价，按 Token 计费的给「≈ 每张」估算）、表下注释、常见问题 |

不抄：onehop 的顶部公告横幅、首次访问弹窗、右下角客服浮钮；模板里的融资公告文案、虚构客户评价与客户标志（Netflix、Meta 等）、Join Waitlist、Blog 和 Contact 页；任何「检测、审查、读取调用内容」的说法；使用场景区块；代码调用示例。

### 0.1 页面清单

| 页面 | 路由 | 用户来干什么 | 首屏核心动作 | 参照页 | 区块下限 | 分路 |
|---|---|---|---|---|---|---|
| 首页 | `/` | 了解服务、注册 | 「免费注册」「查看价格」 | 模板首页 | 7 + 顶栏页脚 | L1 L2 L3 |
| 模型 | `/models` | 选模型、看价格和可用率 | 版本切换、搜索、筛选 | onehop 模型页 | 2（筛选器内含 5 个区域） | L4 |
| 价格 | `/pricing` | 查单价 | 版本切换、币种切换 | onehop 价格页 | 4 | L5 |
| 分组 | `/groups` | 看分组倍率与特权 | 版本切换、看分组卡 | 模板价格页 | 6 | L6 |
| 登录 | `/login` | 个人或组织登录 | 个人/组织切换、填表 | 模板登录页 | 2 | L7 |
| 注册 | `/register` | 个人注册或创建组织 | 个人/创建组织切换、填表 | 模板注册页 | 2 | L7 |
| 文档 | `/docs` | 占位 | 无 | 无 | 1 | L7 |
| 404 | 任意不存在地址 | 回到站内 | 「返回首页」 | 无 | 1 | L7 |

英文版地址前加 `/en`（`/en/models`），由框架处理，区块不用管。

---

## 1. 技术栈（已锁定，依赖已装好，不准再装任何包）

| 项 | 值 |
|---|---|
| 框架 | Next.js 16.3.6 App Router，打包用 Turbopack（`next dev` / `next build`） |
| 语言 | TypeScript 5.9，`strict`、`noUncheckedIndexedAccess`、`noUnusedLocals`、`noUnusedParameters` 全开 |
| 样式 | Tailwind CSS 4.3（无 tailwind.config，令牌在 `src/app/globals.css` 的 `@theme inline`） |
| 动效 | `motion` 13.4（`import { motion, AnimatePresence, useReducedMotion, useScroll, useMotionValueEvent } from 'motion/react'`） |
| 多语言 | `next-intl` 4.14：服务端组件 `useTranslations`（同步组件）或 `await getTranslations`（异步组件）；客户端组件 `useTranslations`；当前语言 `useLocale()`（类型为 `'zh' \| 'en'`） |
| 站内链接 | `import { Link, usePathname, useRouter } from '@/i18n/navigation'`（自动带语言前缀）；`href="#"` 的占位链接用原生 `<a>` |
| 主题 | `next-themes` 0.4（`useTheme()`，类名写在 `<html>`，默认亮色） |
| 基础组件 | Radix：`@radix-ui/react-dropdown-menu`、`@radix-ui/react-accordion`、`@radix-ui/react-slot`；样式按 shadcn new-york 写法自己包一层 |
| 工具 | `clsx` + `tailwind-merge`（`cn`）、`class-variance-authority`（可用可不用） |
| 图标 | `lucide-react` 1.48，只用白名单 |
| 地球 | `cobe` 2.0（只在共享组件 `Globe` 里用） |
| 字体 | `geist`（Geist Sans / Geist Mono，已在根布局挂好，`font-sans` / `font-mono` 直接用） |
| 图片 | 原生 `<img>`，写 `width`、`height`、`alt`、`loading="lazy"`、`decoding="async"`；不用 `next/image` |
| 图表 | 手写 SVG |
| 单测 | vitest 4（只测数据层，界面不写单测） |
| 包管理 | pnpm 10.34.5 |

**不引入**：framer-motion（用 motion）、任何 UI 框架（MUI、Ant Design、Mantine、Chakra、Headless UI、NextUI、daisyUI）、任何图表库（recharts、echarts、chart.js、visx）、任何动画库（gsap、lottie、react-spring）、其他图标库（tabler、heroicons、react-icons）、three.js、`next/image`、`next/link`（用 `@/i18n/navigation` 的 `Link`）。

可用图标白名单（已在本机 1.48 版逐个确认存在，只用这些）：
`Menu X Sun Moon Languages Globe ChevronDown ChevronRight ChevronLeft ChevronUp Check ArrowRight ArrowUpRight ArrowLeft Plus Minus Search SlidersHorizontal ArrowUpDown ListFilter Eye EyeOff Mail Lock User Users Building2 KeyRound Copy ExternalLink Info CircleCheck CircleX CircleAlert Clock Activity Gauge Zap Layers ShieldCheck Network Receipt RefreshCw Server Cpu Bot MessageSquare Image ImagePlus Images Sparkles WandSparkles Terminal SquareTerminal Workflow CodeXml Braces Database Cloud Infinity Percent LifeBuoy Headphones FileText BookOpen LayoutDashboard Wallet Coins CreditCard ChartColumn ChartLine ChartPie TrendingUp Timer Route Split Shuffle Puzzle Plug Boxes Package Rocket Award BadgeCheck Fingerprint Settings Bell Calendar Download Upload Filter Hash AtSign LoaderCircle`。
没有的形状（谷歌标志、厂商标志）用 `public/` 里的 SVG 文件或手写内联 SVG。

---

## 2. 设计令牌

全部定义在 `src/app/globals.css`（已写好，**谁都不准改**）。亮色取自模板实测：正文 16/24，首屏标题 96/96 字重 600，区块标题 48/60 字重 500 字距 -1.2px，副标题 20/28 灰色，按钮 14px 字重 500、内边距 8×16、全圆角、内描边高光。

### 2.1 颜色（类名 → 亮色 / 暗色）

| 类名（bg-/text-/border- 前缀通用） | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `background` | #ffffff | #0a0a0a | 页面底色 |
| `foreground` | #0a0a0a | #fafafa | 标题、正文主色（对比度 19.8:1） |
| `card` | #ffffff | #111111 | 卡片、下拉、输入框底色 |
| `surface` | #fafafa | #0f0f0f | 浅灰区块底色、登录页右半屏 |
| `muted` | #f5f5f5 | #1a1a1a | 胶囊底、悬停底、分段控件底 |
| `muted-foreground` | #525252 | #a3a3a3 | 副标题、说明文字（白底 7.8:1 / 黑底 8.7:1） |
| `subtle-foreground` | #737373 | #8c8c8c | 次要标注、占位符（白底 4.7:1 / 黑底 5.4:1） |
| `border` | #e5e5e5 | #262626 | 默认边框、分隔线 |
| `border-strong` | #d4d4d4 | #404040 | 虚线框、强调边框 |
| `primary` / `primary-foreground` | #171717 / #ffffff | #fafafa / #0a0a0a | 主按钮（暗色下变白底黑字） |
| `navy` → `navy-2` | #0f172a → #1e293b | #101a30 → #1e293b | 重点卡、深色号召块的渐变 |
| `navy-foreground` / `navy-muted` | #f8fafc / #94a3b8 | 同左 | 深色块上的文字 |
| `grid-line` / `grid-dot` / `beam` | #f0f0f0 / #e5e5e5 / #a3a3a3 | #161616 / #262626 / #737373 | 背景网格线、交点圆点、流动光线 |
| `chart-1..4` | #2563eb #60a5fa #bfdbfe #e11d48 | #3b82f6 #60a5fa #1e3a8a #fb7185 | **只用于图形** |
| `success` / `success-soft` / `success-graphic` | #15803d / #dcfce7 / #22c55e | #4ade80 / 绿 14% / #22c55e | 折扣标、可用率；`*-graphic` 只做色块 |
| `warning` / `warning-soft` / `warning-graphic` | #b45309 / #fef3c7 / #f59e0b | #fbbf24 / 琥珀 14% / #f59e0b | 降级 |
| `danger` / `danger-soft` / `danger-graphic` | #dc2626 / #fee2e2 / #ef4444 | #f87171 / 红 14% / #ef4444 | 错误、中断 |
| `info` / `info-soft` | #1d4ed8 / #dbeafe | #93c5fd / 蓝 16% | 「新」标记 |

**组件里禁止写十六进制色值和 `neutral-*` 以外的原色**。例外只有三处：页脚水印渐变用 `from-neutral-50 to-neutral-200 dark:from-neutral-950 dark:to-neutral-800`；CheckList 的圆点用 `text-neutral-700 dark:text-neutral-300`；SVG 渐变的 `stopColor` 用 `var(--chart-1)` 这类变量。白色文字和白色按钮可以直接用 `text-white`、`bg-white`（只出现在深色块上）。

### 2.2 字阶（完整类名，照抄）

字族：`font-sans` = Geist Sans，中文回落 PingFang SC / 微软雅黑；`font-mono` = Geist Mono，只用于模型调用名（如 `claude-sonnet-5-5`）。数字一律加 `tabular-nums`。

| 用途 | 类名 |
|---|---|
| 首页首屏标题 h1 | `text-balance text-[40px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl lg:leading-none` |
| 内页标题 h1 / 区块标题 h2 | `text-balance text-3xl font-medium tracking-tight text-foreground md:text-5xl md:leading-[1.25]` |
| 首屏副标题 | `mx-auto max-w-3xl text-balance text-lg text-muted-foreground md:text-xl` |
| 区块副标题 | `mx-auto max-w-2xl text-balance text-base text-muted-foreground` |
| 卡片大标题 h3 | `text-xl font-medium tracking-tight text-foreground md:text-2xl` |
| 卡片小标题 h3 | `text-base font-semibold text-foreground` |
| 正文 | `text-base text-foreground`；说明 `text-sm text-muted-foreground` |
| 辅助小字 | `text-xs text-subtle-foreground` |
| 价格大字 | `text-4xl font-semibold tracking-tight tabular-nums md:text-5xl` |

### 2.3 间距、圆角、阴影、断点

- 容器：`mx-auto w-full max-w-7xl px-4 md:px-8`（共享组件 `Container`）。
- 区块纵向留白：`py-20 md:py-28`；首屏 `pt-20 pb-16 md:pt-32`；内页首屏 `pt-16 pb-12 md:pt-24 md:pb-16`。
- 圆角：输入框、菜单项、小胶囊 `rounded-md`（6px）；卡片 `rounded-2xl`（16px）；大外框、号召块 `rounded-3xl`（24px）；按钮、徽标 `rounded-full`。
- 阴影（都是令牌）：`shadow-card`（模板卡片四层柔影）、`shadow-nav`（浮动顶栏）、`shadow-button`（主按钮内描边高光）、`shadow-pill`（首屏小胶囊）、`shadow-featured`（重点卡）。暗色下自动换成细描边。
- 焦点：全局 `:focus-visible` 已是 2px `foreground` 描边；自定义控件不准 `outline-none` 后不给替代。
- 断点：Tailwind 默认（sm 640、md 768、lg 1024、xl 1280）。验收看两档：手机 375、桌面 1440。顶栏在 `lg` 以下切成汉堡菜单。

### 2.4 全局样式（已写好，直接用）

- `animate-marquee-x` / `animate-marquee-y`：跑马灯，时长用行内样式 `--marquee-duration`。
- `animate-fade-up`：首屏载入淡入上移（0.5s），延迟用行内 `animationDelay`。
- `animate-beam-x` / `animate-beam-y`：网格光线，行内样式 `--beam-duration`、`--beam-delay`、`--beam-travel`。
- `bg-noise`：颗粒纹理，叠一层 `opacity-[0.12] mix-blend-overlay` 用。
- 带 `data-marquee-track`、`data-beam` 的元素在「减少动态效果」下自动停住。

---

## 3. 动效纪律

营销站，可以动，但只动 `transform`、`opacity`、`filter: blur`，缓动统一 `[0.22, 1, 0.36, 1]`。

可以动的（只有这些）：

1. 首页首屏载入：小胶囊、标题、副标题、按钮依次淡入上移（`opacity 0→1`、`y 16→0`，时长 0.5s，间隔 0.08s），用纯 CSS 的 `animate-fade-up` 加行内 `animationDelay`，不依赖水合（JS 控制的初始透明会让首屏在水合前一直空白）；只在首屏，**不做任何滚动触发的入场动画**（无头截图里会停在透明态）。
2. 顶栏滚动超过 80px 变浮动胶囊（背景、阴影、下移 6px，CSS 过渡 300ms）。
3. 背景网格光线（`GridBeams`）、跑马灯（`Marquee`）、地球自转（`Globe`）、标志轮换（`ProviderLogoCloud`）。
4. 悬停：按钮变色 150ms；卡片 `hover:-translate-y-0.5` 加阴影 200ms；顶栏菜单悬停底色跟随（motion `layoutId`）。
5. 分段控件选中块滑动（motion `layoutId`，弹簧 `{ type: 'spring', bounce: 0.15, duration: 0.4 }`）。
6. 手风琴展开、下拉菜单、手机菜单展开（200ms）。

不准动的：数字滚动、打字机效果、视差、鼠标跟随光斑、整页过渡、加载转圈以外的任何循环动画。所有循环动画在 `useReducedMotion()` 为真时停住。

---

## 4. 文件结构与共享组件

### 4.1 路由与页面骨架

| 路由 | 文件 | 页面标题 | 渲染的区块（按顺序） |
|---|---|---|---|
| `/` | `src/app/[locale]/(site)/page.tsx` | 根布局默认标题 | HomeHero、ConsolePreview、ProviderLogos、FeaturesBento、FeatureGrid、ModelMarquee、HomeCta |
| `/models` | `src/app/[locale]/(site)/models/page.tsx` | `models.meta.title` | ModelsHero、ModelsExplorer |
| `/pricing` | `src/app/[locale]/(site)/pricing/page.tsx` | `pricing.meta.title` | PricingHero、PricingTables、PricingNotes、PricingFaq |
| `/groups` | `src/app/[locale]/(site)/groups/page.tsx` | `groups.meta.title` | GroupsHero、GroupCards、RatioExplainer、PrivilegeTable、GroupsFaq、GroupsLogos |
| `/docs` | `src/app/[locale]/(site)/docs/page.tsx` | `misc.meta.docsTitle` | DocsPlaceholder |
| `/login` | `src/app/[locale]/(auth)/login/page.tsx` | `auth.meta.loginTitle` | 两栏：LoginPanel、AuthShowcase |
| `/register` | `src/app/[locale]/(auth)/register/page.tsx` | `auth.meta.registerTitle` | 两栏：RegisterPanel、AuthShowcase |
| 404 | `src/app/[locale]/not-found.tsx` | `misc.meta.notFoundTitle` | SiteHeader、NotFoundView、SiteFooter |

- `(site)` 组的布局 `src/app/[locale]/(site)/layout.tsx` 渲染 `SiteHeader` → `<main id="main">` → `SiteFooter`；`(auth)` 组的布局只有 `<main id="main" className="min-h-dvh">`，没有顶栏页脚（和模板登录页一致）。
- 每个页面开头 `const locale = await initPage(params)`（`@/i18n/page`），有标题的页面写 `generateMetadata`。
- 每个区块组件**具名导出 + 默认导出双份**，**不接收任何参数**，自带最外层 `<section>`（锚点 `id`、底色、纵向留白）。页内几个区块之间共享的状态（当前版本、币种）一律走网址参数（见 4.4），不靠参数传递。顶栏靠 `usePathname()` 自己判断当前页，也不接收参数。

### 4.2 区块清单

首页（`design/首页.md`），本页最重要的区块：H1 首屏。

| # | 区块 | 组件 | 文件 | 锚点 | 底色 | 路 |
|---|---|---|---|---|---|---|
| H1 | 首屏 | `HomeHero` | `src/blocks/home/hero.tsx` | `hero` | background + 网格光线 | L1 |
| H2 | 控制台预览 | `ConsolePreview` | `src/blocks/home/console-preview.tsx` | `preview` | background | L1 |
| H3 | 厂商标志 | `ProviderLogos` | `src/blocks/home/provider-logos.tsx` | `providers` | background | L2 |
| H4 | 能力拼贴 | `FeaturesBento` | `src/blocks/home/features-bento.tsx` | `features` | background，虚线分隔 | L2 |
| H5 | 特性格 | `FeatureGrid` | `src/blocks/home/feature-grid.tsx` | `capabilities` | background | L3 |
| H6 | 模型瀑布流 | `ModelMarquee` | `src/blocks/home/model-marquee.tsx` | `catalog` | background | L3 |
| H7 | 号召块 | `HomeCta` | `src/blocks/home/home-cta.tsx` | `get-started` | 深色块 + 网格光线 | L3 |

模型页（`design/模型.md`），最重要的区块：M2。

| # | 区块 | 组件 | 文件 | 锚点 | 底色 | 路 |
|---|---|---|---|---|---|---|
| M1 | 页首 | `ModelsHero` | `src/blocks/models/models-hero.tsx` | `models-hero` | background + 网格光线 | L4 |
| M2 | 模型浏览器 | `ModelsExplorer` | `src/blocks/models/models-explorer.tsx` | `explorer` | background | L4 |

价格页（`design/价格.md`），最重要的区块：P2。

| # | 区块 | 组件 | 文件 | 锚点 | 底色 | 路 |
|---|---|---|---|---|---|---|
| P1 | 页首 | `PricingHero` | `src/blocks/pricing/pricing-hero.tsx` | `pricing-hero` | background + 网格光线 | L5 |
| P2 | 价目表 | `PricingTables` | `src/blocks/pricing/pricing-tables.tsx` | `price-list` | background | L5 |
| P3 | 计费说明 | `PricingNotes` | `src/blocks/pricing/pricing-notes.tsx` | `notes` | background | L5 |
| P4 | 常见问题 | `PricingFaq` | `src/blocks/pricing/pricing-faq.tsx` | `faq` | surface | L5 |

分组页（`design/分组.md`），最重要的区块：G2。

| # | 区块 | 组件 | 文件 | 锚点 | 底色 | 路 |
|---|---|---|---|---|---|---|
| G1 | 页首 | `GroupsHero` | `src/blocks/groups/groups-hero.tsx` | `groups-hero` | background + 网格光线 | L6 |
| G2 | 分组卡 | `GroupCards` | `src/blocks/groups/group-cards.tsx` | `group-cards` | background | L6 |
| G3 | 倍率说明 | `RatioExplainer` | `src/blocks/groups/ratio-explainer.tsx` | `ratio` | surface | L6 |
| G4 | 特权对比 | `PrivilegeTable` | `src/blocks/groups/privilege-table.tsx` | `compare` | background | L6 |
| G5 | 常见问题 | `GroupsFaq` | `src/blocks/groups/groups-faq.tsx` | `faq` | background | L6 |
| G6 | 厂商标志 | `GroupsLogos` | `src/blocks/groups/groups-logos.tsx` | `providers` | background | L6 |

登录注册与其他（`design/登录注册.md`），最重要的区块：A1。

| # | 区块 | 组件 | 文件 | 锚点 | 底色 | 路 |
|---|---|---|---|---|---|---|
| A1 | 登录表单 | `LoginPanel` | `src/blocks/auth/login-panel.tsx` | `login` | background | L7 |
| A2 | 注册表单 | `RegisterPanel` | `src/blocks/auth/register-panel.tsx` | `register` | background | L7 |
| A3 | 右侧展示 | `AuthShowcase` | `src/blocks/auth/auth-showcase.tsx` | `auth-showcase` | surface | L7 |
| X1 | 文档占位 | `DocsPlaceholder` | `src/blocks/misc/docs-placeholder.tsx` | `docs` | background + 网格光线 | L7 |
| X2 | 404 | `NotFoundView` | `src/blocks/misc/not-found-view.tsx` | `not-found` | background + 网格光线 | L7 |

### 4.3 共享组件签名（地基路照写，各区块直接 import，不准自己再造）

两条硬规矩：样式拼接函数单独放在不带 `'use client'` 的文件里（服务端组件也要调用）；按参数切换样式一律用对象映射完整类名，禁止字符串拼接类名。

| 文件 | 导出 | 签名与样式 |
|---|---|---|
| `src/lib/utils.ts` | `cn` | `cn(...inputs: ClassValue[]): string`，即 `twMerge(clsx(inputs))` |
| `src/components/ui/button-styles.ts`（无指令） | `buttonClass`、`ButtonVariant`、`ButtonSize` | `buttonClass(opts?: { variant?: 'primary' \| 'secondary' \| 'ghost' \| 'link' \| 'inverse'; size?: 'sm' \| 'md' \| 'lg'; block?: boolean; className?: string }): string`，默认 primary + md。基础：`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,box-shadow,opacity] duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`。尺寸：sm `h-8 px-3 text-xs`；md `h-[38px] px-4 text-sm`；lg `h-11 px-6 text-sm md:text-base`。变体：primary `bg-primary text-primary-foreground shadow-button hover:bg-primary/90 active:bg-primary/80`；secondary `border border-border bg-card text-foreground shadow-card hover:bg-muted active:bg-muted/80`；ghost `text-foreground hover:bg-muted active:bg-muted/80`；link `h-auto rounded-none px-0 text-foreground underline-offset-4 hover:underline`；inverse `bg-white text-neutral-900 shadow-pill hover:bg-neutral-100 active:bg-neutral-200`。block 加 `w-full`。顺序：基础 → 尺寸 → 变体 → block → className，用 `cn` 合并（link 的 `px-0` 能盖掉尺寸的内边距） |
| `src/components/ui/button.tsx`（无指令） | `Button` | `<button>` 包一层：`ButtonHTMLAttributes<HTMLButtonElement> & { variant?; size?; block?; loading?: boolean }`，`type` 默认 `"button"`；`loading` 为真时禁用、`aria-busy="true"`、文字前加 `LoaderCircle` 带 `animate-spin`。跳转用 `<Link className={buttonClass(...)}>`，不要套 Button |
| `src/components/ui/badge.tsx`（无指令） | `Badge`、`BadgeTone` | `HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' \| 'outline' \| 'success' \| 'warning' \| 'danger' \| 'info' \| 'dark' \| 'inverse' }`，默认 neutral。基础 `inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4`。tone：neutral `bg-muted text-muted-foreground`；outline `border border-border text-muted-foreground`；success `bg-success-soft text-success`；warning `bg-warning-soft text-warning`；danger `bg-danger-soft text-danger`；info `bg-info-soft text-info`；dark `bg-primary text-primary-foreground`；inverse `border border-white/15 bg-white/10 text-navy-foreground` |
| `src/components/ui/container.tsx`（无指令） | `Container` | `{ as?: 'div' \| 'section' \| 'header' \| 'footer' \| 'nav'; className?; children }`，类名 `mx-auto w-full max-w-7xl px-4 md:px-8` |
| `src/components/ui/section-heading.tsx`（无指令） | `SectionHeading` | `{ title: ReactNode; subtitle?: ReactNode; align?: 'center' \| 'left'; as?: 'h1' \| 'h2'; className?: string; id?: string }`，默认 center + h2。外层 center `mx-auto max-w-3xl text-center`，left `max-w-3xl text-left`。标题用 2.2「内页标题 h1 / 区块标题 h2」类名；副标题 `mt-4` + 区块副标题类名（left 时去掉 `mx-auto`） |
| `src/components/ui/segmented-control.tsx`（`'use client'`） | `SegmentedControl`、`SegmentOption` | `SegmentedControl<T extends string>({ name, value, onChange, options, ariaLabel, size = 'md', tone = 'default', className }: { name: string; value: T; onChange: (v: T) => void; options: readonly { value: T; label: ReactNode; count?: number }[]; ariaLabel: string; size?: 'sm' \| 'md'; tone?: 'default' \| 'inverse'; className?: string })`。外层 `role="radiogroup"`、`aria-label`、`data-segmented={name}`，类名 default `relative inline-flex items-center rounded-lg bg-muted p-1`，inverse `relative inline-flex items-center rounded-lg bg-white/10 p-1`。每个选项 `<button type="button" role="radio" aria-checked data-segment={value} data-active={选中 ? 'true' : 'false'}>`，类名 `relative z-0 inline-flex items-center rounded-md font-medium transition-colors`，md `h-9 px-4 text-sm`，sm `h-7 px-3 text-xs`；未选中 default `text-muted-foreground hover:text-foreground`，inverse `text-navy-muted hover:text-white`；选中 default `text-primary-foreground`，inverse `text-neutral-900`。选中块是 `motion.span`，`layoutId={\`seg-${name}\`}`，`absolute inset-0 -z-10 rounded-md`，default `bg-primary shadow-button`，inverse `bg-white`，弹簧见第 3 章。`count` 有值时标签后加 `<span className="ml-1.5 tabular-nums opacity-60">{count}</span>`。键盘：左右方向键切换并聚焦（选中项 `tabIndex=0`，其余 `-1`） |
| `src/components/ui/check-list.tsx`（无指令） | `CheckList` | `{ items: readonly ReactNode[]; tone?: 'default' \| 'inverse'; className? }`。`<ul className="space-y-3">`，每项 `<li className="flex items-start gap-3 text-sm">` + 18px 内联 SVG（`viewBox="0 0 24 24"`，`<circle cx="12" cy="12" r="10" fill="currentColor"/>` + `<path d="M8 12.5l2.5 2.5L16 9.5" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>`）。default：圆 `text-neutral-700 dark:text-neutral-300`、对勾 `stroke="var(--background)"`、文字 `text-muted-foreground`；inverse：圆 `text-white`、对勾 `stroke="var(--navy)"`、文字 `text-navy-foreground/90`。SVG 加 `aria-hidden`、`className="mt-px size-[18px] shrink-0"` |
| `src/components/ui/faq-list.tsx`（`'use client'`） | `FaqList` | `{ items: readonly { q: string; a: string }[]; className? }`，Radix Accordion `type="single" collapsible`。每项 `<Accordion.Item data-faq-item={index} className="border-b border-border">`；触发 `group flex w-full items-center justify-between gap-6 py-5 text-left text-base font-medium text-foreground` + `Plus` 图标 `size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-45`；内容 `pb-5 pr-10 text-sm leading-6 text-muted-foreground` |
| `src/components/ui/dropdown-menu.tsx`（`'use client'`） | `DropdownMenu`、`DropdownMenuTrigger`、`DropdownMenuContent`、`DropdownMenuItem`、`DropdownMenuRadioGroup`、`DropdownMenuRadioItem`、`DropdownMenuLabel`、`DropdownMenuSeparator` | shadcn new-york 写法。Content：`z-50 min-w-40 overflow-hidden rounded-xl border border-border bg-card p-1 text-foreground shadow-card`，默认 `sideOffset={8}`，放在 Portal 里。Item：`relative flex cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50`。RadioItem：同 Item 加 `pr-8`，右侧 `ItemIndicator` 放 `Check size-4` |
| `src/components/ui/input.tsx`（无指令） | `Input` | `forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>`，类名 `h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] placeholder:text-subtle-foreground focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-foreground/5 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10` |
| `src/components/ui/field.tsx`（无指令） | `Field` | `{ label: ReactNode; htmlFor: string; error?: string \| null; hint?: ReactNode; trailing?: ReactNode; children }`：`<div className="space-y-2">`，标签行 `flex items-center justify-between`（左 `<label className="text-sm font-medium text-foreground">`，右 `trailing`，例如「忘记密码？」），下面 children，有 error 时 `<p id={\`${htmlFor}-error\`} role="alert" className="text-xs text-danger">`，否则有 hint 时 `<p className="text-xs text-subtle-foreground">` |
| `src/components/effects/grid-beams.tsx`（无指令） | `GridBeams` | `{ className?: string; beams?: boolean }`，默认 beams 开。外层 `aria-hidden` `pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]`。内层 SVG `absolute inset-0 size-full`，`<pattern>` 宽 240 高 164（`patternUnits="userSpaceOnUse"`，id 用 `useId()` 去掉冒号），图案里画右边线和下边线（`stroke="var(--grid-line)"`，1px）和右下角交点圆 `r="3" fill="var(--grid-dot)"`。光线 6 条，配置写成常量数组：纵向 3 条贴在 x = 240、720、1200 的竖线上（`absolute top-0 h-28 w-px bg-gradient-to-b from-transparent via-beam to-transparent animate-beam-y`，`--beam-duration` 9s/11s/8s，`--beam-delay` -1s/-6s/-3s，`--beam-travel` 900px），横向 3 条贴在 y = 164、328、492 的横线上（`absolute left-0 h-px w-28 bg-gradient-to-r from-transparent via-beam to-transparent animate-beam-x`，12s/10s/13s，-4s/-8s/-2s，`--beam-travel` 1440px），每条带 `data-beam` |
| `src/components/effects/marquee.tsx`（无指令） | `Marquee` | `{ children; direction?: 'left' \| 'right' \| 'up' \| 'down'; duration?: number; gap?: number; pauseOnHover?: boolean; className?: string; groupClassName?: string }`，默认 left、40、16、true。外层 `group/marquee overflow-hidden` + className。轨道 `<div data-marquee-track>`：横向 `flex w-max animate-marquee-x`，纵向 `flex w-full flex-col animate-marquee-y`；right/down 加 `[animation-direction:reverse]`；pauseOnHover 加 `group-hover/marquee:[animation-play-state:paused]`；行内样式 `--marquee-duration: ${duration}s`。轨道里放两份相同的 `<div>`（横向 `flex shrink-0`，纵向 `flex flex-col`，加 groupClassName），行内样式 `gap` 与同方向的结尾内边距都等于 gap，第二份 `aria-hidden` |
| `src/components/effects/globe.tsx`（`'use client'`） | `Globe` | `{ className?: string }`。`<canvas className="aspect-square size-full opacity-0 transition-opacity duration-700 [contain:layout_paint_size]">`，`useEffect` 里 `createGlobe(canvas, { devicePixelRatio: 2, width: 1200, height: 1200, phi: 0, theta: 0.25, dark: 1, diffuse: 1.2, mapSamples: 16000, mapBrightness: 6, baseColor: [0.3,0.3,0.3], markerColor: [0.15,0.55,1], glowColor: [1,1,1], markers: 北京 39.90,116.41 / 上海 31.23,121.47 / 香港 22.32,114.17 / 新加坡 1.35,103.82 / 东京 35.68,139.65 / 旧金山 37.77,-122.42 / 法兰克福 50.11,8.68 / 伦敦 51.51,-0.13，size 都是 0.06, onRender: phi 每帧 +0.004（减少动态效果时不转） })`，首帧后把 canvas 透明度设 1，卸载时 `destroy()`。`createGlobe` 抛错（无 WebGL）时改渲染 `<div className="aspect-square size-full rounded-full bg-[radial-gradient(circle_at_30%_30%,#3f3f46,#09090b_70%)]" />` |
| `src/components/catalog/provider-logo.tsx`（无指令） | `ProviderLogo` | `{ provider: ProviderId; size?: number; className?: string }`，默认 20。`<img src={logo} alt={name} width={size} height={size} loading="lazy" decoding="async" className={cn('shrink-0 select-none', mono && 'dark:invert', className)} />`，数据取 `getProvider` |
| `src/components/catalog/provider-logo-cloud.tsx`（`'use client'`） | `ProviderLogoCloud` | `{ className?: string }`。两组：A `openai anthropic google deepseek`，B `moonshot zhipu minimax qwen`，每 3000ms 换一组（减少动态效果时停在 A）。外层 `grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4`，`data-logo-cloud`，`data-logo-set="0"`/`"1"`。每格 `flex h-14 items-center justify-center`，里面 `AnimatePresence mode="wait" initial={false}`（首组直接显示，不等水合）按厂商 id 换 `motion.div`：`initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}`、`animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}`、`exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}`、`transition={{ duration: 0.45, delay: 格序号 × 0.08, ease: [0.22,1,0.36,1] }}`；内容 `flex items-center gap-3`：`ProviderLogo size={32}` + `<span className="text-xl font-semibold tracking-tight text-foreground/85 md:text-2xl">{厂商名}</span>` |
| `src/components/catalog/discount-badge.tsx`（无指令） | `DiscountBadge` | `{ discount: number \| null; locale: AppLocale; className? }`：`formatDiscount` 为空时返回 `null`；否则 `<Badge tone="success" data-discount className={className}>{文字}</Badge>` |
| `src/components/catalog/edition-switcher.tsx`（`'use client'`） | `EditionSwitcher` | `{ className?: string; size?: 'sm' \| 'md' }`。读写 `useEdition()`，渲染 `SegmentedControl name="edition"`，选项来自 `EDITIONS`，标签 `edition.name[locale]`，`ariaLabel` 取 `common.edition.label` |
| `src/components/catalog/edition-summary.tsx`（`'use client'`） | `EditionSummary` | `{ className?: string }`。读 `useEdition()`，一行四项，外层 `flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm`，`data-edition-summary`。每项 `<span className="inline-flex items-center gap-1.5"><span className="text-subtle-foreground">{标签}</span><span data-summary={key} className="font-medium tabular-nums text-foreground">{值}</span></span>`。四项：`sla` 值 `${slaTarget.toFixed(1)}%`；`channel` 值 `channel[locale]`；`rpm` 值 `rpm.toLocaleString('en-US')`；`ratio` 值 `ratioLabel(editionRatio(edition, 'text'))`。标签取 `common.editionSummary.<key>` |
| `src/components/layout/brand.tsx`（无指令） | `Brand` | `{ className?: string }`：`<Link href="/" className="flex items-center gap-2 text-sm font-medium text-foreground">`，前面一个 `aria-hidden` 的 `block h-5 w-6 rounded-md bg-primary` 色块（模板同款黑色圆角块），后面 `SITE.name` |
| `src/components/layout/theme-toggle.tsx`（`'use client'`） | `ThemeToggle` | `{ className?: string }`：`<button type="button" data-theme-toggle aria-label={common.theme.toggle} className={buttonClass({ variant: 'ghost', size: 'sm', className: 'size-9 px-0 text-muted-foreground hover:text-foreground' })}>`，里面 `Sun className="size-4 dark:hidden"` 和 `Moon className="hidden size-4 dark:block"`，点击 `setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')` |
| `src/components/layout/language-switcher.tsx`（`'use client'`） | `LanguageSwitcher` | `{ className?: string; full?: boolean }`。触发按钮 `data-lang-trigger`，`aria-label={common.language.label}`，类名 `buttonClass({ variant: 'ghost', size: 'sm', className: 'h-9 gap-1.5 px-3 text-muted-foreground hover:text-foreground' })`，内容 `Languages` 图标 + 文字（full 时显示 `简体中文`/`English`，否则 `中文`/`EN`）+ `ChevronDown size-3.5`。菜单是 `DropdownMenuRadioGroup value={locale}`，两项 `zh`「简体中文」、`en`「English」，每项 `data-lang={code}`。切换时 `router.replace(\`${pathname}${window.location.search}\`, { locale: next, scroll: false })`（`useRouter`、`usePathname` 来自 `@/i18n/navigation`），保留 `?edition=` 等参数 |
| `src/components/layout/site-header.tsx`（`'use client'`） | `SiteHeader` | 无参数。见 4.5 |
| `src/components/layout/site-footer.tsx`（无指令） | `SiteFooter` | 无参数。见 4.6 |
| `src/components/layout/page-hero.tsx`（无指令） | `PageHero` | `{ id: string; title: ReactNode; subtitle?: ReactNode; children?: ReactNode; className? }`：`<section id={id} className={cn('relative overflow-hidden pt-16 pb-12 md:pt-24 md:pb-16', className)}>` + `<GridBeams />` + `<Container className="relative">` + `<SectionHeading as="h1" title subtitle />` + children 时 `<div className="mt-8 flex flex-col items-center gap-5">{children}</div>`。模型、价格、分组三页的页首都用它 |

### 4.4 页内与跨区块状态（主控已写好，直接用）

- `src/lib/use-catalog-state.ts`（`'use client'`）：`useEdition(): [EditionId, (e: EditionId) => void]`（网址 `?edition=`，默认 `personal`）；`useCurrency(): [Currency, (c: Currency) => void]`（网址 `?currency=`，默认 `usd`）。
- `src/lib/use-url-state.ts`（`'use client'`）：`useUrlState(key, allowed, fallback)`、`useUrlList(key, allowed)`、`useUrlText(key)`，模型页的筛选条件用它们存进网址。
- 这几个钩子服务端和首次水合时返回默认值，水合后才读真实网址，**不需要 Suspense**，也不会有水合告警。

### 4.5 顶栏 `SiteHeader`

- 外层 `<header data-site-header className="sticky top-0 z-50 w-full px-4 pt-3 md:px-6">`。
- 桌面（`lg` 及以上）一行 `<nav className="mx-auto hidden h-14 max-w-7xl items-center justify-between rounded-full px-6 transition-[background-color,box-shadow,transform] duration-300 lg:flex">`；滚动超过 80px（`useScroll` + `useMotionValueEvent`）加 `translate-y-1.5 bg-background/80 shadow-nav backdrop-blur-md`，否则 `bg-transparent`。
  - 左：`Brand`，后面 `<ul className="ml-10 flex items-center gap-1">` 四个菜单（`NAV_ITEMS`，文字 `common.nav.<key>`）。每个 `<Link data-nav={key} aria-current={当前页 ? 'page' : undefined} className="relative rounded-md px-4 py-2 text-sm transition-colors">`；当前页 `bg-muted text-foreground`，其余 `text-muted-foreground hover:text-foreground`；悬停时非当前页项下面垫一个 `motion.span layoutId="nav-hover" className="absolute inset-0 -z-10 rounded-md bg-muted"`。当前页判断：`pathname === href || pathname.startsWith(href + '/')`。
  - 右：`<div className="flex items-center gap-1">` 依次 `LanguageSwitcher`、`ThemeToggle`、`<Link data-nav-login href="/login" className={buttonClass({ variant: 'ghost' })}>登录</Link>`、`<Link data-nav-register href="/register" className={buttonClass()}>注册</Link>`（文字 `common.nav.login` / `register`）。
- 手机（`lg` 以下）：`<div className="mx-auto flex h-14 items-center justify-between rounded-full px-4 transition-[background-color,box-shadow] duration-300 lg:hidden">`，滚动后同样加 `bg-background/80 shadow-nav backdrop-blur-md`。左 `Brand`，右 `ThemeToggle` + 汉堡按钮（`data-mobile-menu-trigger`、`aria-expanded`、`aria-controls="mobile-menu"`、`aria-label` 取 `common.nav.openMenu`/`closeMenu`，图标 `Menu`/`X`）。
  - 展开面板 `AnimatePresence` + `motion.div id="mobile-menu" data-mobile-menu`，`initial={{ opacity: 0, y: -8 }}`、`animate={{ opacity: 1, y: 0 }}`、`exit={{ opacity: 0, y: -8 }}`、0.2s；类名 `absolute inset-x-4 top-[calc(100%+8px)] rounded-2xl border border-border bg-card p-4 shadow-card`。内容：四个菜单 `block rounded-md px-3 py-3 text-base text-foreground hover:bg-muted`（当前页加 `bg-muted`）→ `my-3 border-t border-border` → `LanguageSwitcher full` → `mt-3 grid gap-2`：登录（`buttonClass({ variant: 'secondary', block: true })`）、注册（`buttonClass({ block: true })`）。
  - 点菜单项、按 Esc、路由变化都收起；打开时 `body` 不加滚动锁。
- 顶栏只有这一个，(site) 布局和 404 页渲染它。

### 4.6 页脚 `SiteFooter`

```
<footer data-site-footer className="relative overflow-hidden border-t border-border">
  <Container className="flex flex-col gap-12 py-16 md:flex-row md:items-start md:justify-between">
    <div className="space-y-4">
      <Brand />
      <p className="text-sm text-muted-foreground">© {SITE.copyrightYear} {SITE.name}</p>
      <p className="text-sm text-muted-foreground">{common.footer.rights}</p>
    </div>
    <div className="grid grid-cols-2 gap-x-16 gap-y-10 sm:grid-cols-3">
      FOOTER_COLUMNS 每列一个 <nav aria-label={common.footer.columns.<key>}><ul className="space-y-4">
        每个链接 <li> 内：href 以 / 开头用 Link，'#' 用 <a>，类名 text-sm text-muted-foreground transition-colors hover:text-foreground，文字 common.footer.links.<key>
    </div>
  </Container>
  <p aria-hidden className="pointer-events-none select-none bg-gradient-to-b from-neutral-50 to-neutral-200 bg-clip-text pb-6 text-center text-[19vw] font-bold leading-[0.8] tracking-tighter text-transparent dark:from-neutral-950 dark:to-neutral-800 xl:text-[232px]">{SITE.wordmark}</p>
</footer>
```

列表不加列标题（与模板一致），列名只做 `aria-label`。

---

## 5. 各区块详细规格

按页拆在 `design/` 下，每个区块写七项：外层、元素、数据、交互、状态、响应式、文案。

- [design/首页.md](design/首页.md) —— H1–H7
- [design/模型.md](design/模型.md) —— M1–M2
- [design/价格.md](design/价格.md) —— P1–P4
- [design/分组.md](design/分组.md) —— G1–G6
- [design/登录注册.md](design/登录注册.md) —— A1–A3、X1–X2

---

## 6. 文案原则

- 中文是主语言，英文逐条对译，语气专业、克制，像企业服务商写给采购和开发负责人看的，不写口号和感叹号。
- **文案全部放进各路自己的消息文件**（`src/messages/zh/<命名空间>.json` 与 `src/messages/en/<命名空间>.json`），组件里不准写死任何中文或英文句子（品牌名从 `SITE.name` 取；模型名、厂商名、协议名、价格数字来自数据层，不进消息文件）。两份文件的键必须完全一致（单测会查）。消息里带变量用 ICU 写法：`"共 {count} 个模型"`，调用 `t('count', { count })`。
- 最小必要信息：删掉不影响理解或操作的字就不加；能只留标题就不加副标题；不给每个区块都配标题、说明和提示。
- 禁止：「示意」「数据非实测」「演示数据」「建设中」「敬请期待」「即将上线」「V1 暂不支持」「后续开放」这类开发说明；「一切运行正常」这类空洞状态句；虚构客户评价、客户名称和客户标志；任何读取、检测、审查调用内容的说法；使用场景介绍；代码调用示例；「最」「第一」「100%」这类绝对化用语（数据里的可用率数字除外）。
- 数字写具体：「30 个模型」「99.9%」，数字一律从数据层算，不写死在文案里（文案用 `{count}` 占位）。
- 单位：中文「美元 / 百万 Token」「/ 张」，英文「/ 1M tokens」「/ image」。中文与英文、数字之间留一个半角空格（「30 个模型」「GPT-6 Astra 已上线」）。
- 按钮文字写动作：「免费注册」「查看价格」「联系销售」，链接文字写去向。

---

## 7. 质量门禁

主控统一执行：

```bash
pnpm test          # 数据层单测 + 中英文案键一致
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm build         # next build（Turbopack）
pnpm format:check  # prettier
```

实现会话只跑 `pnpm typecheck`（以及 `pnpm exec eslint <自己的目录>`），**不准跑 build、不准起开发服务器**。

自查清单：

- 用了 `useState` / `useEffect` / 事件处理 / motion 组件 / `useTranslations` 以外的客户端钩子的文件，第一行是 `'use client'`；纯展示的不加。服务端组件不能给客户端组件传函数参数。
- 禁止 `any`、`@ts-ignore`、`@ts-expect-error`、`eslint-disable`、未使用的变量和 import。
- 禁止 `Math.random()`、`Date.now()`、`new Date()`（时间相关一律用数据层的 `CATALOG_AS_OF`）。
- 组件里不写死业务数字（价格、倍率、数量、可用率），全部来自 `@/lib/catalog`、`@/lib/content/console-preview` 或 `SITE`。
- 不写十六进制色值（2.1 的三个例外除外），不拼接类名。
- 手机 375 宽不出现横向滚动条；宽表格放进 `overflow-x-auto` 容器，网格子项里的横向滚动区给子项加 `min-w-0`。
- 图片有 `alt`（装饰图 `alt=""` 加 `aria-hidden`）；图标按钮有 `aria-label`；装饰 SVG 加 `aria-hidden`；有意义的 SVG 图表加 `role="img"` 和 `aria-label`。
- 所有可交互元素键盘可达、焦点可见。
- 长文本：卡片标题 `truncate` 或 `line-clamp-2`，描述 `line-clamp-2`/`line-clamp-3`，表格单元格 `whitespace-nowrap` 或 `break-words` 二选一写明。
- 页面层写了的 `data-*`、`id`、`aria-label`、按钮文字一字不改。

---

## 8. 文件写入边界与分路表（并发协作铁律）

公共文件（**区块实现会话一律不准碰**）：`src/app/**`、`src/components/**`、`src/lib/**`、`src/i18n/**`、`src/proxy.ts`、`src/global.d.ts`、`src/messages/index.ts`、`src/messages/*/common.json`、`public/**`、`tests/**`、`package.json`、`pnpm-lock.yaml`、所有配置文件、`DESIGN.md`、`design/**`。

每路只写分给自己的文件；要拆子组件，只能放在本页目录、文件名以自己的区块文件名开头（例如 `src/blocks/home/features-bento-globe-card.tsx`）。每路的消息文件里已有的 `meta` 键原样保留，只往里加。

只能 import：`react`、`motion/react`、`next-intl`、`next-intl/server`、`next-themes`、`lucide-react`（白名单）、`@radix-ui/*`（已装的三个）、`@/i18n/navigation`、`@/i18n/routing`（只取类型）、`@/components/**`、`@/lib/**`，以及自己新建的文件。**不 import 其他区块的文件。**

| 路 | 负责的文件 |
|---|---|
| L0 地基 | 第 4.3 节全部共享组件、`src/app/[locale]/(site)/**`、`src/app/[locale]/(auth)/**`、`src/app/[locale]/not-found.tsx`、`src/blocks/**` 全部占位、`eslint.config.mjs` |
| L1 首页首屏 | `src/blocks/home/hero*.tsx`、`src/blocks/home/console-preview*.tsx`、`src/messages/{zh,en}/homeHero.json` |
| L2 首页能力 | `src/blocks/home/provider-logos*.tsx`、`src/blocks/home/features-bento*.tsx`、`src/messages/{zh,en}/homeShowcase.json` |
| L3 首页下半 | `src/blocks/home/feature-grid*.tsx`、`src/blocks/home/model-marquee*.tsx`、`src/blocks/home/home-cta*.tsx`、`src/messages/{zh,en}/homeMore.json` |
| L4 模型页 | `src/blocks/models/**`、`src/messages/{zh,en}/models.json` |
| L5 价格页 | `src/blocks/pricing/**`、`src/messages/{zh,en}/pricing.json` |
| L6 分组页 | `src/blocks/groups/**`、`src/messages/{zh,en}/groups.json` |
| L7 登录注册与其他 | `src/blocks/auth/**`、`src/blocks/misc/**`、`src/messages/{zh,en}/auth.json`、`src/messages/{zh,en}/misc.json` |

---

## 9. 哪些是编的

| 项 | 状态 |
|---|---|
| 品牌名 Nexus API、标志色块 | **编的**，沿用旧版临时品牌；只改 `src/lib/site.ts` |
| 30 个模型的型号、上线日期、上下文、协议 | 型号参考 onehop.ai 与本仓库后端认识的模型名（2026-10-03）；上线日期、协议支持为**编的** |
| 官方价 | 由 onehop.ai 2026-10-03 公开价目反推（onehop 价 ÷ 其折扣），未逐个核对厂商官网 |
| 个人版折扣、三个版本与 12 个分组的倍率 | **编的**，`src/lib/catalog/models.ts`、`groups.ts`；单测锁住了换算结果 |
| 可用率目标、渠道类型、RPM、并发、组织成员上限、工单响应时限、特权对比各项 | **编的**，`editions.ts`、`groups.ts` |
| 近 24 小时可用率与状态格 | **编的**，固定种子生成（`uptime.ts`），接监测后替换 |
| 人民币汇率 7.1、按 Token 计费生图的每张估算 1290 Token | **编的**，`pricing.ts` |
| 首页控制台预览里的消费、请求数、图表 | **编的**，`src/lib/content/console-preview.ts` |
| 首页四张黑白示例图 | AI 生成（imagegen，gpt-image），`public/showcase/` |
| 厂商标志 | lobehub icons（MIT），`public/providers/`；谷歌登录按钮标志 `public/brands/google.svg` |
| 登录、注册、谷歌登录 | 占位，不连后端 |

---

## 附录 数据接口（主控已写好并通过 33 条单测，**一个字都不要改**）

`import { ... } from '@/lib/catalog'`：

| 导出 | 用途 |
|---|---|
| `MODELS: readonly Model[]` | 30 个模型（23 文本、7 生图），字段见 `types.ts` |
| `PROVIDERS`、`getProvider(id)` | 8 个厂商：名称、标志路径、是否单色 |
| `EDITIONS`、`EDITION_IDS`、`getEdition(id)`、`isEditionId(v)` | 三个版本：名称、一句话、可用率目标、渠道、RPM、并发、工单时限 |
| `GROUPS`、`groupsFor(edition)`、`defaultGroup(edition, type)`、`editionRatio(edition, type)`、`ratioLabel(r)`、`PRIVILEGE_ROWS` | 分组、倍率、特权对比 |
| `textPrice(model, edition)` | 文本单价（美元 / 百万 Token）：input、output、cacheRead、longContext |
| `imagePrice(model, edition)` | 生图价：按张（resolutions、from）或按 Token（perMTokens、estimatedPerImage） |
| `effectiveDiscount(model, edition)`、`formatDiscount(d, locale)` | 折扣与折扣标文字（「3折」/「70% off」，不打折时 null） |
| `formatMoney(usd, currency)`、`formatAmount(n)`、`convert(usd, currency)`、`USD_CNY_RATE` | 金额（`$0.6` / `¥4.26`） |
| `formatContext(tokens)`、`formatRatio(r, locale)`、`localize(value, locale)` | 上下文、倍率、中英文字段 |
| `isNewModel(model)`、`CATALOG_AS_OF`、`IMAGE_TOKENS_PER_IMAGE` | 「新」标记（30 天内上线的 7 个） |
| `filterModels(models, filter, edition)`、`facetCounts(models, type)`、`groupByProvider(models)`、`DEFAULT_FILTER`、`TYPE_FILTERS`、`CONTEXT_FILTERS`、`SORT_KEYS`、`PROTOCOLS`、`PROTOCOL_LABELS` | 模型页筛选排序、价目表分段 |
| `uptimeFor(modelId, edition)`、`UPTIME_SLOTS` | 近 24 小时可用率（percent）与 24 个状态格（up/degraded/down） |

其他：`SITE`、`NAV_ITEMS`、`FOOTER_COLUMNS`（`@/lib/site`）；`PREVIEW_*`（`@/lib/content/console-preview`）；`useEdition`、`useCurrency`（`@/lib/use-catalog-state`）；`useUrlState`、`useUrlList`、`useUrlText`（`@/lib/use-url-state`）；`initPage`、`LocaleParams`（`@/i18n/page`）。

单测算出的几个关键数字（交互检查会用）：全部 30 / 文本 23 / 生图 7；厂商 OpenAI 10、Anthropic 6、Google 8；只看 Anthropic 文本 6 个；上下文 ≥1M 共 21 个；搜「nano」4 个、搜「gemini」8 个；默认排序第一个 Claude Sonnet 5.5；文本按价格从低到高第一个 GPT-6 Luna；Claude Sonnet 5.5 输入单价 个人 $0.6、专业 $0.84、企业 $1.2，人民币个人 ¥4.26；折扣标 3折 / 4.2折 / 6折。
