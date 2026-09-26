# Novita AI 调研（AI API 服务功能、客户路径、收费表达与界面证据）

- 观察日期：2026-09-26（状态页显示 "Last updated on Sep 26, 2026 at 4:01am UTC"，与本机观察一致）
- 调研范围：仅 novita.ai 与 docs.novita.ai 的公开页面；未注册、未登录、未充值、未调用任何模型、未提交任何表单
- 原始抓取素材：`.fleet/evidence/novita/fetch-log.md`
- 说明：本报告为调研记录，不含需求结论、技术选型或视觉方案

## 1. 产品定位与与 AI API 中转站的异同

- 产品类型：一个平台覆盖四条产品线——Serverless Model APIs、Dedicated Endpoints、Agent Sandbox、GPU Cloud（GPU Instances / Serverless GPU / Bare Metal）。首页原话："Run 200+ models through a single API. No infrastructure to manage."，并明确 "Billed by the token, not the hour."（E1）
- 与纯 API 中转站的关键差异：Novita 同时卖按 token 的模型 API 与按 GPU 小时/秒的算力产品，并对外宣称自有基础设施（"Up to 50% less than major cloud providers"，厂商自述，E1）。我们若只做 API 中转，可借鉴其 API 侧的信息架构，不宜把 GPU 云的产品结构整体搬入。
- 谁在用（页面自述，非我方判断）：Hugging Face、Fish Audio、Kilo Code 等被列为客户证言（E1）；文档里出现面向企业/受监管行业（金融、医疗、政务）的专用端点叙述（E16/E18）；团队功能与预算功能面向多成员组织（E8/E9）。
- 对 API 中转而言最直接可比的部分：OpenAI 兼容 base_url（`https://api.novita.ai/openai`）、Bearer `sk_` 密钥、输入/输出分别计价、模型目录、Playground、用量监控、RPM/TPM 分档限额（E5/E6/E7/E13/E12）。
- 与我们差异较大、需要单独判断的部分：Dedicated Endpoints 的副本/GPU 小时计费、Agent Sandbox 的 vCPU/内存按秒计费、Bare Metal 报价制（E17/E19）。

## 2. 导航 / 页面与功能表

| 环节 | 观察到的内容 | 状态 |
|---|---|---|
| 发现与选型 | 首页按 MODEL APIS / AGENT SANDBOX / GPU CLOUD 分区；价格页按厂商分组列出模型、上下文、输入价、输出价、缓存读价；模型详情页含 "Serverless / Function Calling / Structured Output / Reasoning / Anthropic API" 等能力标签与可复制 Python 代码 | 公开页面已核实（E1/E2/E3） |
| 发现与选型 | 文档索引（llms.txt）列出全部 API Reference 与 Guides，含 llms-full.txt 全量文本与 `.md` 变体 | 公开页面已核实（E4） |
| 开户与接入 | 注册/登录支持 Google、GitHub 或邮箱；接入步骤为 登录 → 建 Key → 确认额度 → 发请求；支持 OpenAI 兼容端点与 Anthropic 兼容说明 | 官方文档描述（E5/E4） |
| 开户与接入 | 身份验证（Identity Verification）被列为 Owner 专属的 Read/Write 资源，403 提示中提到 "whether identity verification is required" | 官方文档描述（E8/E5）；触发条件与流程细节未核实 |
| 密钥 | Key Management 页创建/管理；`sk_` 前缀；每个账号最多 10 个 Key；创建时四选一有效期（Permanent / 90 days / 30 days / 24 hours）且创建后不可更改；完整 Key 仅显示一次 | 官方文档描述（E6） |
| 密钥 | 每个 Key 可配模型访问策略与来源 IP 网络访问策略；越权调用返回 403 `model_access_denied`；OpenAPI 可读写策略但不支持创建/删除 Key | 官方文档描述（E6/E15） |
| 用量与账单 | 按 token 计费，Total Cost = 输入 token×输入价 + 输出 token×输出价；200 与 499（客户端断开）计费，400/401/403/429/500/503/504 不计费 | 官方文档描述（E7） |
| 用量与账单 | 计费明细支持按时间范围与分组导出（"Billing - Billing Details - Usage-based Billing"，可导出 .xlsx）；有余额预警（低余额邮件）与自动充值 | 官方文档描述（E19/E9/E22） |
| 用量与账单 | 控制台账单页面的实际布局 | 未找到证据（https://novita.ai/billing 为 JS 动态渲染，抓取失败，E24）；登录后未核实 |
| 团队 | 个人账号可升级为团队账号（不可回退）；5 个角色 Owner / Admin / Developer / Basic / Billing，并有逐资源权限矩阵；最多邀请 200 名成员；审计日志仅 Owner/Admin 可见 | 官方文档描述（E8） |
| 团队 | 双层预算：成员预算（覆盖 LLM API、GPU、Sandbox 等全部）与 API Key 预算（仅约束 LLM API）；类型为 Unlimited / Fixed / Monthly，Monthly 于每月 1 日 00:00 UTC 重置 | 官方文档描述（E9）；该功能仅团队账号可用 |
| 安全 / 隐私 / 服务保障 | 密钥网络访问策略、模型访问策略、团队审计日志 | 官方文档描述（E6/E15/E8） |
| 安全 / 隐私 / 服务保障 | 状态页 "All services are online"，API Gateway 100% uptime、Sandbox Usage 99.910% uptime（近 90 天视图），逐模型可用性列表 | 公开页面已核实（E20）；页面未提供 SLA 条款文本，也未见订阅入口 |
| 安全 / 隐私 / 服务保障 | 专用端点页面自述 "Guaranteed 99.9%+ uptime, with customizable SLAs for latency, availability, and throughput." | 官方文档描述，厂商自述（E18） |
| 安全 / 隐私 / 服务保障 | 隐私政策 / 服务条款正文（含数据处理与免责条款原文） | 未找到证据（正文直接抓取失败；搜索摘要显示可能存在模型可下线与免责类表述，法律条款正文未直接核实，不作为确定性条款，E25） |
| 支持 | Discord 社区、support@novita.ai、销售预约链接（meet.brevo.com/novita-ai/contact-sales）；专用端点文档提及 24/7 技术支持 | 官方文档描述（E5/E12/E18/E17） |
| 支持 | 工单系统、SLA 赔付承诺 | 未找到证据 |

