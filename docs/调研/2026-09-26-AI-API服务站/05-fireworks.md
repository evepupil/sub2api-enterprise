# Fireworks AI 调研（fireworks.ai）

> 本文件只记录 2026-09-26 当天实际抓取到的公开页面内容。所有判断后附证据编号，证据表见第 7 节。
> 未登录、未注册、未充值、未调用任何付费模型；未渲染页面（本机浏览器不可用），因此不对视觉做任何像素/色值判断。

## 1. 基本判断

- 观察日期：2026-09-26（Asia/Shanghai）。抓取方式：HTTP GET（readable 抽取 + curl 原文存档）。
- 产品类型：AI 推理与训练平台（serverless 按 token 计费 + 专属 GPU 部署 + 微调/RL 训练），兼有面向编码工具的网关产品线 Nexus / FireRouter / FireConnect［E1］［E15］。
- 谁用：官网客户证言集中在 AI 产品公司与企业（Cursor、Vercel、Notion、Quora、Sourcegraph、UiPath、Cresta 等）［E1］；文档另有面向个人开发者的 Fire Pass（明确定位“personal, non-production”）［E17］；企业侧有 Admin 角色、SSO、数据驻留等治理能力［E8］［E11］。
- 与 AI API 中转站的相似处：都提供“拿一个 key、改 base URL、按量付费”的多模型调用入口；都强调 OpenAI 兼容；都有密钥管理、用量/成本查询、限额控制。文档明确提供 OpenAI 与 Anthropic 兼容端点［E5］。
- 与 AI API 中转站的不同处（有证据的差异）：(a) 模型来源以开源/开放权重为主并自建推理引擎，同时有自有训练/微调产品线［E1］［E19］；(b) 提供专属 GPU 部署与预留容量，计费单位是 GPU-秒而非 token［E6］［E20-b］；(c) 存在企业治理层（数据驻留、审计日志、SCIM 组、按用户花费上限）［E8］［E11］［E12］；(d) 明确声明 serverless 不附带延迟/可用性 SLA，需要保障须转专属部署［E10］。这一点与“中转站式可用性话术”差别最大。

## 2. 导航/页面与功能表

状态口径：`公开页面已核实` = 本次成功抓取且页面正文含该信息；`官方文档描述` = 官方文档写明但本次未进入控制台；`登录后未核实` = 需登录控制台；`未找到证据` = 本次 6~8 个页面内未见到，不代表不支持。

| 功能域 | 官方入口 | 本次所见 | 状态 |
|---|---|---|---|
| 发现与选型 | /models、/pricing、docs 推荐模型指南 | 模型库列表含上下文长度、类型标签（LLM/Vision/Embedding/Reranker）、部分模型直标价格；另有选型指南入口［E4］［E19］ | 公开页面已核实 |
| 开户与接入 | /signup、docs quickstart | 文档首步即“在 dashboard 创建 API key → 设为环境变量 → 调用”［E5］；On-demand 需装 firectl 并 login［E6］ | 官方文档描述 |
| 密钥 | app.fireworks.ai/settings/users/api-keys | 文档给出该 URL 与 REST 接口（POST /v1/accounts/{account_id}/users/{user_id}/apiKeys，支持 displayName、expireTime）［E5］［E21］；另有服务账号密钥［E22］ | 官方文档描述；控制台页 `登录后未核实` |
| 用量与账单 | /pricing、billing、docs 导出用量 | 预付费 credits + Auto Reload + 月度花费上限；用量/成本可导出与查询［E13］［E14］［E7］ | 官方文档描述 |
| 团队 | docs 用户与角色 | 四种角色：Admin / User / Contributor / Inference User，权限矩阵分“资源管理”“密钥与账号管理”两组［E8］；SSO（Google/OIDC/SAML）与 SCIM 组同步［E9］［E8］ | 官方文档描述 |
| 安全/隐私 | docs 数据安全、Trust Center | 声明对开放模型默认零数据留存（除用户显式开启）；传输 TLS 1.2+、静态 AES-256；BYOB/BYOK；审计与访问日志［E12］；企业页自述 HIPAA、SOC2 Type II、GDPR 合规［E9］ | 官方文档描述 + 厂商自述 |
| 服务保障 | docs FAQ“Serverless SLAs” | 原文：多租户 serverless 目前**不提供**延迟或可用性 SLA，有要求者建议用专属部署或联系销售［E10］ | 公开页面已核实（反证项） |
| 支持 | 文档站、Discord、status 页、contact sales | 文档首页列 Discord 社区、System Status、Talk to Sales、Security & Compliance［E5 所在站点导航］；status.fireworks.ai 与 trust.fireworks.ai 均返回 200（未读内容） | 公开页面已核实（仅可达性） |

