# Portkey（portkey.ai）调研

- 观察日期：2026-09-26（UTC+8 上午）
- 访问方式：HTTP 直连抓取 + 官方 docs（mintlify）+ 官方 GitHub 仓库 raw 文件。本机浏览器不可用，**未做任何真实登录、注册、充值或模型调用**。
- 抓取原文存档：`C:\code\sub2api-enterprise\.fleet\evidence\portkey\`（home.html、pricing.html、docs-model-catalog.html）

## 1. 基本判断

- 产品类型：**AI Gateway / LLMOps 治理平台**，不是模型额度分销商。官方自述为「AI Gateway、Observability、Guardrails、Governance、Prompt Management，all in one platform」[E1]。
- 重大变化（厂商自述）：首页与定价页页脚均出现「Portkey is now PRISMA AIRS AI Gateway, generally available for all enterprises」[E1][E2]。调研时旧品牌 Portkey 仍在使用，两套命名并存，主控复核时需注意。
- 谁用：官方口径是「GenAI teams」「AI teams」；客户证言里出现 ML Engineer、CTO、Cloud Solutions Architect、Fortune 500 制药公司 AI 负责人 [E1]。定价分层把「prototyping/POC」与「teams ready to deploy LLM apps in production」和「复杂合规 + 高并发」分开 [E2]，即**专业个人/小团队/企业共用一套产品，靠套餐和功能门禁区分**。
- 与 AI API 中转站的相似点：都是"一个 API Key 换多模型统一入口"。官方自述「Portkey lets you access 1,600+ LLMs via a unified API」[E1]；文档写「one Portkey API key → Access multiple providers → Use hundreds of models」[E7]。
- 与中转站的**核心不同**（本路重点）：
  1. **已读公开接入文档以自带供应商凭证（BYO provider key）为主**。接入方式是用户把自己的 Provider 凭证存进平台，官方写「Provider credentials stored securely, never exposed in code」[E7]，并要求先「Add Provider」填 credentials 再使用 [E8]。**但本轮未找到 Portkey 自售模型额度的证据，也未找到其明确否认自售的表述**，因此不能断言其完全不提供类似中转站的额度转售（该点记为未找到证据，见第 2、6 节）。已可确认的是：其公开接入路径以用户自带供应商凭证为主。
  2. **计价单位是请求/日志数，不是 token**。套餐按 "recorded logs per month"、"Requests per Month" 计 [E2][E4]，而非按输入/输出 token 差价。
  3. **后台重心是治理**：预算与限流、RBAC、审计日志、SSO、PII 脱敏、数据驻留、私有化部署 [E5][E6][E10]。
  4. **价格量级**：观察日公开挂牌价为 $49/月 [E2]，企业为定制报价 [E2][E11]。本轮仅读到官网定价页与文档对比表，未取得历史价格或合同条款，因此只能视作**观察日公开挂牌价**，不足以断言其为长期稳定价。中转站通常按 token 单价折扣竞争，两者不可直接比价。

## 2. 导航 / 页面与功能表

页面导航结构（据首页与页脚 [E1][E2]）：Product（AI Gateway / Observability / Guardrails / Prompt Engineering Studio / Agents / MCP Gateway / Security & Compliance / Model Catalog）、Solutions（Startup / Enterprise）、Developers（Documentation / Github / API Status / Changelog / Integrations / Error Library / Cookbooks）、Company（Pricing / Privacy / Terms / DPA）、Resources（Blog / Customers / Model Rankings）。

| 域 | 具体能力（页面所见） | 状态 |
| --- | --- | --- |
| 发现与选型 | 定价三档对比表、功能对比表、FAQ、Schedule a call / Book a demo、GitHub 10.2K ⭐ [E1][E2][E4] | 公开页面已核实 |
| 开户与接入 | 「Start for Free」「Sign Up」；3 行代码集成，Node.js/Python/OpenAI JS/OpenAI Py/cURL 示例；「takes 2 mins to integrate」 [E1][E3] | 公开页面已核实（注册流程本身未进入） |
| 密钥 | Model Catalog 取代原 Virtual Keys；org 级建 master Integration，含 credentials、默认预算、速率限制、模型 allow-list；`@provider-slug/model-name` 调用格式 [E7][E8] | 官方文档描述 |
| 用量与账单 | Logs 含 timestamp/request type/LLM/tokens/cost；Status 列显示 Cache Hit、Retry Success、Fallback Active、Loadbalancer Active；可 Log Replay [E9]。成本管理按 provider/model 实时计价，支持企业自定义价 [E2][E4] | 官方文档描述 |
| 团队 | 多 organization 隔离；默认三角色 Owner/Admin/Member，附完整权限矩阵（Billing 仅 Owner，API Keys 仅 Owner/Admin，Team 仅 Owner/Admin） [E10] | 官方文档描述 |
| 预算与限流 | Workspace 级 Budget Allocation：Cost(USD) 或 Tokens、Alert Threshold、Periodic Reset（weekly/monthly/1–365 天）；Rate Limit 支持 rpm/rph/rpd [E6] | 官方文档描述 |
| 安全/隐私 | 传输 TLS 1.2+、静态 AES-256、token 鉴权、企业版 SSO via OIDC、RBAC、防火墙与 DDoS 防护；合规自述 SOC2 / ISO27001 / GDPR / HIPAA [E5] | 官方文档描述（厂商自述） |
| 服务保障 | 「Enterprise-Grade Reliability, backed by robust SLAs」+ Check Status；安全文档自述 99.995% uptime、310 个数据中心 [E2][E5] | 官方文档描述（厂商自述） |
| 支持 | Community Support（Dev 档）、Production Support（$49 档）、Dedicated Onboarding & Priority Support（企业档）；工单入口 support.portkey.ai [E2][E5] | 公开页面已核实 |
| 部署形态 | Portkey-Managed SaaS / Hybrid（网关在客户 VPC）/ Airgapped（**已不再对新客户提供**） [E4][E11][E12] | 官方文档描述 |
| 实际控制台界面 | 未登录，未验证任何后台页面真实存在与可操作性 | 登录后未核实 |
| 是否由 Portkey 自售模型 token 额度 | 所有已读页面均指向 BYO provider key，未见自售额度套餐 | 未找到证据（≠ 不支持） |
| 99.9% SLA 具体条款与赔付 | 搜索摘要出现「99.9% Uptime SLA」，但正文页未见该表述；仅见 99.995% 自述 [E5] | 未找到证据（正文） |

## 3. 用户任务路径（均为文档/页面推演，未实际执行）

**路径 A：专业个人从零到第一次请求**
1. 首页看到「Start for Free」→ 进入注册（未执行）[E1][E2]。
2. 官方文档「What is Portkey?」称 2 分钟集成、3 行代码 [E3]。
3. 在 Model Catalog → Add Provider 填自己的 provider credentials [E8]。
4. 代码里用 `model="@provider-slug/model-name"` 发起请求 [E7]。
- 证据位置：E1、E2、E3、E7、E8。**未验证**：注册表单字段、首次登录后的引导流程。

**路径 B：小团队做预算与限流管控**
1. 管理员在 app 侧栏点 Workspace Control → Budget Allocation 标签 [E6]。
2. 打开 Add Budget，选 Cost(USD) 或 Tokens，填 Budget Limit ($) [E6]。
3. 设 Alert Threshold ($)，选 Periodic Reset（weekly/monthly） [E6]。
4. 需要时用 Admin API 下发 `usage_limits` 与 `rate_limits`（rpm/rph/rpd） [E6]。
- 证据位置：E6。**注意限制**：文档明写 Workspace Budget Limits「available to Portkey Enterprise customers and select Pro users」，需联系 support 开通 [E6]；$49 档未必默认包含。

**路径 C：企业信息安全和采购评估**
1. 从定价页 Enterprise「Talk to Us」或 Book a demo 进入销售流程 [E2]。
2. 读 Pricing Structure，按四要素报价：部署形态、生产网关数量、请求量、支持级别 [E11]。
3. 读 Security Comparison 表，按 SaaS Enterprise / Hybrid 对比数据驻留、日志留存、KMS、身份、出网、BCP/DR [E12]。
4. 用 RBAC 权限矩阵确认角色划分 [E10]。
- 证据位置：E2、E10、E11、E12。**未验证**：报价数字、合同条款、SLA 赔付文本。

## 4. 收费样本（观察日期 2026-09-26，来源均为官方页面）

| # | 价格 | 币种 | 计价单位 | 输入/输出区别 | 适用条件 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | **$49 / 月**（观察日公开挂牌价） | USD | **每月记录的日志条数**，非 token | 无输入/输出区分；超量按请求数计 | Production 档，含 100k recorded logs/月，超出 +$9 / 每额外 100k requests，上限至 3M requests；官方同时标注「Not recommended for organizations requiring custom security controls or data residency guarantees」 | [E2][E4] |
| P2 | **$0（Free Forever）** | USD | 每月 10k recorded logs | 无 | Developer 档；官方写「Not suitable for production workloads」；「No Overage Allowed」；留存 3 天 logs / 30 天 metrics | [E2][E4] |
| P3 | 未核实 | — | — | — | Enterprise 档仅写「Custom Pricing」，未公开任何数字；官网企业页抓取返回非文本内容，无法读取 | [E2][E11] |

- 关键澄清：Dev 档超限「doesn't affect your requests; only logs beyond the limit are not recorded」（超限不影响请求，只是不再记录日志）[E2]——这与"额度用尽即断服"的中转站逻辑不同。
- 以上均为**观察日（2026-09-26）官网公开挂牌价**，页面上未标注促销或限时字样。仅凭单次观察不足以判定其长期稳定，未取得历史价格记录。

## 5. 界面证据

**仅信息结构分析**：以下均为官方公开图片 URL，HTTP 返回 200（HEAD 校验）。本机无浏览器渲染，**未亲眼查看图片内容**，图片说明文字来自其所在页面的图注/上下文，不代表我对视觉细节的观察。因此不给像素、色值或视觉评分。

- 官方截图（文档页配图，Model Catalog 流程）：
  - `https://mintcdn.com/portkey-docs/Az_PJRPMq602xEZC/images/product/model-catalog/model-catalog-ai-providers-list-new.png` — AI Providers 列表 [E8]
  - `https://mintcdn.com/portkey-docs/Az_PJRPMq602xEZC/images/product/model-catalog/model-catalog-budget-limits-configuration-v2.png` — 预算限制配置 [E8]
  - `https://mintcdn.com/portkey-docs/Az_PJRPMq602xEZC/images/product/model-catalog/model-catalog-workspace-provisioning-interface-v2.png` — workspace 开通界面 [E8]
  - `https://mintcdn.com/portkey-docs/QKXLB-54q6gEhIad/images/guardrails/org-switcher.png` — 文档图注「Organization switcher on the Portkey UI」[E10]