## 3. 用户任务路径（每步标注证据）

路径 A：专业个人从发现到首次调用（未实际执行注册/充值/调用）
1. 首页了解 "Run 200+ models through a single API"，确认按 token 而非按小时计费 —— E1
2. 价格页按厂商分组浏览模型、上下文与输入/输出价 —— E2
3. 模型详情页查看能力标签（Function Calling、Structured Output、Anthropic API）并复制代码片段 —— E3
4. 注册/登录（Google、GitHub 或邮箱）—— E5（文档描述的入口；我方未注册）
5. 在 Key Management 创建 Key，命名如 `production`，立即保存（只显示一次）—— E6
6. 发送请求前确认可用额度 —— E5（指向 Billing and Payments 页；该页为 JS 渲染，未核实，E24）
7. 用 `curl https://api.novita.ai/openai/v1/chat/completions` 发首条请求，期望 HTTP 200 且 `choices[0].message.content` 非空 —— E5
8. 失败时按 401（Key 格式）、403（模型访问/身份验证）、429（限流）、5xx（平台错误）排查 —— E5/E6/E12

路径 B：小团队管理员开通团队与成本管控
1. 在 Team Settings 点 "Upgrade to Team Account"（文档警告：升级后不可降级）—— E8
2. 邀请成员（上限 200）并按需分配角色 —— E8
3. 在 Budgets 页为成员设置预算类型与额度（截图见 E23）—— E9
4. 为对外共享的 Key 单独设 API Key 预算（只约束 LLM API 花费）—— E9
5. 在 LLM Monitoring 页看 RPM、请求成功率、平均 token 数、E2E 延迟、TTFT、TPOT —— E13
6. Owner/Admin 查看审计日志核对成员操作 —— E8

路径 C：企业采购专用端点
1. 读专用端点文档，确认独占 GPU、隔离与自述 SLA —— E16/E18
2. 在专用端点页填写公司名、用例、GPU 数量与联系方式，等销售回访；或预约销售通话 —— E11
3. 在控制台 Deployments 新建部署：命名、选模型源（Novita 目录或 Hugging Face，私有/受限模型需绑定 HF Token）、选 GPU、配置自动伸缩，可选挂 LoRA —— E16
4. 等待启动（文档称通常 5–60 分钟，经历 Requesting GPU → Downloading Model → Engine Initializing），状态 RUNNING 后调用 OpenAI 兼容地址 —— E16
5. 计费按运行副本每秒计算，scale-to-zero 后停止计费 —— E17
- 说明：专用端点的订阅流程（在定价页选计划、Contact Sales 提交申请、审批后订阅）来自搜索摘要，未直接抓取原文，属二手信息，见 E25。
- 说明：本节路径 C 的采购流程为搜索摘要所述，我方未提交申请、未预约通话、未执行订阅。