## 3. 用户任务路径（仅依据文档步骤，未实际执行）

### 路径 A：个人开发者试用一个开源模型（文档所述，未真实调用）
1. 在 /models 浏览模型与价格/上下文，或读推荐模型指南选型［E4］［E19］。
2. 到控制台创建 API key 并写入环境变量［E5］。
3. 用 OpenAI / Anthropic / Fireworks SDK 或 curl 指向兼容端点发请求［E5］。
4. 注册赠 $1 免费额度；额度用完后若无支付方式账号会被暂停［E2］［E18］。
5. 若只想用于编码工具的个人场景，可走 Fire Pass（`fpk_` 前缀 key，仅限非生产）［E17］。
- 未核实点：$1 是否在注册时自动到账、需要何种验证，本次未见明文［E2］［E18］。

### 路径 B：小团队从试用转到专属部署（文档所述，未真实执行）
1. 先用 serverless 原型验证，再装 firectl 并 `firectl signin`［E5］［E6］。
2. 创建 on-demand deployment（文档示例为 GPT OSS 120B），得到 deployment 专属 model 字符串［E6］。
3. 用同一套 API 调用，只替换 model 名［E6］。
4. 配置自动扩缩（--min-replica-count / --max-replica-count / --scale-to-zero-window 等）［E23］。
5. 计费切换为按 GPU-秒，每个活跃实例持续计费，即使没有 API 调用；扩容过程也会产生费用［E20-b］。
- 未核实点：具体 GPU 单价未在本次抓取的价格页出现（价格页只给 serverless 与训练价），文档 sitemap 中无 deployments/pricing 页（该 URL 返回 404）［E2］。

### 路径 C：企业采购与治理（文档所述，未真实执行）
1. 联系销售，开通 Enterprise 账号类型；企业功能需 Admin 角色［E24］。
2. 配置 SSO 与 SCIM 组同步、给用户分配角色［E8］。
3. 设置月度花费告警/上限与按用户花费上限；企业告警只提示、不暂停服务［E7］。
4. 如需区域限制，在 Settings → Governances → Data Residency 设定；开启后不匹配区域的请求被拒，训练与 router 调用在驻留开启期间不可用［E11］。
- 未核实点：企业定价、合同折扣、SLA 条款文本，本次未取得［E10］［E24］。

## 4. 收费样本（均为公开页面价，2026-09-26 观察）

说明：以下均为**挂牌价**，非促销推断。文档声明价格单位为“每 100 万 token 的美元”，且每个单元格顺序为 输入 / 缓存输入 / 输出［E3］。

1. **Kimi K3（serverless，Standard 档）**：USD 3.00 / 0.30 / 15.00 每 1M tokens（输入 / 缓存输入 / 输出）。Priority 档为 3.75 / 0.375 / 18.75。适用条件：多租户 serverless；Priority 需请求里带 `service_tier: "priority"`；表中“—”表示该模型无 Priority［E3］［E16］。来源 E3，观察日 2026-09-26。
2. **GLM 5.3 Flash（serverless，Standard 档）**：USD 0.15 / 0.03 / 0.50 每 1M tokens；Priority 为 0.1875 / 0.0375 / 0.625［E3］。同页另有“US-only 版本自 2026-09-01 起按基础价 1.5 倍计价”的规则［E3］。
3. **托管微调（LoRA SFT，≤16B 参数基座）**：USD 0.50 每 1M **训练** token（DPO 与全参微调价格不同，16.1B–80B 起为 3.00/6.00/6.00/12.00 一档）［E2］。这是训练计价，不能与推理 token 价混算。
- 附带规则（非价格）：Batch 推理按 serverless 价的 50% 计（输入与输出都打折）［E3］［E16］；嵌入模型按输入 token 计，≤150M 参数为 USD 0.008/1M［E2］［E3］。
- **未核实**：on-demand 的 GPU-秒单价（本次未在公开价格页找到）；预留容量（Reserved）价格；企业合同价与折扣。
- **注意（口径冲突，勿直接引用其一）**：价格页写 serverless “postpaid billing”［E2］，而计费文档与 FAQ 明确写平台是 **pre-paid credits** 体系（先买 credits、用尽即暂停）［E13］［E18］。两者出现在同一家官网，本次无法判定哪个对当前账号类型生效。

