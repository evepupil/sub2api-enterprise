# 10 - Vercel AI Gateway 调研

- 观察日期：2026-09-26（本机时间）
- 调研方式：HTTP 抓取公开页面（fetch 工具 + curl.exe 备份），未登录、未注册、未充值、未调用任何模型
- 证据范围：仅 vercel.com 官方站点与其官方文档 CDN 上的图片资源
- 原始素材目录：`.fleet/evidence/vercel/`（HTML 快照与图片 URL 清单，只读参考）

## 1. 产品定位

- **产品类型**：托管型 AI 模型网关（多模型 / 多 provider 统一 API），厂商自述为 "The AI Gateway for developers"，落地页副标题 "Hundreds of models, one API key, no markup. Text, image, video, audio."（E1）
- **谁用**：写代码的人——文档明确说 "Your application does not need to run on Vercel. Call AI Gateway from any server, cloud, or local environment"，并列了 20+ 编码代理（Claude Code、Codex、Cursor、Cline、OpenCode 等）的接入方式（E2、E14）。也面向团队：密钥、预算、日志、allowlist 都以 team 为单位（E12、E7）
- **与 AI API 中转站相似点**：统一 endpoint、统一密钥、多 provider 路由与故障转移、按 token 计费、请求日志与用量图表、BYOK 支持（E2、E5、E12）
- **与中转站不同点**：
  - 账号体系寄生在 Vercel 团队上，不是独立注册的网关账号；额度叫 "AI Gateway Credits"，充值入口在 Vercel dashboard 侧栏（E3）
  - 密钥可绑定到 Vercel project（`projectId`）、可用 OIDC 令牌替代长期密钥（E12、E2）
  - 计价口径是「provider list price + 零加价」，不是自己定的折扣价目表（E3、E9）
  - 部分治理能力（team 级 provider allowlist、team 级 ZDR、Trace Drains）只在 Pro / Enterprise 计划可用（E3、E8）
  - 落地页把「编码代理」「AI SDK」放在很靠前的位置，更像开发者工具而非「买额度用模型」的消费型站点（E1）

## 2. 导航 / 页面与功能表