## 4. 收费样本（币种 USD；均为页面明示价格，非我方推算）

1. DeepSeek V4.1 Flash（模型 `deepseek/deepseek-v4.1-flash`）：输入 $0.3 / 百万 token；缓存读 $0.006 / 百万 token；输出 $1.2 / 百万 token。上下文 1M、最大输出 384K。适用条件：Serverless 按 token 计费；输入与输出单价分开列示。来源 E2 与 E3，观察日期 2026-09-26。
2. NVIDIA H200 SXM 141GB：$2.99 / GPU-hour；同页 H100 SXM 80GB $1.99 / GPU-hour、RTX 4090 24GB $0.61 / GPU-hour。适用条件：Dedicated Endpoints，按运行副本每秒计费，空闲缩容到 0 不计费。来源 E17，观察日期 2026-09-26。
3. Agent Sandbox：CPU $0.0000098 / vCPU / 秒（1 核档，2 核为 $0.0000196/s）；持久存储超出 60GB 免费额度后 $0.00009 / GB / 小时。适用条件：CPU 与 RAM 仅在沙箱 running 时计费，暂停后仅计存储。来源 E19，观察日期 2026-09-26。
- 充值门槛：手动充值金额必须大于 $10（E10）。
- 促销识别（不得当作长期价）：价格页首行 "Batch inference is available at an introductory 50% discount on input and output tokens for supported models."（E2）；首页标签出现 "TIME LIMITED FREE"（Ling 3.0 Flash Fin）与 "LIMITED TIME 50% OFF"（Qwen3.7 Max）（E1）；Sandbox 文档提到新用户完成设置问卷可获 $100 促销额度，且"Credits may be subject to availability, validity period, usage scope, and quota limits."（E19）。以上均为限时/促销，不可作为长期定价依据。
- 未核实：控制台内的实际扣费账单金额、缓存读价在哪些模型上生效、企业定制定价。

## 5. 界面证据

- 官方截图（公开图片资源，来自官方文档正文，非我方登录后截图）：
  - Budgets 成员预算列表：https://mintcdn.com/novitaai/H3Kjvdvlhgt0Aohj/guides/images/Budges01.png （说明页 https://docs.novita.ai/guides/budgets.md）
  - 预算类型与额度编辑：https://mintcdn.com/novitaai/H3Kjvdvlhgt0Aohj/guides/images/Budges02.png （同上）
  - 预算与用量刷新：https://mintcdn.com/novitaai/H3Kjvdvlhgt0Aohj/guides/images/Budges03.png （同上）
  - Stripe 支付方式：https://mintcdn.com/novitaai/pBY37YC9HPtF1YcS/guides/images/payment_methods_stripe.png （说明页 https://docs.novita.ai/guides/payment-methods.md）
  - GPU 实例日志面板：https://cf-images.novitai.com/docs/v2/gpu_instance_faq_logs.png/docs （说明页 https://docs.novita.ai/guides/faq.md）
  - CUDA 版本筛选器：https://cf-images.novitai.com/docs/v2/gpu_instance_faq_filter_cuda.png/docs （同上）
  - curl 复核：Budges01.png 与 gpu_instance_faq_logs.png 返回 HTTP 200；其余图片未逐个复核。
- 控制台页面路径（仅 HTML/路由层面证据，未见渲染结果）：/dashboard、/models-console/llm-playground、/models-console/multimodal-playground、/models-console/image-playground、/models-console/llm-metrics、/settings/team、/settings/key-management、/billing/budgets（E9/E13/E8/E6 中的链接与搜索摘要）。
- 本机浏览器连接不可用，未渲染任何控制台页面。因此本报告**只做信息结构分析**，不提供像素、色值、间距或视觉评分。
- 登录后界面（仪表盘、账单页、密钥列表实际排布）：登录后未核实。

## 6. 建议（供后续判断，非结论）

可借鉴：
1. 模型目录的"厂商分组 + 上下文 / 输入价 / 输出价 / 缓存读价"四列结构，以及模型详情页把能力标签（函数调用、结构化输出、推理、Anthropic 兼容）与可复制代码放在同一屏（E2/E3）。
2. 密钥页把"模型访问策略"与"来源 IP 策略"作为 Key 的可选属性，并明确越权返回 403 与错误码（E6/E15）。
3. 双层预算模型：成员级总预算 + Key 级仅限 API 花费的预算，并明示"两者同时生效、先到先限"（E9）。
4. 计费规则写清 HTTP 状态码计费边界（含 499 客户端断开计费），这类"容易起争议的边界"前置说明可减少客服成本（E7）。