## 5. 界面证据

- 本机浏览器不可用，**未渲染任何页面**。下文“界面”只做信息结构层面的描述（页面有哪些区块、字段、链接），不做像素、色值、间距、视觉评分。
- 官网 HTML 结构可确认的信息层级：/models 为“搜索 + 模型卡片列表（模型名、$/M 输入、$/M 输出、上下文长度、类型标签）”；/pricing 为三段式“Serverless Inference / Training / On Demand Deployments”+ 训练价格表 + Serverless Training API 表［E2］［E4］。这些来自 HTML 文本，不是渲染观察。
- 官方文档中引用的**产品截图 URL（均验证返回 200，未逐张查看内容）**：
  - `https://mintcdn.com/fireworksai/3EhcJE4PKaydIoxl/images/fine-tuning/create-sftj.png` — 出自 fine-tuning-models 页（创建 SFT 任务）［E25］
  - `https://mintcdn.com/fireworksai/YH2uwOIOrmQeCBpB/images/fine-tuning/sftj-details.png` — 同页（任务详情）［E25］
  - `https://mintcdn.com/fireworksai/YH2uwOIOrmQeCBpB/images/audit-logs-example.png` — 出自 audit_logs 页［E26］
  - `https://mintcdn.com/fireworksai/YH2uwOIOrmQeCBpB/images/serverless/ratelimit-example.png` — 出自 serverless/rate-limits 页［E16］
  - `https://mintcdn.com/fireworksai/r6jTtNQeedroFKBW/images/fireconnect/claude-connected.png` — 出自 fireconnect 页（Claude Code 已连接状态）［E15］
- 营销站另有首页/价格页 OG 图（`cdn.sanity.io/images/pv37i0yn/production/…`），性质是页面预览图，不是控制台界面［E1］［E2］。
- 真实登录操作：**未做**。`https://app.fireworks.ai/login` 与 `/signup` 在 `--ssl-no-revoke` 下返回 HTTP 200，但只说明入口可达，未渲染、未登录［E27］。控制台内部布局、导航结构：`登录后未核实`。

## 6. 借鉴建议

### 可借鉴
1. **把“保障边界”写在明面上**：文档直接说 serverless 无延迟/可用性 SLA，并指向专属部署与销售［E10］。对专业个人和小团队，这种“先说清楚不保证什么”比笼统的性能口号更省沟通成本，可作为我们服务等级页的写法参考。
2. **三档推理形态的产品分层**：Standard / Priority / Fast 用同一套 API 只改参数或 model 名区分，价格分档但不改接入方式［E3］［E16］，降低用户理解成本，适合我们做“共享池 / 优先池”的档位设计参考。
3. **计费口径显式化**：输入 / 缓存输入 / 输出三列计价，并在响应头回传 token 计数（`fireworks-prompt-tokens` 等）［E3］［E16］，可借鉴为“账单可对账”的产品表达。
4. **角色模型给到权限矩阵**：四种角色 + 两张权限表（资源 / 密钥与账号）［E8］，对“小团队”自助管理很实用，可作为我们团队页的字段来源。

### 不宜直接照搬
1. **按 GPU-秒计费的专属部署**：成本结构（无流量也持续计费、扩容过程也计费）［E20-b］与中转站按 token 的模型差异大，若照搬会给个人/小团队带来不可预期的账单。
2. **模型库规模与命名方式**：官网列出的模型条目上百条且混用厂商名/内部代号（如 “Qwen3.1.7B fp8 model used for drafting” 一类条目）［E4］，直接照搬会让选型页变成清单堆砌，需要先做收敛。
3. **企业治理层的完整度**（数据驻留、SCIM 组、按用户花费上限、BYOK）［E8］［E11］［E12］：这些是重投入能力，且有明确限制（驻留开启时训练与 router 调用被拒）［E11］，先照搬会造出“半可用”的开关。
4. **“零数据留存”这类合规表述**：原文附带“除非用户显式开启”的条件，且合规资质为厂商自述［E9］［E12］；没有审计报告时不宜直接抄进我们的宣传文案。

