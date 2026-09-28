# M1 官网实施规格

2026-09-28 视觉、导航和首页内容以 [Proactiv 整站改版](proactiv-redesign.md) 为准。本文的公开数据、价格、状态、注册配置与请求边界继续有效；旧浅色布局及精简首页由新规格取代。

状态：按已确认范围实施 · 日期：2026-09-27

依据：[视觉基线](../docs/前端设计.md) · [路线图](../docs/roadmap.md#m1) · [类型契约](../src/features/public/types.ts)

## 1. 边界与路由

实现首页 `/`、模型目录 `/catalog`、服务状态 `/status`、帮助 `/help` 四页。M0 的主题、基础控件与 PublicShell 是唯一界面基础。M0 浏览器验收尚未完成，但用户明确要求继续实现，因此代码依赖就绪后推进 M1，保持实际验收边界。

本阶段只接匿名公开数据；用户专属分组与个人倍率在 M2 登录接入时另外按身份查询，不能缓存进匿名网页。模型只显示厂家标志/名称、模型代号和输入/缓存写入/缓存读取/输出四项美元价格。套餐、试用、提醒、模型详情继续不做。

状态页只展示近七天可用率、当前响应速度和最近最多60次可用性记录，标明实际时间范围，不把记录补成七天连续曲线。后端不修改。

## 2. 文件结构与接口

主控固定 `src/features/public/types.ts` 类型。其余按职责划分：

- `src/lib/api/public-client.ts`：可注入 fetch 的纯公开请求函数，固定三种后端路径，不依赖 Next/浏览器，可单测。
- `src/lib/api/public-server.ts`：server-only，读取环境配置，取得公开结果并调用纯适配；不把内部后端URL或原始错误传客户端。
- `src/features/catalog/adapter.ts`：`parseCatalog(value: unknown): CatalogData`，异常数据抛错由请求层转换为不可用；四价为美元/百万Token的数值区间，缺失为null。
- `src/features/catalog/format.ts`：`formatPrice(value: PriceRange | null): string`，null为`—`、零为`$0.00`，极小非零保持有效精度，区间两端各含美元符号。
- `src/features/status/adapter.ts`：`parseStatus(value: unknown): StatusData`，验证数值/时间，保留unknown和null，不推算可用率。
- `src/features/public/settings.ts`：`parsePublicSettings(value:unknown):PublicSettings`，返回白名单字段，限制外部链接协议。
- `src/features/public/public-frame.tsx`：`PublicFrame({site,activePath,children})`，共用外壳、品牌与页脚。
- 页面组件：`CatalogView({result})`、`ModelCard({model})`、`StatusView({result})`、`HomeView({catalog,site})`、`HelpView({settings})`，全部可直接用于离线预览；不在视图里读取环境配置或生产网络。
- 服务端入口：`getPublicSite(): Promise<PublicSiteData>`、`getPublicCatalog(): Promise<PublicResult<CatalogData>>`、`getPublicStatus(): Promise<PublicResult<StatusData>>`。路由声明动态渲染，构建时不发业务请求。

## 3. 数据请求边界

`SUB2API_INTERNAL_URL` 为服务端固定后端 origin（http/https，无用户名密码/查询/hash）；未配置时返回不可用状态，不自行发现本机或读取旧.env。仅请求 `/api/v1/settings/public`、`/api/v1/model-plaza`、`/api/v1/status`，不转发cookie/Authorization，redirect:error、超时5秒、cache:no-store。

HTTP401/403为authentication-required；404为disabled；其他失败、超时、非法JSON或业务包装code非0为unavailable。正确包装为 `{code:0,data:...}`。不显示后端堆栈、内部地址、原始message。读取结果之间可并行，但一个区域错误不影响其他页面内容。

M2 已接入后，账号操作固定到本站 `/login`、`/console`；认证目录通过客户请求按身份查询，匿名首页继续使用公开数据。

匿名配置按白名单使用站名、文档链接、纯文本客服信息和注册开关。后端 `contact_info` 是文本，不得作为URL使用。默认临时站名“模型服务”，无接口数据时不伪造客服地址、公告或价格。配置内容按文本渲染，不执行HTML。后端文章/公告需登录，帮助页首版使用已核对业务的本地文章，公告分类明确空态，不调用受保护接口。

目录只展示匿名可见的余额计费分组，排除专属组和subscription套餐组。同型号合并到一张卡，以已给出的标准价、上下文档位、缓存时长与分时倍率展示价格区间，绝不拿official_pricing补实售价。峰值倍率仅对subscription生效，余额目录不额外乘它。pricing已由后端按分组长上下文开关整理；区间绝对价优先，其次base×档位倍率，再其次base。缺失保持null，非token模型四项显示缺失，不能拿按次/图片价乘百万。

## 4. UI与样式

依旧A灰白黑。首页灰色Spotlight、控制台示意随滚动轻透视回正；使用之前核对的官方Aceternity源码适配，尊重减少动态偏好。控制台预览图片仅用于说明界面，旁边标“控制台界面示意”，不宣称图片的数字是运营数据。

官网外壳沿用M0，允许站名和账号actions作为参数；预览默认行为保留。桌面导航64px，内容最大1408px，边距64/32/16。Footer只放站名与模型/状态/帮助链接，无虚构主体或保障承诺。

模型卡片三列xl、两列md、手机一列，约180–200px自然高度，内边距20px。厂家标志36px、名称16px、型号18px自然换行；四价按固定顺序横排，极窄时2×2。单位在页面标题旁统一显示美元/百万Token。卡片无按钮/描述/示例。模型表单搜索+厂家选择，匹配忽略大小写，清空可恢复，无结果与加载失败分开。

状态卡保留名称和分组公开文案，状态文字+颜色，近7天可用率与最近响应耗时；history每格带可键盘聚焦的日期/状态提示，以实际时间排序，空历史不画正常格。首页不放无来源的成功率。

所有错误/关闭/需登录/空数据有短而清楚的中文状态，重试是同路由reload链接或按钮，不能重复伪造请求；未知状态与数值0区别处理。

## 5. 验证与分路

数据适配与传输单测由独立测试路按契约编写，覆盖费率、缺价、时段、错误包装、401/403/404、超时、状态null、0延迟、记录排序及URL协议。纯展示不写单测。

真实接口调用只有环境明确配置后发生，本轮不读取生产凭证、不调用模型接口。可通过注入fetch验证传输和真实样本形状；离线预览使用集中样例但正式页面不引入样例。

新依赖只增Motion和server-only（后续实际需要其他依赖先报告主控）。本机不启动dev/preview/HTTP服务。运行完整pnpm check、实际页面离线构建、独立评审。浏览器连接缺失则记录待验，不标里程碑完成。