不宜直接照搬：
1. GPU 云、Agent Sandbox、Bare Metal 的导航与计费单位（GPU-hour、vCPU/秒、按秒计费）与纯 API 中转的用户心智不同，混排会让 API 用户难以判断价格（E1/E17/E19）。
2. 首页把"200+ 模型""50% 更便宜"这类厂商自述放在首屏，若我们无法核实，容易形成不可兑现的承诺（E1）。
3. 团队账号"升级后不可降级"的硬性设计，对试用型小团队是明显摩擦点（E8）。
4. 促销标签（TIME LIMITED FREE / LIMITED TIME 50% OFF）与正式价混在同一列表中，长期看会削弱价格可信度（E1/E2）。

目前无法确认：
1. 控制台账单页与密钥页的真实信息层级与操作路径（页面 JS 渲染，抓取失败；E24）。
2. 限流分档（T1–T5）对应的具体 RPM/TPM 数值：文档用前端脚本按模型动态渲染，静态抓取不到表格内容（E12）。
3. 是否存在面向 API 的正式 SLA 与赔付条款：仅专用端点处出现 99.9%+ 的自述，法律条款正文未直接核实（E18/E25）。
4. 身份验证（Identity Verification）在什么条件下触发、需要哪些材料（E8/E5 仅提到该概念）。

## 7. 证据表

