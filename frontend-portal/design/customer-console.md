# M2/M3 客户控制台实施契约

2026-09-28 共享外观切换为 [Proactiv 深色青蓝主题](proactiv-redesign.md)，账号页面采用统一双栏外壳；下述身份、密钥、用量、日期、余额与支付契约继续有效。

状态：连续实施，完成后统一验收 · 日期：2026-09-27

依据：[路线图](../docs/roadmap.md) · [账号模块](../docs/模块设计/账号与密钥.md) · [用量模块](../docs/模块设计/用量统计.md) · [余额模块](../docs/模块设计/余额与订单.md)

## 1. 路由与范围

M2：`/login`、`/register`、`/forgot-password`、`/reset-password`（恢复流程两个状态）、`/console/keys`、`/console/settings`。M3：`/console`、`/console/usage`、`/console/billing`。官网入口改为这些本地流程。M4 团队管理不在本轮实施，控制台组织身份与成员付款限制沿用底座。

沿用现有灰白黑令牌和基础控件，四价模型、按天统计、余额计费的首版取舍不变。不扩展后端计费、组织规则、监控或支付服务，不发真实付款。用户已授权 dev 服务持续运行；用隔离本地 Go/数据库/缓存完成可执行联调。

## 2. 共用会话与请求

共享类型先固定在 `src/features/auth/types.ts`。浏览器请求统一走 `/api/portal/`，服务端转发到固定 `SUB2API_INTERNAL_URL` 的客户接口白名单。现有公开网站服务端读取不变。不得把任意地址/路径代理到后端，不开放管理员或模型推理路径。

会话以本项目专属键保存一份原子 JSON，仅包含本次会话的凭证、失效时间、账号标识和会话代次。后端访问与续期协议保持 Bearer。当前账号资料通过 `/auth/me` 核实，不能直接信任浏览器旧角色。

`SessionManager`（纯业务对象，注入 storage/fetch/clock/锁供测试）负责：启动恢复、登录完成、同页单次续期、跨标签锁、退出撤销、账号切换和旧响应隔离。续期与退出之间的迟到响应不得恢复会话；续期换令牌仍属于同一会话代次。若浏览器无跨标签锁，收到已被别标签替换的令牌后采用新令牌，不能误清理另一标签。网络错误不等于退出，只有已确认失效才清理。

导出 `createSessionManager(options?)`，对象具有 `start():Promise<void>`、`dispose():void`、`subscribe(fn):()=>void`、`getSnapshot():SessionSnapshot`、`getServerSnapshot():SessionSnapshot`、`request:ApiRequester`、`acceptLogin(value:unknown):Promise<void>`、`logout():Promise<void>`、`refreshUser():Promise<void>`。`parseUser`/`parseAuthTokens` 从未知响应校验/转换。具体访问令牌不暴露到 React 状态或服务端 HTML。

`AuthProvider` 与 `useAuth()` 放 `auth-provider.tsx`：返回 `{...SessionSnapshot,request,login,completeTwoFactor,register,logout,refreshUser}`。登录普通成功返回null，要求双重验证时返回challenge。`useAuthSettings()` 读取公开配置并校验；所有账号页对真实启用的验证码/注册/找回限制做相应交互，不能绕过或假装关闭。

TanStack Query 放在顶层 provider；客户查询缓存含 `identityKey`，退出/换号取消并清理缓存。客户布局等待身份核实后才渲染私有页；未登录跳 `/login?next=<本站安全路径>`，禁止外站return跳转。原管理界面不共享本地存储键。

## 3. 业务边界

- 所有金额、配额和订单状态来源于后端；写操作不盲目重试，创建类带独立幂等键（后端有支持时）。
- 密钥使用后端允许的分组和额度；列表只展示掩码，点击复制完整值，创建结果可复制。额度0表示不限，与未返回值分开。
- 账号设置含资料、密码和已有TOTP启停，setup secret/临时token仅在本次弹窗内存，不写日志/持久化。密码修改成功后清理登录态重新登录。
- 总览只用同一日期范围的统计汇总和快照；余额/成员配额单独查询当前值。三类环形分布旁有请求、Token、实际消费表；Token趋势四条系列。没有最近调用摘要。
- 日期预选为今天、昨天、近7/14/30天、本周、本月、上月；自定义只有日期，统一时区，应用后一次更新整组统计。无数据/加载失败不显示虚构零值。
- 充值按后台配置限制、支付币种、方式和费率处理；下单后跳付款/显示二维码，订单PAID或RECHARGING表示等待入账，仅COMPLETED确认到账并刷新余额。
- 普通组织成员看自己的配额，不显示充值操作，直接打开财务路径也返回无权状态。

## 4. 目录与组件边界

- `features/auth/` 会话业务、provider、登录/注册/恢复、安全配置/验证码。
- `features/keys/` 密钥适配、列表、创建编辑表单。
- `features/settings/` 资料、密码、双重验证。
- `features/usage/` 统计适配、总览、明细；`lib/time/` 日期规则；`components/charts/` ECharts公共图表。
- `features/billing/` 充值配置、订单适配与状态流程、页面。
- `features/console/` 身份守卫、Query入口、统一页头与账户状态。
- `lib/api/portal-proxy.ts` 服务端转发规则，`app/api/portal/[...path]/route.ts` 仅接线。

视图依赖本模块API适配和共用请求，不各自管理令牌。主控先冻结接口再分路实现；业务测试由独立测试路覆盖，纯外观不用单测。

## 5. 验证

门禁包括格式、静态分析、严格类型、单元测试与生产构建。开发输出与生产输出分开，构建不破坏正在查看的dev服务。

核心测试覆盖会话续期竞争、退出后迟到结果、账号缓存隔离、后端错误、日期边界、密钥金额/过期、统计缺值与分项、订单状态/金额。真实本地服务验证注册登录、创建/修改/停用/删除密钥、读取统计/订单等；测试账户和记录只在新建隔离环境里。付款适配用本地测试提供方，不调用真实支付。

浏览器工具若恢复可用，执行桌面与手机、图表/日历/表单/弹窗真实交互；不可用时保留边界，不把HTTP和React渲染当作鼠标验收。用户仅在M2/M3工作完成且可审阅后参与验收。

## 6. 真实联调后的契约修正

支付开关为 enabled，费率取顶层 recharge_fee_rate，订单 amount 已为到账USD，币种支持0/2/3位小数。付款回跳固定 /payment/result，页面再按订单号转控制台；公开站点地址通过 PORTAL_PUBLIC_URL 明确，代理派生可信来源。底座允许普通成员创建个人充值单，门户额外核实身份并拒绝成员付款，复用原底座无需改其代码。OAuth供应商与底座回调配置均指向门户 /api/portal/auth/oauth/<provider>/callback，状态Cookie的路径随代理统一改写。