### 目前无法确认
1. 免费 $1 额度的领取条件、是否自动到账、是否有区域限制［E2］［E18］。
2. on-demand GPU-秒单价与预留容量价格；公开价格页本次未提供［E2］。
3. serverless 与实际吞吐/延迟的实测值：官网只有厂商自述（如“industry-leading throughput and latency”［E1］、客户证言中的 2s→350ms 等［E1］），本次未做任何压测，不引用为事实。
4. 控制台内部信息架构与真实登录后的账单页字段：未登录，未核实［E27］。
5. “postpaid”与“pre-paid credits”两种口径哪个对当前账号生效［E2］［E13］。

## 7. 证据表

| 编号 | URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持的判断 |
|---|---|---|---|---|---|
| E1 | https://fireworks.ai/ | Own Your Specialized Intelligence \| Fireworks | 成功 200 | “Serverless. Pay per token with Priority and Fast options… On-Demand. Dedicated deployments… Reserved. Guaranteed capacity” | 三种推理形态；企业客户证言；性能表述为厂商自述 |
| E2 | https://fireworks.ai/pricing | Fireworks - Pricing | 成功 200 | “Pay per token, with high rate limits and postpaid billing. Get started with $1 in free credits.” | 收费表达；训练价；$1 额度；与 E13 口径冲突 |
| E3 | https://docs.fireworks.ai/serverless/pricing | Serverless Pricing - Fireworks AI Docs | 成功 200 | “Prices below are per 1 million tokens in US dollars… Kimi K3 $3.00 / $0.30 / $15.00” | 价格样本；输入/缓存输入/输出三维；Batch 5 折 |
| E4 | https://fireworks.ai/models | Try Open Source LLMs & Image Models | 成功 200 | “Search our library of open source models and deploy in seconds.”；条目含 “$0.15/M Input • $0.6/M Output • 131072 Context” | 模型库结构、筛选标签、卡片字段 |
| E5 | https://docs.fireworks.ai/getting-started/quickstart | Serverless Quickstart | 成功 200 | “create an API key in the Fireworks dashboard… export it as an environment variable” | 接入路径；OpenAI/Anthropic 兼容 |
| E6 | https://docs.fireworks.ai/getting-started/ondemand-quickstart | Deployments Quickstart | 成功 200 | “On-demand deployments are dedicated GPUs… better performance, no rate limits, fast autoscaling” | 专属部署与 serverless 的区别 |
| E7 | https://docs.fireworks.ai/guides/quotas_usage/account-quotas | Account quotas | 成功 200 | “No payment method or no credits: 10 RPM；Payment method and active credits: 6,000 RPM (maximum)” | 层级/限额；月度花费上限与暂停机制 |
| E8 | https://docs.fireworks.ai/accounts/users | Managing users | 成功 200 | “Admin / User (default) / Contributor / Inference User”＋两张权限表 | 团队角色与权限矩阵 |
| E9 | https://fireworks.ai/enterprise | Fireworks - Products - Enterprise | 成功 200 | “Fireworks is fully HIPAA, SOC2-type2, and GDPR compliant… guarantee no data retention” | 企业定位；合规为厂商自述 |
| E10 | https://docs.fireworks.ai/faq-new/deployment-infrastructure/is-latency-guaranteed-for-serverless-models | Are there SLAs for serverless? | 成功 200 | “Our multi-tenant serverless offering does not currently come with Service Level Agreements (SLAs) for latency or availability.” | **反证**：serverless 无 SLA |
| E11 | https://docs.fireworks.ai/accounts/data-residency | Data residency | 成功 200 | “Data residency restricts inference on your account to a single region.”；开启期间 Training 与 Model routers 被拒 | 企业治理能力及其限制 |
| E12 | https://docs.fireworks.ai/guides/security_compliance/data_security | Data Security | 成功 200 | “Fireworks does not log or store prompt or generation data for open models, without explicit user opt-in.” | 隐私与数据安全描述 |
| E13 | https://docs.fireworks.ai/faq-new/billing-pricing/how-does-billing-and-credit-usage-work | How does billing and credit usage work? | 成功 200 | “Fireworks operates on a pre-paid credits billing system.” | **反证**：与 E2 的 postpaid 冲突 |
| E14 | https://docs.fireworks.ai/accounts/exporting-usage-and-costs | Usage & Cost Breakdown | 成功 200 | 页面主题为导出用量与成本明细 | 账单/用量查询能力存在 |
| E15 | https://docs.fireworks.ai/nexus/fireconnect | FireConnect | 成功 200 | “Point Claude Code, Cursor IDE, Codex, Copilot… at Fireworks with one FireConnect command” | 编码工具接入；含官方截图 |
| E16 | https://docs.fireworks.ai/serverless/rate-limits | Serverless Rate Limits | 成功 200 | “Adaptive rate limits grow and shrink with your usage”；按参数规模分 Small/Medium/Large 上限 | 限流机制；Priority 可降低 503 |
| E17 | https://docs.fireworks.ai/firepass | Fire Pass | 成功 200 | “Fire Pass gives eligible users access to selected open-weight model routers for personal, non-production agentic coding.” | 个人用户路径；明确禁止生产用途 |
| E18 | https://docs.fireworks.ai/faq-new/billing-pricing/what-happens-when-i-finish-my-1-dollar-credit | How do credits work? | 成功 200 | “Without payment method: Your account will be suspended until you add a payment method.” | 免费额度的硬限制 |
| E19 | https://docs.fireworks.ai/guides/recommended-models | Which model should I use? | 成功 200 | 官方“模型选型指南”入口，按用途给建议 | 选型引导存在 |
| E20-b | https://docs.fireworks.ai/faq-new/deployment-infrastructure/how-does-billing-and-scaling-work-for-on-demand-gpu-deployments | On-demand GPU deployment billing | 成功 200 | “Billed by GPU-second for each active instance… Costs accumulate even if there are no active API calls”；“Not fully serverless; requires some manual management” | 专属部署成本结构与人工运维负担（不宜照搬点） |
| E21 | https://docs.fireworks.ai/api-reference/create-api-key | Create API Key | 成功 200 | “POST /v1/accounts/{account_id}/users/{user_id}/apiKeys… displayName, expireTime, isFirepass” | 密钥可通过 REST 管理；字段含义 |
| E22 | https://docs.fireworks.ai/accounts/service-accounts | Service Accounts | 成功 200 | 服务账号及其密钥由 Admin 管理 | 团队密钥管理细分 |
| E23 | https://docs.fireworks.ai/deployments/autoscaling | Deployments Autoscaling | 成功 200 | “--min-replica-count 0… --scale-to-zero-window 1h… --load-targets” | 专属部署扩缩配置项 |
| E24 | https://docs.fireworks.ai/accounts/enterprise-features | Enterprise features | 成功 200 | “Contact inquiries@fireworks.ai or your account representative if you need Enterprise access” | 企业功能开通方式；需 Admin 角色 |
| E25 | https://docs.fireworks.ai/fine-tuning/fine-tuning-models | Fine-tuning models | 成功 200 | “navigate to the dataset tab, click Create Dataset and follow the wizard” | 微调流程；该页含官方截图 S1/S2 |
| E26 | https://docs.fireworks.ai/guides/security_compliance/audit_logs | Audit & Access Logs | 成功 200 | 审计与访问日志页，含官方示例截图 | 审计日志能力；截图 S3 |
| E27 | https://app.fireworks.ai/login | （应用入口） | 入口可达 200（未渲染、未登录） | 仅确认 HTTP 可达，页面内容未抽取 | 登录入口存在；控制台内部 `登录后未核实` |

