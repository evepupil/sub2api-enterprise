# Proactiv 整站改版实施规格

状态：实现已交付，工程门禁通过，浏览器验收待完成 · 2026-09-28 · 属于 [M0](../docs/roadmap.md#m0)、[M1](../docs/roadmap.md#m1)，并覆盖 M2–M4 已有业务页的统一外观。

## 0. 本次目标和验收

用户要求：首页、顶部导航和全部界面参考 [Aceternity Proactiv](https://ui.aceternity.com/template-preview/proactiv-marketing-template)，使用 Aceternity UI，文案与营销内容允许虚构，必须填满。覆盖首页、模型目录、状态、帮助、登录/注册/找回/重置、控制台概览/密钥/用量/余额/设置/团队/团队用量及支付结果。保留已有功能、权限和数据接口。

先完成统一主题，再并行实施。首页按第 5 节的企业版区块实施（2026-09-28 用户要求改版后共 10 个区块，不含导航、页脚）；其它页面保留完整业务区块。每个内容区块含至少三个有用元素，避免只有标题和一句空话。首屏有查看模型与开始使用。移动端 390px、桌面 1440px；手机按钮至少 44px；全页无横向溢出；导航、分类、常见问题、日期、表单与对话框可操作。焦点可见，减少动态偏好有效，正文不以 JS 动画完成作为可见的前提。

门禁：格式、静态分析、严格类型、现有核心业务测试、Windows 生产构建；已有本地开发服务持续验收。纯展示不新增单测。浏览器截图和点击单独记录，未做不可声称通过。

## 1. 参考观察

已读取官方预览与实际站 https://proactiv-aceternity.vercel.app ，并目视官方截图 1、3。具体采用：近黑底、白至灰渐变大标题、青蓝 CTA、顶部悬浮窄边框导航、产品面板透视展示、功能卡网格、左右交替的产品展示、费用区、FAQ 和完整页脚（客户故事卡已在 2026-09-28 企业版改版时删除）。原模板是营销工具，本项目内容替换成 AI API 服务；不添加套餐、模型详情页或在线模型试用。

免费 Aceternity 来源：Spotlight、Container Scroll Animation、Moving Border、Infinite Moving Cards，官方 registry JSON 已存于忽略目录 `.fleet/reference-proactiv/`。复用现有 `components/effects/` 并按项目令牌适配；需要的追加组件同目录。使用现有 motion/react，禁止下载或宣称拥有付费模板源码。组件出处写入素材归档。

## 2. 统一设计系统

默认整站深色，令牌唯一写入 `src/styles/tokens.css`。背景 #090b0d、卡片 #111518、次级面 #191e23、文字 #f4f7fa、次级文字 #9ca7b3、边框 #262e35、青蓝主色 #39c8f4、主按钮文字 #061116。成功 #52d6a0、警告 #edbd64、错误 #ff8d87。图表六色青蓝/绿/紫/琥珀/浅蓝/玫红，图表文字和 tooltip 同步深色。

字体：Inter / Noto Sans SC / 微软雅黑 / 系统无衬线；数据使用等宽数字。标题 80px 桌面、60px 平板、40px 手机，行高 1.12；区块标题 42/32/28px；正文 16px，业务控件 14px。官网最大内容宽 1200px，外侧 24/32px；业务区域保留 1408px。区块纵向间距 96px 桌面、64px 手机。卡片圆角 16px、控件 8px、弹层 16px；大产品框 20px。无任意新增颜色，尺寸使用统一变量或 Tailwind 间距阶梯。

按钮、输入、选择器、弹窗继续复用现有 ui 组件；不引入第二套库。卡片使用深色微渐变、1px 描边、顶部微亮边。主按钮青蓝，次按钮描边。官网可有光效与滚动透视，控制台避免背景动态。全站原白底、灰字、图表颜色必须检查。

## 3. 共享外壳和组件契约

- `Brand` 保留原签名，自绘几何 N 标志；未配置或旧默认“模型服务”时使用临时品牌 Nexus API，自定义站名原样显示并处理长文本。
- `PublicShell` 保留参数及配置开关。桌面导航：产品能力 `/#platform`、模型价格 `/catalog`、计费方式 `/#pricing`、服务状态 `/status`、开发文档 `/help`。右侧使用后端提供的账号操作。1280px 以上浮动条 top16px，初始透明，滚动后深色模糊卡片；无正文遮挡。手机使用已有 Radix 菜单，点击链接和 Escape 关闭、焦点返回，品牌与打开菜单按钮可见。锚点链接不要一起标成当前页。
- `PublicFrame` 保留接口，页脚由四列构成：品牌与一句定位、产品 4 链接、资源 4 链接、账户 3 链接。所有链接接真实路由或首页锚点，不设置空链接，不添加虚构外部联系方式；创建账户仅在注册开启时出现，关闭时用登录、控制台和帮助组合。底部 Nexus API 与 2026、USD / 按量计费。
- `ConsoleShell` 保留侧栏/手机菜单/权限/底部设置；换成同套深色配色、青蓝当前项和边框卡片。四张统计卡保留图标、环图保留合计。全部私有页面使用真实数据，零记录保持真实空态和可用下一步。
- `PageHeader` 保留签名，改为统一深色页面标题、可选操作。
- 新 `components/marketing/section-heading.tsx`：`SectionHeading({eyebrow?,title,description?,align?:'left'|'center',id?})`，有语义 h2，无客户端依赖。
- 新 `components/marketing/marketing-link.tsx`：`MarketingLink({href,children,variant?:'default'|'outline',arrow?:boolean})`，复用 Button，可选择 ArrowRight 图标，不能嵌套 button/a。
- `components/effects/moving-border.tsx`：`MovingBorder({children,className?})`，div 外框装饰，内部不造第二个按钮；Aceternity SVG 路径动效，严格 ref 类型、无 any、减少动态时停止。
- `.marketing-shell`/`.marketing-section`/`.marketing-section-heading`/`.marketing-eyebrow`/`.marketing-actions` 等公共类由 foundation 在 `styles/marketing-base.css` 定义。首页前半专属样式 `marketing.css`，后半 `marketing-sections.css`，内页 `public-pages.css`；均在 globals.css 引入。foundation 创建空后两文件后由各自实施路接管。

## 4. 页面和文件分工

| 实施路 | 文件所有权 | 内容 |
|---|---|---|
| 共享基础 | styles/tokens.css、globals.css、marketing-base.css；components/layout/*；components/marketing/*；components/effects/*；features/public/public-frame.tsx | 主题、导航、页脚、基础组件、Aceternity 效果 |
| 首页前半 | features/home/home-view.tsx、home-hero.tsx、dashboard-showcase.tsx、platform-section.tsx、model-preview.tsx；styles/marketing.css | 首屏、产品面板、品牌带、六项核心能力、模型价格；导入后半组件 |
| 首页后半 | features/home/marketing-sections.tsx、governance-section.tsx、pricing-section.tsx、service-section.tsx、faq-section.tsx；styles/marketing-sections.css | 组织管控、计费方式、服务保障、FAQ、CTA |
| 公开及账号内页 | features/catalog/catalog-view.tsx、model-card.tsx；features/status/status-view.tsx；features/help/help-view.tsx；features/auth/auth-layout.tsx；styles/public-pages.css | 各页首屏/信息块/表单外框统一；保留业务交互 |
| 控制台补齐 | features/usage/charts/ 及现有图表纯展示文件、features/console/overview-view.tsx（以实际路径为准）、features/billing/payment-result-view.tsx（以实际路径为准） | 深色图表、真实空态、现有卡片一致性；不改计算/查询/会话 |
| 主控 | DESIGN.md、design/*、docs/*、src/content/marketing.ts | 设计、营销内容集中登记、验收和集成 |

不得改 backend/、原 frontend/、身份会话业务、余额计算、价格解析、监控历史含义或权限。所有实施路不提交、不推送、不启动服务，只检查自己 TypeScript 和格式。

## 5. 首页逐区块规格

2026-09-28 用户要求首页改为企业版定位，文案参考原前端企业落地页（`frontend/src/i18n/locales/zh/landing.ts`），突出高可用、低延迟、访问控制等产品能力，不突出可接入的各种工具。据此删除使用场景、客户故事与工具生态三个区块，全部文案集中在 `src/content/marketing.ts`。内容边界：

- 能力与参数只写已按代码和文档核实的实现，核实记录见[官网素材与动效来源](../docs/前端设计/官网素材与动效来源.md)；
- 不写读取、检测或审查调用内容的能力说法，调用记录只指用量、费用与耗时等统计信息；
- 不写使用场景与客户案例，不放调用示例、代码块或技术规格表，不强调兼容工具；
- 不加示意、数据声明之类的说明性标注，区块只保留必要标题，说明文字能省则省。

1. **首屏**：小胶囊“AI 模型网关 · 企业版”与箭头链接 /catalog；两行大标题“统一接入 · 组织管控 / 高可用 · 低延迟”；一句定位说明；开始使用与查看模型两个按钮，href 取配置；下方三个要点“多账号冗余调度”“密钥级访问控制”“单价逐项公开”。Spotlight 从左右上方照入；主标题从灰到白渐变。手机首屏看到两个操作。
2. **产品面板**：用现有 ContainerScroll 包裹真实 HTML 组成的控制台示意，替换旧截图。顶栏“工作台 / 近 7 天”；左侧紧凑导航；四卡余额 $286.40、请求 48,296、Token 12.8M、消费 $86.72；主区消费面积图与模型环图、3 条模型费用行。图表采用固定构造数据，在营销数据文件登记。宽屏 1060px，手机隐藏侧栏、保留四卡和两张图，禁止缩成不可读截图。
3. **模型厂家带**：“覆盖主流模型厂家”（只保留小标签与标题），OpenAI、Anthropic、Google、DeepSeek、Qwen 五个品牌文字/本地商标，无“官方合作”承诺。轻微滚动可关闭，手机换行不挤压。
4. **核心能力 #platform**：标题“为企业规模使用而设计”；6 张等宽卡（桌面 3×2、平板 2 列、手机 1 列），卡片不跳转，带边框发光：高可用调度、低延迟转发、访问控制、组织账户体系、多模型统一接入、独立部署。每卡短标题、一句核实过的说明、一个小示意图；示意图不出现编造的延迟、可用率等性能数字。
5. **组织管控 #governance**：标题“配额与权限按组织分级下发”；四项组织隔离、配额分配、分组授权、统一停用，各配图标；右侧团队配额面板（三成员、金额、进度条、合计）。手机上下堆叠。
6. **模型价格 #models**：标题“主流模型单价逐项公开”，说明只保留单位“美元 / 百万 Token”；使用真实 catalog 最多 6 张紧凑模型卡，3列；四价顺序输入/缓存写入/缓存读取/输出，美元/百万Token。加载失败/匿名限制仍有准确状态和 /catalog 链接，同时厂家带保持可见，不伪造实际价格。独立页面仍无模型详情。
7. **计费方式 #pricing**：标题“单价与计费规则公开”；三张卡：个人版（按量计费）、企业版（按用量核定，推荐卡）、模型价格（逐项公开）。各有 3 条要点与入口，企业版入口指向帮助中心的联系方式。无月费表、订阅切换和套餐购买按钮。
8. **服务保障 #service**：四项技术支持、数据归属、状态公开、部署方式，各配图标。
9. **常见问题 #faq**：6 项折叠问答，覆盖接入协议、费用计算、组织额度、密钥范围、上游异常、独立部署；首项默认展开。使用 details，答案来自内容文件。布局左标题/右列表，手机堆叠。
10. **结尾 CTA**：暗底大卡+青蓝淡光+MovingBorder，标题“开始接入”，主要入口和查看模型价格两个按钮，不加说明段落。根据注册开关调整主要入口。

## 6. 其它页面层

- **目录**：上部“为你的下一步，找到合适的模型。”与短文案、3个信息标签（四维价格 / 美元计费 / 一个账户）；下方原搜索/厂家筛选、紧凑卡。模型卡无示例代码和额外介绍，保留四价。错误与空态有可用恢复动作。
- **状态**：上部带信号图标和“每一次连接，都有迹可循。”；实际总体状态、可用率、项目数置于三张图标卡。历史仍只可用性，响应仅当前值；底部以三列简述可用性/响应耗时/记录范围。无假“全绿”运行值。
- **帮助**：上部“从第一个密钥，到稳定运行。”、搜索与4类入口；保留原文章切换，增加3个任务入口卡（创建密钥、查价格、看用量）。有内容、列表和可用链接，无通用空白标题块。
- **账号页**：沿用已有完整表单逻辑，公共 AuthLayout 改为桌面左右双栏：左侧品牌/大标题/3 项能力要点（2026-09-28 起不再放虚构案例），右侧深色表单卡；手机只显示品牌、简短标题和表单，避免营销内容把操作挤到下面。
- **控制台各页**：统一深色主题和侧栏，所有数据、筛选、日期、权限、表单、账单状态保持实际逻辑。概览四卡图标、三种分布环图+金额/Token表、趋势必须保留。用量表、密钥表、订单、成员、设置复用同一控件自然覆盖；专用图表主题单独核查。不能填假的真实余额/订单/调用记录。

## 7. 构造内容登记与交付

品牌 Nexus API、首页演示控制台与成员配额面板为授权的构造内容，集中 `src/content/marketing.ts`，页面不加示意或数据声明类标注；能力与参数说法按系统实现核实后写入同一文件。部署前可统一替换。用户真实账户、账单、目录价格和状态读实际后端。页面不散落“本地验收”“V1”等开发文案。

每个页面交互标记：`data-slot=public-header`、`public-footer`、`marketing-hero`、`dashboard-showcase`、`platform-grid`、`governance-section`、`service-section`、`marketing-faq`；锚点与章节号一致。浏览器检查导航/菜单、FAQ、公开内页、账号表单、已登录控制台、长文本、加载错误及390/1440宽度。