| 编号 | URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持的判断 |
|---|---|---|---|---|---|
| E1 | https://novita.ai/ | Novita AI – Model Libraries & GPU Cloud | 成功 | "Run 200+ models through a single API. No infrastructure to manage." / "Billed by the token, not the hour." | 四条产品线、按 token 计费定位、客户证言 |
| E2 | https://novita.ai/pricing | Pricing | 成功 | "Batch inference is available at an introductory 50% discount on input and output tokens for supported models." | 模型价目表、输入/输出/缓存读分列、批量折扣为促销 |
| E3 | https://novita.ai/models/model-detail/deepseek-deepseek-v4.1-flash | DeepSeek V4.1 Flash API & Playground | 成功 | "Input$0.3 / M Tokens" "Output$1.2 / M Tokens"；"Anthropic API Supported" | 单模型定价与能力标签、OpenAI 兼容代码 |
| E4 | https://novita.ai/llms.txt | Novita AI（文档索引） | 成功 | "OpenAI-Compatible Base URL: https://api.novita.ai/openai" | 文档全量目录、API/Guides 覆盖面 |
| E5 | https://docs.novita.ai/guides/quickstart.md | Quickstart | 成功 | "Sign in to novita.ai. You can use Google or GitHub authentication"；"Check your available credit" | 开户与首次调用路径、错误码排查入口 |
| E6 | https://docs.novita.ai/guides/llm-api-keys.md | API Keys | 成功 | "Each account can create up to 10 API keys."；"Permanent / 90 days / 30 days / 24 hours" | 密钥数量、有效期、只显示一次、OpenAPI 边界 |
| E7 | https://docs.novita.ai/guides/llm-billing.md | LLM API Billing | 成功 | "Total Cost = Input Tokens × Input Rate + Output Tokens × Output Rate"；499 "Charged: Yes" | 计费公式与状态码计费边界 |
| E8 | https://docs.novita.ai/guides/team.md | Team | 成功 | "you will not be able to downgrade"；"you can invite up to 200 members" | 团队升级、5 角色权限矩阵、审计日志 |
| E9 | https://docs.novita.ai/guides/budgets.md | Budgets | 成功 | "This feature is available for team accounts only."；"Both limits are enforced simultaneously" | 双层预算、预算类型与重置规则 |
| E10 | https://docs.novita.ai/guides/payment-methods.md | Payment Methods | 成功 | "Novita AI uses Stripe for all payment processing."；"must be greater than $10" | 支付渠道与最低充值额 |
| E11 | https://docs.novita.ai/guides/faq.md | FAQ | 成功 | "We accept credit card payments via Stripe. PayPal ... processed manually within 7 business days."；"book a call with our sales team" | 支付方式、退款政策、企业询价入口 |
| E12 | https://docs.novita.ai/guides/llm-rate-limits.md | Rate limits | 成功 | "T1: Monthly top-ups did not exceed $50 in any of the last 3 calendar months." | 限流按近 3 月充值额分 5 档；具体 RPM/TPM 为前端渲染 |
| E13 | https://docs.novita.ai/guides/llm-monitor.md | LLM Monitoring | 成功 | "Request Success Rate ... (non-5xx status codes)"；"Time to First Token (TTFT)" | 监控指标清单 |
| E14 | https://docs.novita.ai/guides/llm-playgrounds.md | Interactive Playground | 成功 | "max_tokens ... temperature ... top_p ... top_k ... min_p" | 在线试用支持参数与两种输出模式 |
| E15 | https://docs.novita.ai/guides/llm-model-access.md | Model Access for API Keys | 成功 | "the call returns HTTP 403 with the error code model_access_denied" | 密钥级模型访问策略与两种模式 |
| E16 | https://docs.novita.ai/guides/llm-dedicated-endpoint.md | Novita Deployments User Guide | 成功 | "Startup time varies with model size, typically 5–60 minutes"；"Per-second Billing" | 专用端点控制台流程、HF Token、LoRA、自动伸缩 |
| E17 | https://novita.ai/dedicated-endpoint | Dedicated Endpoint | 成功 | "NVIDIA H200 SXM 141 GB $2.99"；"Per-second billing on active replicas. Scale to zero, pay zero." | 专用端点 GPU 价与计费方式、enterprise support 表述 |
| E18 | https://docs.novita.ai/guides/dedicated-endpoint.md | Dedicated Endpoints | 成功 | "Guaranteed 99.9%+ uptime, with customizable SLAs"（厂商自述） | 企业级 SLA 自述与受监管行业定位 |
| E19 | https://docs.novita.ai/guides/sandbox-pricing.md | Pricing（Sandbox） | 成功 | "1 vCPU \$0.0000098/s"；"60 GB free per account, \$0.00009/GB/h" | 沙箱计费单位、$100 促销额度及其限制 |
| E20 | https://status.novita.ai/ | All services are online | 成功 | "Last updated on Sep 26, 2026 at 4:01am UTC"；"API Gateway 100% uptime" | 状态页可见可用性数据；未见 SLA 条款 |
| E21 | https://novita.ai/auth.md | Auth.md | 成功 | "Agents should register or request access by using the OAuth authorization code flow with PKCE." | 面向 agent 的 OAuth 接入与 scope 清单 |
| E22 | https://docs.novita.ai/guides/auto-top-up.md | Automatic Top-Up | 成功 | "automatically add credit if your balance falls below a specified threshold" | 自动充值能力存在 |
| E23 | https://mintcdn.com/novitaai/H3Kjvdvlhgt0Aohj/guides/images/Budges01.png | Budgets 截图（官方文档图片） | 成功（HTTP 200） | 图片资源，来自 docs/guides/budgets 正文 | 预算页存在官方截图；我方未登录核对 |
| E24 | https://novita.ai/billing | （未取得标题） | 失败 | 抓取器返回 "Page appears to be JavaScript-rendered" | 反证：控制台类页面无法用静态抓取核实 |
| E25 | https://novita.ai/legal/terms-of-service | Terms of Service | 未直接访问（仅搜索摘要） | 搜索摘要片段显示可能存在 "AS-IS" 免责与模型可随时下线类表述 | 法律条款正文未直接核实；仅可表述为搜索摘要显示该可能限制，不作事实依据 |
| E26 | https://novita.ai/enterprise 、/about-us 、/terms | — | 失败（404） | "The origin server says this page does not exist (HTTP 404)" | 仅证明这三个具体路径访问失败，不能推断企业采购页不存在；其他入口未充分核实 |

## 8. 反证与适用限制

- 搜索摘要显示法律条款中可能存在 "Model Availability" 可随时增删或下线模型、以及 "AS-IS / AS-AVAILABLE" 免责这类限制（E25）。**法律条款正文未直接核实**，上述表述仅为搜索摘要所见，不作为确定性条款；因此本报告不对目录规模承诺是否可被单方面下线下结论，仅提示该风险点待正文核实。
- 499（客户端断开）仍计费（E7），对不设 `max_tokens` 或超时过短的客户端是实际成本风险，迁移我们的用户时需前置提示。
- 限流档位由充值额决定（E12），意味着"低消费用户被限速"，这与部分中转站按套餐给固定额度的模型不同。
- 团队账号不可降级（E8），且预算功能仅团队可用（E9），个人用户无法使用预算控制。
- 状态页的高可用数字是第三方状态页展示（E20），不是合同 SLA；在已直接核实的页面中，SLA 表述仅见于专用端点页且为厂商自述（E18），法律条款正文未核实，不排除其他页面存在相关约定。