| 功能域 | 发现到的页面或入口 | 关键内容 | 状态 |
| --- | --- | --- | --- |
| 发现与选型 | `/ai-gateway/models` 模型目录；模型详情页 `/ai-gateway/models/<model-id>`；`/ai-gateway/leaderboards` | 目录列 Input/Output 单价、延迟、Providers、ZDR、No Training、Free Tier、Capabilities、Released；详情页含 Providers / Uptime / Throughput / Latency 四段；leaderboards 按模型、labs、apps、providers 排名并给 CSV 下载 | 公开页面已核实（E10、E11、E16） |
| 发现与选型 | `/v1/models`、`/v1/models/{creator}/{model}/endpoints` | 无需认证返回模型 ID、上下文窗口、定价、reasoning 选项；endpoints 接口返回逐 provider 定价、uptime、throughput、latency | 官方文档描述（E4） |
| 开户与接入 | 落地页 "Get API key" / "Read the docs" 按钮；quickstart | 文档给的是「建 key → 设 `AI_GATEWAY_API_KEY` → 调用」的路径，未展示自助注册网关账号的流程 | 公开页面已核实（E1、E2） |
| 开户与接入 | 协议兼容面：AI SDK、OpenAI Chat Completions、OpenAI Responses、Anthropic Messages、REST、Python AI SDK、LangChain/LiteLLM/Pydantic AI | 文档称可只改 base URL 沿用现有 SDK；coding agent 面 URL 会走同一套 `/v1` handler | 官方文档描述（E2、E9、E14） |
| 密钥 | `/docs/ai-gateway/authentication-and-byok/api-keys`；dashboard `/[team]/~/ai-gateway/api-keys` | 三处创建（dashboard / CLI / `POST /v1/api-keys`）；列出、改预算与归属、删除或全部撤销；明文只在创建时可见一次；成员离开团队其密钥被停用；支持 `expiresAt` | 官方文档描述（E12） |
| 密钥 | OIDC 令牌 | Vercel 部署可用 OIDC 替代长期密钥；OIDC 请求在日志中显示为所属 project | 官方文档描述（E2、E5） |
| 用量与账单 | `/docs/ai-gateway/observability-and-spend/observability` | Overview 四个图：Requests by Model、Time to First Token、Input/Output Token Counts、Spend；Requests 段按 project、按 API key 汇总（含请求数、平均 token、P75 duration、P75 TTFT、cost） | 官方文档描述（E6） |
| 用量与账单 | `/docs/ai-gateway/observability-and-spend/logs` | Logs 表列：Time、Status、Model、Provider、Usage、Cost、Duration、Authentication；过滤维度含 Status/Model/Provider/Authentication/Routing/Modality/Request Mode/Latency/Tokens/Cost；日期最多回看 36 天；可导 CSV/JSON；Live 模式 5 秒刷新、约 90 秒摄入延迟 | 官方文档描述（E5） |
| 用量与账单 | 余额与充值 | 侧栏 AI Gateway 右上角显示 Credits 余额；充值流程为余额按钮 → 选额度 → Continue to Payment → 选支付方式 → Confirm and Pay；支持 auto top-up（默认关） | 官方文档描述（E3） |
| 用量与账单 | 预算 | 四层作用域：team、project、API key、user；软上限（跨限那一笔仍会完成）；超限返回 `402 quota_for_entity_exceeded`；刷新周期 daily/weekly/monthly/none，UTC 起算；spend alerts 可选 50%/75%/100% 邮件 | 官方文档描述（E7） |
| 用量与账单 | `/v1/credits`、`/v1/generation` | 前者返回余额与累计消费，后者返回单次请求成本 | 官方文档描述（E9） |
| 团队 | 团队/项目作用域、角色与权限 | 除 Contributor 外所有团队角色可读预算页；Owner 与 AI Gateway Budget Manager 可写 team 预算；project 预算还需该项目 admin；API key 预算的告警发给密钥创建者 | 官方文档描述（E7、E12） |
| 安全 / 隐私 | `/docs/ai-gateway/security-and-compliance` | ZDR（默认零数据保留，可逐请求强制）、Disallow Prompt Training、Provider Allowlist、Model Allowlist、regional inference、safety identifiers | 官方文档描述（E8、E9） |
| 安全 / 隐私 | 内容保留 | 厂商自述不记录也不保留 prompt / response 内容；保留的是请求元数据（状态、模型、provider、token、cost、耗时、认证方式、每次路由尝试），路由尝试明细保留 30 天 | 官方文档描述（E5、E9） |
| 服务保障 | `/docs/ai-gateway/models-and-providers/uptime` | 用真实流量算 uptime，按模型和 provider 发布；区分「provider uptime」与「AI Gateway uptime」；4xx 与 BYOK 不计入；无活动时显示 100% 是占位而非真实趋势 | 官方文档描述（E13） |
| 服务保障 | SLA / 赔付 | 未见任何可用性赔付承诺或 SLA 条款页面 | 未找到证据 |
| 支持 | FAQ 末尾指向 dashboard 的 Support 入口；自定义限速、批量折扣、发票付款走 contact sales | 未公开支持等级、响应时限 | 官方文档描述（E9） |
| 界面 | 控制台截图 | 见第 5 节 | 官方截图（E18–E21） |
| 界面 | 实际登录后的控制台布局 | 本机浏览器连接不可用，未渲染、未登录 | 登录后未核实 |

## 3. 用户任务路径（依据公开文档推演，未真正执行）

**路径 A：开发者从零接入（E1 → E12 → E11 → E2 → E5）**
1. 从落地页 `vercel.com/ai-gateway` 点 "Get API key" 或 "Read the docs" 进入（E1）。
2. 在 dashboard API Keys 页点 Create key，命名后立即复制密钥（文档明确提示不可再次查看），存为环境变量 `AI_GATEWAY_API_KEY`；也可用 CLI 或 `POST /v1/api-keys`（E12）。
3. 在模型目录按 provider / ZDR / Free Tier 过滤选定模型，进详情页复制模型 ID 与 provider slug（E10、E11）。
4. 用 AI SDK 或把现有 OpenAI/Anthropic SDK 的 base URL 指到网关，用 `creator/model` 形式传模型 ID（E2、E11）。
5. 回到 Logs 页按 request ID 查这一次请求的 provider、每次路由尝试、token 拆分与 cost（E5）。
   - 说明：以上为文档给出的步骤，我未创建账号、未创建密钥、未发出任何真实调用。