- 官方营销配图（首页，非截图，可能为设计稿）：`https://framerusercontent.com/images/dKptsZkAYM50tMXRUa6enReq4M.png?width=788&height=873`，对应「Stay in control with full visibility」区块 [E1]。
- 首页存在大量 Framer 生成的重复节点（同一文案出现 3–4 次）与动画计数器在静态 HTML 中显示为 `0Tn+`、`0%`、`0.999%`，**说明这些数字是前端动画占位，不能当真实数据引用** [E1]。
- 真实登录后的控制台：**未核实**（无浏览器、未创建账号）。

## 6. 建议

**可借鉴**
1. 把「治理能力」做成独立于额度的商品：预算、限流、审计、RBAC 单独成表，与"用多少 token"解耦 [E4][E6][E10]。
2. 权限矩阵用可读表格直接公开（Owner/Admin/Member × 功能），采购和团队都能自助判断 [E10]。
3. 定价页同时给「功能对比表」和「一句话适合谁/不适合谁」，如 Production 档明写「Not recommended for ... data residency guarantees」[E2]，减少误购。
4. 日志页把 Cache/Retry/Fallback/Loadbalance 的运行状态做成可见列 [E9]，让"钱花在哪、为什么慢"一眼可查。

**不宜直接照搬**
1. 用动画计数器承载核心指标：静态 HTML 抓取中首页 token 数、uptime、star 数显示为 `0Tn+`、`0%`、`0.999%` 等占位值 [E1]。本轮无浏览器渲染，**无法判断真实渲染效果与对用户的观感影响**；可确定的只是"静态抓取不能引用这些数字"。是否借鉴其动态展示方式需在可渲染环境下另做评估。
2. 把关键能力（预算限流）做成"联系 support 才能开通" [E6]，对小团队是明显的转化摩擦。
3. 品牌名中途切换（Portkey → PRISMA AIRS）而旧名继续流通 [E1][E2]，会让外部文档、搜索和用户心智混乱。
4. 免费档留存只有 3 天 logs [E2]，对"想先评估可观测性"的专业个人偏紧。