> 反证/限制集中保留：E10（serverless 无 SLA）、E13 与 E2 的计费口径冲突、E11（数据驻留开启会拒掉训练与 router）、E17（Fire Pass 仅限非生产）、E20-b（专属部署无流量也计费）、E18（无支付方式会暂停账号）。以上均为官方原文，未做推断。

## 抓取与存档说明

- 原始 HTML 存档目录：`C:\code\sub2api-enterprise\.fleet\evidence\fireworks\`（homepage.html、pricing.html、models.html、docs_*.html、d_*.html、d2_*.html、docs_urls.txt 等）。
- 抓取工具：HTTP 直接 GET（curl.exe 25s 超时；`app.fireworks.ai` 域名在默认 schannel 校验下报 CRYPT_E_REVOCATION_OFFLINE，改用 `--ssl-no-revoke` 后返回 200）。
- 成功抓取页面数：**22 个 URL 返回 200**（含 2 个仅做可达性探测的 app 入口）；1 个 URL 返回 404（docs.fireworks.ai/deployments/pricing）。

SUMMARY: 收取 Fireworks AI 官网与文档站 22 个可达页面（首页、价格页、模型库、quickstart、配额、用户角色、数据驻留、数据安全、SLA FAQ、计费 FAQ、Fire Pass、FireConnect、autoscaling、审计日志、API 参考等），整理为 27 条编号证据（含 1 条 sitemap 404 与 6 条反证/限制项）、3 条用户任务路径、3 个确切价格样本（Kimi K3、GLM 5.3 Flash、LoRA SFT ≤16B）、5 个官方截图 URL、以及可借鉴/不宜照搬/无法确认各 4/4/5 条。未注册、未登录、未充值、未调用模型。

FILES: C:\code\sub2api-enterprise\docs\调研\2026-09-26-AI-API服务站\05-fireworks.md（唯一写入的报告）；原始素材 C:\code\sub2api-enterprise\.fleet\evidence\fireworks\（homepage.html、pricing.html、models.html、docs_serverless_pricing.html、docs_getting-started_quickstart.html、docs_guides_quotas_usage_account-quotas.html、docs_accounts_enterprise-features.html、docs_create-api-key.html、d_*.html、d2_*.html、d3_*.html、docs_urls.txt、img_*.png）。未改动其他任何项目文件。

VERIFY: 报告内每条事实均带证据编号并可回溯到 .fleet/evidence/fireworks 下的原始 HTML；价格三项逐字对照 docs.fireworks.ai/serverless/pricing 与 fireworks.ai/pricing 原文；截图 URL 逐个用 curl 验证返回 200（仅验证可达性，未查看图像内容，因当前模型不支持读图）；用 `ls -la` 确认写入目录与文件存在。

SELF_REPORT: pass

BLOCKED:
1. **计费口径冲突未解决**：价格页写 “postpaid billing”，计费文档与 FAQ 写 “pre-paid credits”［E2］［E13］，无法判断哪种对当前账号类型生效，已在第 4 节标为口径冲突。
2. **未登录控制台**：app.fireworks.ai 仅做可达性探测（200），控制台内部导航、账单页字段、密钥页实际 UI 全部为 `登录后未核实`；本机浏览器不可用，未渲染任何页面，故全篇无视觉判断。
3. **on-demand GPU-秒单价未找到**：公开价格页只给 serverless 与训练价，`docs.fireworks.ai/deployments/pricing` 返回 404，sitemap 中亦无对应价格页；该价格标为未核实。
4. **未读图像内容**：5 个官方截图 URL 仅验证 HTTP 200，未查看画面，因此不能描述其展示的界面元素；如需确认需由支持读图的一方复核。
5. **企业定价、合同折扣、SLA 文本、预留容量价格**均未取得（需联系销售）。
6. **仅取 8 个左右一手页面为限**：docs 站点 sitemap 共 386 个 URL，本次只覆盖其中与任务书主题相关的部分（另有 nexus/firerouter、llm-gateways、harnesses、benchmarking、regions、reservations、batch-inference 等未读），未找到不等于不存在。
7. 未做任何实测性能验证；官网与客户证言中的吞吐/延迟数字（如 2s→350ms、3x speedup）全部为厂商自述，报告未将其当作事实引用。

主控最值得复核的 2 个 URL：
- https://docs.fireworks.ai/serverless/pricing （价格与计费口径的唯一“source of truth”表述，含输入/缓存/输出三维与 Batch 5 折）
- https://docs.fireworks.ai/faq-new/deployment-infrastructure/is-latency-guaranteed-for-serverless-models （serverless 无 SLA 的原文，是本轮最重要的反证项）

登录/访问阻碍：app.fireworks.ai 在默认 schannel 校验下报 CRYPT_E_REVOCATION_OFFLINE 证书吊销检查失败，改用 `curl --ssl-no-revoke` 后返回 200；docs.fireworks.ai 与 fireworks.ai 直连正常。全程未绕过任何验证码或安全提示，未探测非公开接口。