**路径 B：团队成本与权限治理（E7 → E6 → E5 → E3）**
1. 团队 Owner（或被授予 AI Gateway Budget Manager）进预算页，按 team / project / API key / user 四层各设上限与刷新周期（E7）。
2. 在预算编辑里勾选 50% / 75% / 100% 的邮件告警阈值，告警接收人随作用域不同（E7）。
3. 在 Overview 看 Requests by Model / TTFT / Token Counts / Spend 四张图，并按 project 或 API key 下钻（E6）。
4. 逐条进 Logs 看 cost 明细；需要外部可观测性时开 Trace Drains 把 OTel trace 转发出去（E5、E3）。
5. 余额不够时从侧栏 Credits 按钮充值或开启 auto top-up（E3）。
   - 说明：未进入任何 dashboard，未设置预算，未充值。

**路径 C：模型选型与横向对比（E10 → E11 → E16 → E13）**
1. 在 `/ai-gateway/models` 目录横向对比 Input/Output 单价、延迟、provider 数量、ZDR / No Training / Free Tier 标签（E10）。
2. 点进模型详情页看逐 provider 的 context、max output、weight format、latency、throughput、input/output/cache 单价，以及各 provider 的 Terms / Privacy 外链（E11）。
3. 在 leaderboards 看该模型或 lab 的每日份额，并可导出 CSV/JSON（E16）。
4. 在模型页的 Uptime / Status 段看 1W/1D/1H 成功率曲线与健康条（绿 95–100%、琥珀 75–95%、红 0–75%）（E13）。
   - 说明：仅为公开页面的浏览路径，未做任何注册后的选型操作。

## 4. 收费样本（USD，观察日期 2026-09-26）

1. **免费层月度额度**：$5 / 月，包含在免费层内，覆盖「Free Tier eligible models」子集且每模型限速更低；付费层为按量购买 Credits，token 计价两者均为「provider list rates, zero markup」。**适用条件（须写明确）**：$5/月是免费层专属的每月额度；一旦购买 AI Gateway Credits，账号即转入付费层，此后月度免费额度不再适用（原文 "Once you purchase credits, your account transitions to the paid tier and the monthly free credit no longer applies."）。来源 E3。
2. **模型 token 价（含输入输出区别）**：`xiaomi/mimo-v2.6-flash` — 输入 $0.14 / 1M tokens，输出 $0.28 / 1M tokens，缓存读取 $0.0028 / 1M tokens；同一模型在 Xiaomi、DeepInfra、Novita AI 三家 provider 上价格一致，context 1M、max output 131K，延迟分别 4.2s / 5.3s / 6.1s。来源 E11。
3. **功能附加费**：team 级 Provider Allowlist $0.10 / 1,000 次成功请求（Pro 与 Enterprise）；team 级 Zero Data Retention $0.10 / 1,000 次请求（Pro 与 Enterprise）；Trace Drains $0.05 / 1,000 traces 加 $0.50 / 1 GB 出网（Pro 与 Enterprise）。**适用条件与扣费口径（须写明确）**：Trace Drains 的两项计量（trace 条数、trace 出网量）由 Vercel 通过你套餐的 Drains 用量计费，**不从 AI Gateway Credits 余额中扣除**（原文 "Vercel bills these two meters through Drains usage on your plan, not against your AI Gateway Credits balance."）；Pro 计划对这两项计量不含任何免费额度，第一个送达的 trace 与第一个字节的出网即开始计费。与之对比，Provider Allowlist 与 ZDR 的 team 级费用是「从 AI Gateway Credits 余额中扣除」（原文 "deducted from your AI Gateway Credits balance"），两者扣费路径不同，不可混为一谈。另：per-request 的 `only` 过滤与 per-request ZDR 免费。来源 E3。

