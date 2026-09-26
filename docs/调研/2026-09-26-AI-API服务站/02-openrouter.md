# OpenRouter 调研（AI API 服务站点 · 单站）

- 观察日期：2026-09-26（UTC+8 上午）
- 调研范围：仅 https://openrouter.ai 及其 /docs 公开页面
- 访问方式：HTTP 直取（curl.exe / 抓取工具），未渲染 JS 页面之外的内容；本机浏览器不可用
- 免责：本文只记录页面上实际出现的内容，全部标注证据编号；厂商自述处已标明「厂商自述」
- 未做：未注册、未登录、未充值、未调用任何模型、未提交任何表单
- 访问计数口径：本轮唯一成功访问 URL 15 个（E1–E16，其中 E1 与 E2 为同一 URL 的不同区块），证据表 17 行（E1–E16 为成功访问 + E17 未访问）

## 1. 产品定位与客户画像

- 产品类型：多模型聚合网关（marketplace/aggregator）。厂商自述为「hundreds of AI models through a single API endpoint」，并称自动 fallback、自动挑最省钱的选项（E3）。
- 谁用：页面自述面向「indie hackers、AI native startups、growing teams、enterprises」，并把客户分层为 Free / Standard / Business / Enterprise 四档（E1）。
- 与 AI API 中转站的相似：统一 base URL、OpenAI 兼容、用 slug 选模型、密钥+余额扣费、按 token 计费、失败重试与上游切换（E3、E4、E7）。
- 与中转站的不同（就本页可见）：把「同一模型多家 provider 的公布价/延迟/吞吐/uptime 并列比较」做成核心页面内容（E4）；提供市场化的 Auto Router 按社区花费份额选模型（E6）；把 provider 数据留存/训练策略做成可路由约束（ZDR，E13、E14）；把 workspace/组织/管理密钥做成一等公民（E10、E12）。
- 注意：以上均为厂商自述与公开文档，未做真实调用验证。

## 2. 导航 / 页面与功能表