**目前无法确认**
1. Portkey 是否在任何场景下自售模型 token 额度（已读公开接入文档以 BYO 供应商凭证为主，但未见证据也未见否认，不能据此断定没有）。
2. $49 Production 档是否默认含 Workspace Budget Limits（文档只说 Enterprise 和"select Pro users"）[E6]。
3. 99.9% SLA 的具体可用性承诺与赔付条款（正文未见，仅见 99.995% 自述）[E5]。
4. 注册/开卡是否需要信用卡、是否有试用赠额——未执行注册，无证据。

## 7. 证据表

| 编号 | 完整 URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持的判断 |
| --- | --- | --- | --- | --- | --- |
| E1 | https://portkey.ai/ | Portkey \| Control Panel for Production AI | 成功 200 | "Portkey is now PRISMA AIRS AI Gateway ... generally available for all enterprises"；"access 1,600+ LLMs via a unified API" | 产品定位、更名、统一 API 自述、客户证言、动画计数器问题 |
| E2 | https://portkey.ai/pricing | Portkey \| Control Panel for Production AI（pricing） | 成功 200 | "Production $49/month ... 100k recorded logs per month +$9 overages per additional 100k requests"；"Developer Free Forever 10k recorded logs" | P1/P2 价格与计价单位、功能分档、支持档位、SLAs 自述 |
| E3 | https://portkey.ai/docs/introduction/what-is-portkey | What is Portkey? - Portkey Docs | 成功 200 | "It takes 2 mins to integrate"；"unified interface for interacting with over 250 AI models" | 接入速度自述（注意此处 250 与首页 1,600+ 不一致） |
| E4 | https://portkey.ai/docs/product/product-feature-comparison | Feature Comparison - Portkey Docs | 成功 200 | "Pro ($49/Month) ... Overage $9/Month for Every 100K Up to 3M Requests"；"Airgapped Deployment (No Longer Offered)" | 分档细节、部署形态、airgapped 停售 |
| E5 | https://portkey.ai/docs/product/enterprise-offering/security-portkey | Security @ Portkey - Portkey Docs | 成功 200 | "TLS 1.2 or higher ... AES-256"；"compliant with ... SOC2, ISO27001, GDPR, and HIPAA"；"99.995% uptime ... 310 data centers" | 安全/加密/合规/可用性均为厂商自述 |
| E6 | https://portkey.ai/docs/product/administration/enforce-workspace-budget-limts-and-rate-limits | Enforce Workspace Budget and Rate Limits | 成功 200 | "available to Portkey Enterprise customers and select Pro users. To enable these features ... contact Portkey support" | 预算限流能力与开通门槛（重要限制） |
| E7 | https://portkey.ai/docs/product/ai-gateway/virtual-keys | Virtual Keys - Portkey Docs | 成功 200 | "Virtual Keys have been migrated to Model Catalog"；"One Portkey API key → Access multiple providers"；"Provider credentials stored securely" | 密钥模型、BYO provider key 的关键证据 |
| E8 | https://portkey.ai/docs/product/model-catalog | Model Catalog - Portkey Docs | 成功 200 | "Add a Provider: Go to Model Catalog → Add Provider"；"Use @provider-slug/model-name" | 接入步骤、截图 URL 来源 |
| E9 | https://portkey.ai/docs/product/observability/logs | Logs - Portkey Docs | 成功 200 | "timestamp, request type, LLM used, tokens generated, thinking tokens and cost"；"Cache Hit, Cache Semantic Hit, Retry Success, Fallback Active" | 日志字段与状态可视化 |
| E10 | https://portkey.ai/docs/product/enterprise-offering/access-control-management | Access Control Management | 成功 200 | "three roles: Owner, Admin, and Member"；"Billing: Manage（仅 Owner）" | 多组织隔离与 RBAC 权限矩阵 |
| E11 | https://raw.githubusercontent.com/Portkey-AI/docs-core/main/enterprise/pricing.mdx | Portkey Enterprise Pricing Guide | 成功 200 | "Your base enterprise license includes one (1) production gateway deployment"；"Unlimited dev/staging gateways" | 企业报价四要素、无公开数字 |
| E12 | https://raw.githubusercontent.com/Portkey-AI/docs-core/main/enterprise/security.mdx | Security Comparison (at a glance) | 成功 200 | "Logs 90 days; metrics 365 days by default; zero-retention available"；"Metrics are always sent to Portkey ClickHouse" | 部署安全对比；**反证：Hybrid 模式指标仍须出网到 Portkey** |
| E13 | https://status.portkey.ai | Portkey status | 成功 200（PowerShell；curl 报错 code 35） | 页面由 uptime.betterstack.com 托管 | 状态页存在，但未读到具体可用率数值 |
| E14 | https://trust.portkey.ai | （未取得标题） | **失败** curl exit 35，重试 PowerShell 亦未取得内容 | — | 合规证书无法第一手核验，SOC2/ISO 结论只能记为厂商自述 |
| E15 | https://portkey.ai/enterprise | （返回非文本内容） | **失败**（内容不可读） | — | 企业页信息缺失，改用 E11/E12 替代 |

### 反证与适用限制（必读）

1. **Hybrid 部署并非全离线**：文档明写「Metrics are always sent to Portkey ClickHouse」，仅支持 IP/URL 脱敏与区域自选 [E12]。**注意：区域选择与是否出网是两个不同问题**——文档同时写明 ClickHouse 区域可由客户选择，故"出网"不等于"数据出境"。本报告**不推导**只有停售的 airgapped 才能满足数据不出境；具体是否合规需逐项核对部署区域、出网字段（哪些指标）与合同条款，本轮未做此核对。
2. **预算限流不是标准功能**：$49 档默认不保证包含，需联系 support 开通 [E6]。
3. **免费档明确不适合生产**，且不允许超量 [E2][E4]。
4. **模型数量口径不一致**：首页 1,600+ LLM [E1] vs 文档 250 AI models [E3]，两个数字来自同一厂商，需主控注意。
5. **本报告未做任何真实登录、充值或 API 调用**，所有后台界面结论均来自公开文档，非实测。