- **反证 / 适用限制**：模型目录页上可见「50% off」「40% off」等标注（如 `google/gemini-3.8-flash-tts`、`spacexai/grok-4.7`），这些是促销标记，不能当作长期价（E10）。
- 未核实：Pro 计划本身的 $20/月 platform fee 含 $20 usage credit 属于 Vercel 平台订阅费，与 AI Gateway Credits 是否同一池子，公开文档未在同一页说明，**未核实**（E15 与 E3 分属两页）。
- 未核实：企业批量折扣的具体折扣率未公开，只写「contact sales」（E3、E9）。

## 5. 界面证据

本机浏览器不可用，**未渲染任何页面**，因此不对像素、间距、色值或视觉质量作任何判断。以下仅为官方文档中嵌入的产品截图 URL，均已实测返回 `200 image/png`，属官方截图，不等于我本人登录操作所见。

| 编号 | 截图 URL | 对应说明页 | 截图标题（文档原文） |
| --- | --- | --- | --- |
| E18 | `https://7nyt0uhk7sse4zvn.public.blob.vercel-storage.com/docs-assets/static/docs/ai-gateway/logs/request-details-light.png` | `/docs/ai-gateway/observability-and-spend/logs` | A request's details panel with a Routing card per provider attempt. |
| E19 | `.../overview-observability/graphs-light.png` | `/docs/ai-gateway/observability-and-spend/observability` | 四张用量/花费图表 |
| E20 | `.../overview-observability/apikeys-summary-light.png` | `/docs/ai-gateway/observability-and-spend/observability` | 按 API key 汇总视图 |
| E21 | `.../logs/async-job-details-light.png` | `/docs/ai-gateway/observability-and-spend/logs` | A running asynchronous video job with its job details open beside the log table. |

- 另有两张同目录 `-dark` 版本（`request-details-dark.png`、`graphs-dark.png`、`apikeys-summary-dark.png`、`async-job-details-dark.png`），说明产品有明暗双主题，但我只验证了 light 版本返回 200。
- 落地页另有 `lishhsx6kmthaacj.public.blob.vercel-storage.com/og-images/ai-gateway-og.png`（og 分享图，E1），属营销图，非控制台界面。
- 仅做信息结构分析（基于文档文字，不基于像素）：Logs 页是「上方图表 + 过滤栏 + 可横向滚动表格 + 右侧可拖拽详情面板」；详情面板以每 provider 一次尝试为一张 Routing 卡片，时间线用绿/琥珀/红区分成功、4xx、5xx 或超时；Overview 是「四张指标图 + 按 project / 按 API key 两个汇总视图」；模型页是「Providers 表 + Uptime / Throughput / Latency 三张图 + Getting started 代码块 + 参数表」（E5、E6、E11）。

## 6. 设计借鉴建议

**可借鉴**
1. 模型目录把「输入价 / 输出价 / 延迟 / provider 数量 / ZDR / No Training / Free Tier / 发布日期」压在同一行做成可筛列表，选型信息密度高且不需要点进详情（E10）。
2. 模型详情页把「逐 provider 对比」做成一等公民：同一模型在不同 provider 的定价、context、weight format、latency、throughput、以及各 provider 的 Terms / Privacy 外链并列展示（E11）。
3. 费用治理用「四层预算 + 软上限 + 402 明确错误码 + 阈值邮件」的表达，把「超额了会怎样」写成可预期的行为而不是模糊警告（E7）。
4. 可观测性把「按 provider 的每次路由尝试」画成独立卡片，并显式说明 recovered 请求的图标含义，解释「为什么这次贵/慢」的因果链（E5）。
5. uptime 页面区分「provider uptime」与「gateway uptime」，并主动说明「无活动显示 100% 是占位」，这种对指标口径的自曝式说明值得照搬（E13）。