| 板块 | 页面/入口 | 观察到的内容 | 状态 |
|---|---|---|---|
| 发现与选型 | /models、/rankings、/benchmarks、/apps、/collections、/providers | 模型目录含 8K 上下文、$0.042/M 输入这类字段；rankings 按 tokens 与「share of spend」排序（E5、E16） | 公开页面已核实 |
| 模型详情 | /anthropic/claude-sonnet-4.5 | In/Out 价、Context、Released、知识截止、Providers 表（价/缓存价/延迟/吞吐/uptime）、Benchmarks、Uptime/Availability（E4） | 公开页面已核实 |
| 路由选择 | /docs/features/model-routing、/docs/guides/routing/* | Auto/Auto Beta、cost_tier（low…max）、allowed_models/excluded_models 通配、账号级 Routing 页默认值（E6）；models 数组 fallback（E7）；provider 选择（E8） | 官方文档描述 |
| 开户与接入 | /docs/quickstart | REST `/api/v1/chat/completions`、OpenAI SDK 直替、Client SDK、Agent SDK、MCP server（E3） | 官方文档描述 |
| 密钥 | /docs/guides/overview/auth/management-api-keys、/docs/api-reference/authentication | Management key 管 /api/v1/keys；可设过期；密钥创建后不可再查看；文档称管理 key 不能用于补全接口（E10、E11） | 官方文档描述 |
| 用量与账单 | /pricing、/docs/api-reference/limits、/activity、/logs、/settings/credits | 充值买 credits、逐请求扣费、5.5%/8% 充值手续费、BYOK 额度、per-key credit cap、in-flight spending budget、402/429（E1、E2、E9、E12） | 官方文档描述（页面链接为登录后区域，未核实） |
| 团队/组织 | /docs/guides/features/workspaces、/settings/organization-members | Workspace 隔离 keys/guardrails/BYOK/routing/presets/plugins/observability/members；5 个（Free/Standard）与 1,000 个（Business）（E1、E12） | 官方文档描述 |
| 安全/隐私/保障 | /docs/guides/privacy/provider-logging、/docs/guides/features/zdr、/enterprise | 训练开关、ZDR 全局/按模型组/按 guardrail/按请求、EU/US in-region（来源口径冲突，见下）、SSO/SAML+SCIM、SOC 2/GDPR 自述（E13、E14、E15） | 官方文档描述 + 厂商自述 |
| 支持 | /pricing 表格、/enterprise | Free 社区支持、Standard/Business 邮件支持、Enterprise 专属支持团队与 SLA（E1、E15） | 公开页面已核实 |
| 状态页 | status.openrouter.ai | 仅被 pricing FAQ 指向，本轮未访问 | 未找到证据（未访问） |
| 控制台截图 | — | 未找到官方控制台界面截图；仅见自动生成的 OG 分享图（见第 5 节） | 未找到证据 |

## 3. 用户任务路径（以下均为官方页面/文档描述的组合，本人未实际完成注册、接入、充值或调用）

路径 A：从选型到发出第一次请求
1. /models 浏览目录与价格 → E5（公开页面已核实）
2. /anthropic/claude-sonnet-4.5 看 In/Out 价、context、各 provider 的延迟/吞吐/uptime → E4（公开页面已核实）
3. /docs/quickstart 把 base URL 指向 OpenRouter、model 填 slug，或用 OpenAI SDK 直替 → E3（官方文档描述）
4. 创建 API key 需登录 /settings/keys 类页面（文档只给入口链接）→ E10（登录后未核实）
5. 余额不足时的行为见 credit limits：402 + `GET /api/v1/key` 查 `limit_remaining` → E9（官方文档描述）

路径 B：小团队做环境隔离与密钥治理
1. 默认已有 Default workspace，成员自动加入；新建 workspace 走 /workspaces → E12（官方文档描述）
2. 每个 workspace 独立 keys、guardrails、routing、presets → E12（官方文档描述）
3. 用 Management key 程序化建/删/改子密钥（SaaS 每客户一把、轮换、超限禁用）→ E10（官方文档描述）
4. 给单把 key 设 credit cap（`limit`/`limit_reset`/`limit_remaining`）→ E9（官方文档描述）
5. 套餐差异：Budgets & Spend Controls 从 Standard 起才有，Free 无 → E1（公开页面已核实）

路径 C：企业采购与合规评审
1. /enterprise 看支付方式（信用卡/开票/credit line）、无 markup 自述、SLA 与专属工程支持 → E15（厂商自述）
2. EU/US in-region routing 需按需开通，使用 eu./us. 域名；适用档位两个来源口径不一致：pricing 表格把 EU/US in-region 标为 Business 与 Enterprise 可用（Standard/Free 为 No，E1），provider-logging 文档写「This feature is only enabled for enterprise customers by request」（E13）。报告不做单一断言 → E1、E13（官方文档描述，口径冲突）
3. SSO(SAML)+SCIM、Managed Policy Enforcement、Contractual SLAs 仅 Enterprise → E1（公开页面已核实）
4. 隐私约束：ZDR 可按模型组或 guardrail 打开，例如 Anthropic 组开启后移除一方 endpoint、Bedrock/Vertex 仍可用 → E14（官方文档描述）

## 4. 收费样本（最多 3 条，均为页面公布价，非促销）

样本 1：Claude Sonnet 4.5 推理价
- 价格：$3.00 / 1M input tokens，$15.00 / 1M output tokens；cache read $0.30 / 1M；context 1.0M
- 币种/单位：USD，按 1M tokens 计，输入输出分开
- 适用条件：Anthropic / Azure / Bedrock / Google Vertex 等 endpoint 的公布价（$3/$15 这一档是参与 Standard routing 的价格）；同页另列出 $3.30/$16.50、cache read $0.33 的更贵 endpoint，被归入「Not used in Standard routing」分组，即这组不参与 Standard 路由、并非更便宜
- 来源：E4；观察日期：2026-09-26
- 备注：页面同时说「平均实付价常低于标价，因为缓存与折扣」，即 $3/$15 是标价口径

样本 2：充值手续费（平台收入口径）
- 价格：Standard 5.5%，Business 8%（按购买 credits 的金额）；Free 为 N/A
- 币种/单位：百分比，作用于充值金额，非按 token；页面同时称推理按 provider list price、不在单次请求上加价
- 适用条件：Standard/Business 计划；Enterprise 为「Fee discounts available」、按合同定价
- 来源：E1（表格）+ E2（FAQ 原文）；观察日期：2026-09-26

样本 3：BYOK 免费额度与超出费
- 价格：Standard 与 Business 含每月 $25,000 list-price 推理免 OpenRouter 费，超出后按同等请求 list price 的 5% 收费并从 credits 扣除；Enterprise 为 $200,000/月免额，超出同样 5%
- 币种/单位：USD 额度 + 百分比
- 适用条件：使用自有 provider key（BYOK），provider 直接向客户收推理费
- 来源：E1（表格 BYOK Limits 行）+ E2（FAQ）；观察日期：2026-09-26
- 计费单位多样性补充：目录中还出现按时间计价，如 Seed Audio 1.0「$0.15/minute」（E5）——即平台不是纯 token 计价

未核实：具体充值档位、税费（VAT/GST）展示方式、发票样例、credit line 条款——均在登录/销售流程内，本轮未进入。

## 5. 界面证据

- 未找到官方控制台/仪表盘截图。所有 docs 页面的 `og:image` 都是动态生成的分享卡（形如 `https://openrouter.ai/dynamic-og?title=...`），不能当作产品界面证据；模型页有一张自动生成的 OG 图 `https://openrouter.ai/en-US/anthropic/claude-sonnet-4.5/opengraph-image-vc0va0`（E4），同样不是控制台截图。
- 页面里唯一的图片资源是品牌 logo（`/brand/v2/openrouter-dark.svg` 等）与 provider 图标（`https://openrouter.ai/images/icons/Anthropic.svg` 等），无 UI 截图。
- 因此本节只做信息结构分析：模型详情页的字段顺序为「模态 → In/Out 价 → Context → Released → Providers 表（Input/M、Output/M、Cache read/M、Latency、Throughput、Uptime）→ Pricing 说明 → Performance → Benchmarks → Uptime/Availability → FAQ」（E4）；pricing 页是「四列套餐 × 特性行」矩阵（E1）。
- 未做任何像素、色值、间距或视觉评分判断（未渲染页面）。

## 6. 设计建议（均为建议，非结论）

可借鉴
1. 把「同一模型、多家上游」的 价/延迟/吞吐/uptime 并列成表，并把「本次实际由谁服务」暴露给用户（E4、E7）。
2. 计费口径写清「加价发生在哪一层」：推理按上游标价、平台费只在充值环节收（E1、E2），能显著降低用户对隐性加价的疑虑。
3. 「失败尝试不计费」「Zero Completion Insurance」「fallback 按最终成功模型计费」（E2、E7）这组表述的信息价值在于把计费与赔付边界写清；是否可直接复用，需先核实本项目自身的实际计费与赔付规则后再决定，本报告不建议照抄其话术。
4. 用 workspace 承载「dev/staging/prod + 团队隔离」，并把配额/guardrail/routing 挂在 workspace 而非全局（E12）。

不宜直接照搬
1. 价格区把「实际支付均价」和「provider 公布价」放在一起（E4）需要真实的成交数据支撑；没有数据源时照搬会变成误导。
2. Auto Router 依赖「全站社区花费份额」这一数据资产（E6），不是普通中转站能复制的机制，硬做会变成不可解释的黑盒。
3. 四档套餐里大量能力（预算控制、prompt caching、管理密钥、区域路由、SSO）被按档位切开（E1），若目标客户以专业个人为主，这套切割会造成感知降级。
4. in-region 路由是「按需开通 + 专用域名（eu./us.）」模式，且适用档位在官方来源间存在口径冲突（E1 标 Business/Enterprise 可用，E13 写仅 enterprise 按需开通）；在口径未统一前，普通产品若照搬会制造不必要的运维与承诺负担。

目前无法确认
1. 控制台（activity/logs/credits/keys 页面）的真实信息密度与交互，均未登录，未找到公开截图（第 5 节）。
2. 注册/充值/开票/税务的实际流程与限制，全部落在登录后区域（E1 的 FAQ 只给结论）。
3. uptime/availability 数字的采集口径与是否进入合同（页面自述为「过去 3 天」滚动统计，E4；合同 SLA 仅 Enterprise，E1）。
4. BYOK、ZDR、in-region 在真实请求中的生效细节与失败模式；in-region 的适用档位（Business 还是仅 Enterprise）在官方页面之间口径不一致，未核实（E1 vs E13）。

## 7. 证据表

| 编号 | URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持的判断 |
|---|---|---|---|---|---|
| E1 | https://openrouter.ai/pricing | OpenRouter pricing | 成功（200） | "Platform fees: Free N/A; Standard 5.5%; Business 8%"；"Workspace limit: Free 5 / Business 1,000"；"Contractual SLAs: Enterprise Yes" | 套餐分层、充值手续费、能力按档切割、SLA 仅 Enterprise |
| E2 | https://openrouter.ai/pricing（同页 FAQ 区） | OpenRouter pricing – FAQ | 成功（200） | "OpenRouter's fee is charged when you buy credits, 5.5% on Standard and 8% on Business, never on individual requests."；"Standard and Business include $25,000 of list-price inference per month through BYOK" | 收费层级、BYOK 额度与超出 5%、页面自述的失败尝试不计费（未独立验证） |
| E3 | https://openrouter.ai/docs/quickstart | OpenRouter Quickstart Guide | 成功（200） | "hundreds of AI models through a single API endpoint... handles fallbacks automatically"；"OpenAI SDK pointed at OpenRouter as a drop-in replacement" | 产品定位、接入方式、OpenAI 兼容 |
| E4 | https://openrouter.ai/anthropic/claude-sonnet-4.5 | Claude Sonnet 4.5 – API Pricing & Benchmarks | 成功（200） | "In / Out Price $3 / $15 per 1M"；"Context 1.0M"；provider 表含 $0.30 cache read、1.17s、38 tps、100.00% | 模型详情字段、价格样本 1、上游对比与 uptime 口径 |
| E5 | https://openrouter.ai/models | Compare AI Models: Pricing, Context & Benchmarks | 成功（200） | "$0.042/M input tokens $0/M output tokens"；"billed per second of generated audio"、"$0.15/minute" | 目录字段与多计费单位（含按分钟） |
| E6 | https://openrouter.ai/docs/features/model-routing | Auto Router – Intelligent Model Selection | 成功（200） | "ranked by market spend share... trailing 7-day window"；cost_tier "low, medium, high, xhigh, max" | 自动路由机制、账号级默认值、无额外路由费 |
| E7 | https://openrouter.ai/docs/guides/routing/model-fallbacks | Model Fallbacks – Automatic Failover Between Models | 成功（200） | "Requests are priced using the model that was ultimately used" | fallback 语义与计费归属 |
| E8 | https://openrouter.ai/docs/guides/routing/provider-selection | Provider Routing – Smart Multi-Provider Request Management | 成功（200） | 页面为 provider 排序/筛选与 ToS 汇总（本轮只取标题与主题） | 上游可选性是产品的一等能力 |
| E9 | https://openrouter.ai/docs/api-reference/limits | API Credit & Rate Limits – Handle 402 and 429 Errors | 成功（200） | "Account balance... Per-key credit limits... In-flight spending budget"；`GET /api/v1/key` 返回 `limit_remaining` | 配额模型、402/429 行为 |
| E10 | https://openrouter.ai/docs/guides/overview/auth/management-api-keys | Management API Keys | 成功（200） | "Management keys cannot be used to make API calls to OpenRouter's completion endpoints"；密钥仅显示一次 | 密钥治理与 SaaS 分发场景 |
| E11 | https://openrouter.ai/docs/api-reference/authentication | API Authentication | 成功（200） | 认证页说明 Authorization header 用法 | 接入方式 |
| E12 | https://openrouter.ai/docs/guides/features/workspaces | Workspaces – Organize Projects, Teams, and Agents | 成功（200） | "separate environments, each with its own API keys, routing defaults, guardrails, and observability" | 团队隔离模型、账号级 vs workspace 级设置 |
| E13 | https://openrouter.ai/docs/guides/privacy/provider-logging | Provider Logging – Provider Data Retention Policies | 成功（200） | "you can set whether you would like to allow routing to providers that may train on your data"；"only enabled for enterprise customers by request" | 隐私开关；in-region 适用档位（与 E1 冲突） |
| E14 | https://openrouter.ai/docs/guides/features/zdr | Zero Data Retention | 成功（200） | "enforce ZDR globally, per model group, per guardrail, or per request"；"Removes first-party Anthropic endpoints (Bedrock and Vertex remain available)" | ZDR 粒度与真实限制 |
| E15 | https://openrouter.ai/enterprise | Enterprise AI Infrastructure Made Simple | 成功（200） | "No markup: OpenRouter pricing always matches provider pricing"；"A single GDPR-compatible, SOC 2 compliant partner with SLAs" | 企业卖点（厂商自述，未独立验证） |
| E16 | https://openrouter.ai/rankings | LLM Rankings | 成功（200） | "Usage data through Sep 25, 2026"；"ranked by share of spend" | 榜单数据口径（滚动、基于平台内流量） |
| E17 | https://status.openrouter.ai/ | —（被 E1 引用） | 未访问 | — | 状态页存在但本轮未核实 |

反证 / 适用限制（不只看优点）
- 免费档限制明确：free 模型 20 请求/分钟、50 请求/天，累计购买 $10 credits 后升至 1,000/天，且余额为负时免费模型不可用（E1）。页面把「50 requests/day」写在 Free 行。
- 「No markup」是厂商自述（E15），同时平台在充值环节收 5.5%/8%（E1、E2），两个口径并存，不可只引用其中一个。
- uptime/availability（如 100.00% / 99.87%）是模型页「过去 3 天」的滚动观测值（E4），而合同性 SLA 只在 Enterprise 档（E1）；不能用滚动数字当作服务承诺。
- 同一模型的 endpoint 价可以不同（$3/$15 与 $3.30/$16.50），价高的一组被标注「Not used in Standard routing」（E4）——即比价时必须看 endpoint 是否参与 Standard 路由，价格低的那组才是 Standard 口径，不能把两组混用。
- in-region 路由的适用档位存在来源口径冲突：pricing 表格标 Business/Enterprise 可用（E1），provider-logging 文档写仅 enterprise 按需开通（E13）；本报告不据此下结论。
- 本报告未核实任何计费/赔付规则的真实执行（如失败是否真不计费、是否有赔付），第 6 节相关建议仅作为待核实项提出（E2、E7）。
- BYOK 不是无限免费：超过每月 $25,000 list-price 额度后按 5% 收（E1、E2）。
- 排行榜口径是「经 OpenRouter 的流量」（E16），不代表市场整体份额。