**不宜直接照搬**
1. 账号体系寄生在 Vercel team 上：密钥可绑 project、可用 OIDC、成员离职即停用密钥——这套依赖 Vercel 的 team/RBAC/部署模型，独立中转站没有等价底座（E12、E2）。
2. 「零加价 + provider list price」的定价叙事：这是 Vercel 自述的定价口径，对中转站而言不是可直接照搬的定价结构（E3、E9）。
3. 把 Vercel Pro/Enterprise 计划门槛（team 级 allowlist、team 级 ZDR、Trace Drains）直接搬过来，会让基础功能被计划割裂，对专业个人与小团队不友好（E3、E8）。另需注意 Trace Drains 走的是 Vercel 套餐 Drains 账单而非 Credits，若照搬这套计量，会引入第二条互不相通的扣费路径（E3）。
4. 编码代理自动写配置、把密钥存进 macOS Keychain、迁移 Claude/Codex 会话历史——这些是 Vercel CLI 深度集成的产物，独立前端短期内没有对应分发渠道（E14）。

**目前无法确认**
1. 登录后的真实导航层级、侧栏分组与页面跳转关系，未渲染未登录，无法确认（E18–E21 仅为文档截图）。
2. 是否有公开 SLA 或可用性赔付承诺：只找到「按模型/provider 发布实测 uptime，不承诺单一全站数字」的厂商自述，未见 SLA 页面（E13、E9）。
3. 免费层的每模型具体限速数值（只写 "lower limits per model"）、以及购买 Credits 的可选档位金额，公开文档未给数字（E3）。
4. Vercel Pro 的 $20/月 platform fee 与 AI Gateway Credits 是否为同一资金池，两页未交叉说明（E15、E3）。

## 7. 证据表

| 编号 | 完整 URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持的判断 |
| --- | --- | --- | --- | --- | --- |
| E1 | https://vercel.com/ai-gateway | AI Gateway - Vercel | 成功 | "Hundreds of models, one API key, no markup. Text, image, video, audio." | 产品定位、CTA、模态覆盖 |
| E2 | https://vercel.com/docs/ai-gateway | Vercel AI Gateway: Models, Routing, and Observability | 成功 | "Your application does not need to run on Vercel." / "AI Gateway adds zero markup to provider token prices" | 非 Vercel 用户可用、零加价、路由与日志能力 |
| E3 | https://vercel.com/docs/ai-gateway/pricing | AI Gateway Pricing | 成功 | "Vercel bills these two meters through Drains usage on your plan, not against your AI Gateway Credits balance." / "$5/month included" | 免费层 $5、付费层按量、Trace Drains 与 Credits 两条扣费路径、附加费目 |
| E4 | https://vercel.com/docs/ai-gateway/models-and-providers | AI Gateway Models and Providers | 成功 | "`https://ai-gateway.vercel.sh/v1/models` ... requires no authentication" | 统一 API、模型/端点发现接口 |
| E5 | https://vercel.com/docs/ai-gateway/observability-and-spend/logs | AI Gateway Request Logs | 成功 | "The Logs page lists every request ... newest first." / "routing attempt details are kept for 30 days" | 日志字段、过滤、导出、保留期 |
| E6 | https://vercel.com/docs/ai-gateway/observability-and-spend/observability | AI Gateway Observability | 成功 | "Usage: Graphs and metrics to track your AI Gateway usage and cost" | 四张用量图、按 project/API key 下钻 |
| E7 | https://vercel.com/docs/ai-gateway/observability-and-spend/budgets | AI Gateway Budgets and Spend Limits | 成功 | "A budget is a soft cap, not a hard limit." / "rejects further requests ... with an HTTP `402`" | 四层预算、软上限、402、告警阈值、角色权限 |
| E8 | https://vercel.com/docs/ai-gateway/security-and-compliance | AI Gateway Security and Compliance | 成功 | "AI Gateway uses zero data retention by default." / "available on Pro and Enterprise plans" | ZDR 默认、训练禁用、provider/model allowlist 及计划门槛 |
| E9 | https://vercel.com/docs/ai-gateway/faq | AI Gateway FAQ | 成功 | "Uptime is measured from live traffic and published per model and provider, not promised as a single fleet-wide number." | 无全站 SLA、错误码含义、余额接口、Credits 一年过期 |
| E10 | https://vercel.com/ai-gateway/models | Browse AI Gateway Models – Vercel | 成功 | "Compare capabilities, pricing, and performance across leading AI providers." / "50% off" | 目录字段与筛选维度；促销价不可当长期价 |
| E11 | https://vercel.com/ai-gateway/models/mimo-v2.6-flash | MiMo V2.6 Flash API, Pricing & Playground | 成功 | "Input $0.14/M / Output $0.28/M / Read $0.0028/M" | 输入输出区分定价、逐 provider 对比、参数与路由选项 |
| E12 | https://vercel.com/docs/ai-gateway/authentication-and-byok/api-keys | AI Gateway API Keys | 成功 | "Copy the key value immediately. You cannot retrieve it again." / "deactivates any API keys they created" | 密钥创建/归属/预算/撤销、成员离职处理 |
| E13 | https://vercel.com/docs/ai-gateway/models-and-providers/uptime | AI Gateway Uptime and Provider Status | 成功 | "The 100% line is a placeholder, not a trend." | 双 uptime 口径、4xx 与 BYOK 不计入、颜色分档 |
| E14 | https://vercel.com/docs/ai-gateway/coding-agents | Coding Agents and Chat Platforms with AI Gateway | 成功 | "stores your key in the macOS Keychain instead of in plaintext config" | 编码代理接入路径与 CLI 集成深度 |
| E15 | https://vercel.com/docs/plans/pro | Vercel Pro Plan | 成功 | "$20/month Pro platform fee ... $20/month in usage credit" | 平台订阅费与角色/席位，需与 Credits 区分 |
| E16 | https://vercel.com/docs/ai-gateway/leaderboards | AI Gateway Leaderboards | 成功 | "The data is anonymized: it shows each model, lab, app, or provider's percentage share or rank" | 榜单维度、匿名化、CSV/API 导出 |
| E17 | https://vercel.com/docs/ai-gateway/observability-and-spend/usage | AI Gateway Generation Lookup and Usage API | 成功 | "Generation lookup returns provider, latency, token usage, cost, and finish reason." | 单次请求成本查询接口 |
| E18 | https://7nyt0uhk7sse4zvn.public.blob.vercel-storage.com/docs-assets/static/docs/ai-gateway/logs/request-details-light.png | （图片，出现在 E5 页） | 成功（200 image/png） | 文档图注 "A request's details panel with a Routing card per provider attempt." | 官方控制台截图：请求详情面板 |
| E19 | https://7nyt0uhk7sse4zvn.public.blob.vercel-storage.com/docs-assets/static/docs/ai-gateway/overview-observability/graphs-light.png | （图片，出现在 E6 页） | 成功（200 image/png） | 文档正文 "The Usage section displays four metrics" | 官方控制台截图：用量图表区 |
| E20 | https://7nyt0uhk7sse4zvn.public.blob.vercel-storage.com/docs-assets/static/docs/ai-gateway/overview-observability/apikeys-summary-light.png | （图片，出现在 E6 页） | 成功（200 image/png） | 文档正文 "View usage grouped by API key" | 官方控制台截图：按 API key 汇总 |
| E21 | https://7nyt0uhk7sse4zvn.public.blob.vercel-storage.com/docs-assets/static/docs/ai-gateway/logs/async-job-details-light.png | （图片，出现在 E5 页） | 成功（200 image/png） | 文档图注 "A running asynchronous video job with its job details open" | 官方控制台截图：异步任务详情 |
| E22 | https://vercel.com/docs/ai-gateway/getting-started/text | （无正常标题） | 失败 | 返回内容为面向编码代理的操作指令文本，非文档正文 | 该路径未取得可引用正文；quickstart 步骤改由 E1/E2 旁证 |

- 反证 / 适用限制汇总：无公开 SLA 页面（E13、E9）；免费层 $5/月额度在购买 Credits 转入付费层后即不再适用（E3）；Trace Drains 的 trace 条数与出网量按套餐 Drains 用量计费、不扣 Credits，且 Pro 计划对此无免费额度（E3）；免费层限速数值与 Credits 档位未公开（E3）；目录页存在 40%/50% 促销标注（E10）；team 级 allowlist 与 ZDR 需 Pro/Enterprise（E3、E8）；预算为软上限，可能小幅超支（E7）；未活动 provider 的 uptime 显示 100% 属占位（E13）。
- 本报告所有价格、指标与能力均来自上表公开页面，属厂商自述；我未做任何真实注册、充值或调用验证。
