# DeepInfra 调研（AI API 服务站 · 第 06 路）

## 1. 基本信息

- 观察日期：2026-09-26（本机时间 11:59–12:05，UTC+8）
- 产品类型：厂商自述为「AI inference cloud」（推理云），三条线并存：①无服务器按量推理 API（OpenAI 兼容）②私有/自建模型专用 GPU 部署（Custom LLM）③GPU 实例与集群租用（SSH 容器、DeepCluster）。见 E1、E4、E9。
- 谁在用（页面自述的用法，非访谈结论）：开发者与工程团队（「Make your first API call in 60 seconds」E5）、需要数据隔离/自有权重的合规团队（E4、E14）、需要训练算力的团队（GPU 实例 E9）、初创（DeepStart 计划 E16）。
- 与 AI API 中转站的相似处：同为多模型统一入口、统一 base_url + API key、按 token 计费、有余额/用量/密钥面板、有团队与限流概念（E5、E6、E15、E18、E19）。
- 与中转站的不同处：①是模型托管方（自有 H100/A100/B200 机房与机房清单），不是纯转售路由，模型页带 ZDR/量化/上下文等托管属性标签（E2、E11）；②同时卖 GPU 小时与专用实例，客单价结构完全不同（E9、E10）；③对 Google/Anthropic 等合作模型明确标注「partner，请求转发给对方，适用对方隐私政策」（E11），即站内也存在「非自托管」这一层。

## 2. 导航 / 页面与功能表

状态口径：「公开页面已核实」= 我实际抓到页面文本；「官方文档描述」= 官方 docs 页文字；「登录后未核实」= 页面存在但内容需登录；「未找到证据」= 本轮未找到，不等于不支持。

| 域 | 页面/入口 | 功能与信息 | 状态 | 证据 |
|---|---|---|---|---|
| 发现与选型 | `/models`、按 10 个类别（ASR、Embeddings、Reranker、Text Generation、Text→Image/Music/Speech/Video、World Model、Zero-shot 分类）、按 9 个模型家族（Claude/DeepSeek/Flux/Gemini/Kimi/Llama/Mistral/Nemotron/Qwen） | 目录可双维度切分；卡片直接给「in / out / cached 每 1M」价、上下文（如 1024k）、ZDR 标签、量化、折扣角标 | 公开页面已核实 | E1、E2、E12 |
| 发现与选型 | 单模型页（如 `/moonshotai/Kimi-K3`） | 顶部即价格条「$2.85 in / $14.25 out / $0.285 cached / 1M tokens」+ Prompt cache retention 明细；正文是模型 README（架构、参数、评测表）；页签含 Demo / API；另有 Compare 页可并排两个模型对话 | 公开页面已核实 | E11、E12、E17 |
| 发现与选型 | `/compare` | 并排两个模型 + 对话对比 | 公开页面已核实（页面文本仅见模型卡与「You need to log in to use this model」） | E17 |
| 开户与接入 | `/login`、`/signup`、`/login_sso` | Google / GitHub / 邮箱密码 / Corporate SSO（Okta OIDC）；Google、GitHub、SSO 首次登录自动建号；邮箱注册需验证 | 官方文档描述 | E6 |
| 开户与接入 | `/docs/quickstart` | 三步：取 key → 改 base_url 为 `https://api.deepinfra.com/v1/openai` → 选 model；官方称 OpenAI Python/Node SDK 开箱可用 | 官方文档描述 | E5 |
| 开户与接入 | 模型页 API 页签 | 代码示例分栏：HTTP/cURL、deepctl CLI、JavaScript SDK、OpenAI 兼容 HTTP、OpenAI python client、AI SDK | 公开页面已核实（示例栏位名与文案在页面 JSON 中） | E12 |
| 快速试用 | 模型页 Demo 页签 / `/chat` | 网页内直接推理，含输入框、参数设置、Service tier 选择、输出耗时与费用显示；未登录提示「You need to log in to use this model」 | 登录后未核实（面板文案已核实，实际输出未验证） | E12、E13 |
| 密钥 | Dashboard → Keys / API Keys / SSH Keys | 新建 key（弹窗提示只显示一次）、命名、删除、导出到 Vercel；文档另述 Scoped JWT：限定模型、有效期最长 1 年、消费上限，用量记在签发它的 key 上 | 公开页面已核实（面板文案）+ 官方文档描述（JWT 规则） | E13、E15 |
| 用量与账单 | Dashboard → Usage、Billing | 按模型列出 type / rate / spend / total，区分 Priority、Flex、Batch、Hosted Agent、Bare Metal、Discount 分项；余额制（需正余额）、Stripe 存卡、最低充值 $5.00、自动充值阈值、账单地址与税、月度用量上限 | 公开页面已核实（面板文案） | E13、E19 |
| 团队 | Dashboard → Account → Team；Okta SSO | 成员表（User/Role/Status/Date）、邀请、改角色（member/admin）、移除、2FA；admin 可进 billing；成员共享同一批 API token 与模型；按人隔离需联系官方 | 公开页面已核实（面板文案）+ 官方文档描述 | E13、E7 |
| 安全/隐私 | `/privacy`、`/docs/account/data-privacy`、`/terms`、Trust Center、Status | 输入不落盘、输出不回存、不用客户数据训练、不向第三方共享；例外：Google/Anthropic 模型由对方按其政策存储；批量推理 API 可能加密落盘一段时间；日志只记元数据 | 公开页面已核实（ToS、隐私页）；Trust Center 页面抓取 403，未核实 | E3、E8、E10、E14、E20 |
| 服务保障 | `/terms`、`/status` | ToS 全文检索 "SLA"、"uptime" 均无命中（"ZDR" 亦无，但 "Zero Data Retention" 有，见 7(b) 条）；未找到可用性赔付承诺。状态页按天着色显示历史可用性，并区分「badge 按近 1 小时」与「checks failing now 为当前探针」 | 公开页面已核实（未找到 SLA 证据） | E20、E3 |
| 支持 | Contact Sales、feedback@deepinfra.com、Discord、Blog、Docs 侧栏 Support | 销售入口、邮件、社区、技术博客（更新频繁，9 月内多篇） | 公开页面已核实 | E1、E4、E18 |
| 限流 | `/docs/account/rate-limits` | 默认每模型 200 并发请求（两个模型即 400），非 RPM 限制；超限返回 HTTP 429；可在 Account 申请提额 | 官方文档描述 | E15 |

## 3. 用户任务路径（每步标注证据所在）

路径 A：专业个人从「找模型」到「第一次调用」
1. 进 `/models`，按类别或家族缩小范围，卡片上直接读到价格与上下文（E1、E2）。
2. 点进单模型页，顶部价格条 + 缓存写入价 + 缓存块粒度（E11）。
3. 在 API 页签选语言（cURL / Python / JS / OpenAI 兼容）复制示例（E12）。
4. 去 `/docs/quickstart` 三步接入，改 base_url 与 model 名（E5）。
5. 在 Dashboard → API Keys 建 key，弹窗提示「只显示一次」（E13）。
6. 想先试再付：模型页 Demo 页签/`/chat` 可直接对话，但页面文案要求登录（E12、E13）。
说明：全程未注册、未充值、未真实调用，以上均为页面/文档文本。

路径 B：小团队开通与费用控制
1. 用 Google/GitHub/邮箱注册或走 Okta SSO（E6、E7）。
2. 在 Billing 加卡或充值（最低 $5.00），必要时开自动充值；设月度用量上限与账单地址（E13、E19）。
3. 为每个用途建独立 key，并给 key 设月度消费上限（E13）。
4. 对第三方/外包发放 Scoped JWT：限定模型白名单 + 到期时间 + 消费上限（E15）。
5. Team 页邀请成员、设 member/admin；注意官方写明「所有成员共享同一批 API token 与模型」（E7）。
6. 用 Usage 页按模型/档位对账（E13）。
说明：以上未执行任何注册或支付动作。

路径 C：企业评估合规与保障
1. 读 `/privacy` 与 `/docs/account/data-privacy` 判断数据是否落盘、是否训练（E8、E10）。
2. 读 ToS 第 7(b) 条确认 Zero Data Retention 承诺及其例外（E3）。
3. 检查模型页标签：ZDR / Partner（转发第三方）/ Private，用来区分自托管与合作模型（E11、E2）。
4. 看 Trust Center 与页脚 SOC 2 / ISO 27001 徽标（E1、E4）。
5. 找 SLA：ToS 无 SLA 条款命中，状态页只给历史可用性与当前探针，未找到赔付承诺（E3、E20）。
6. 需要隔离则转向私有部署（E4、E14）。

## 4. 收费样本（币种均为 USD，页面标注「*State and local taxes may apply.」）

| # | 模型/项目 | 价格 | 计价单位 | 输入/输出区别 | 适用条件 | 来源 | 观察日期 |
|---|---|---|---|---|---|---|---|
| P1 | `moonshotai/Kimi-K3` | $2.85 输入 / $14.25 输出 / $0.285 缓存输入 | 每 1M tokens | 输入与输出分开计价，缓存输入另计 | 上下文 1,048,576；缓存写入另收：保留 5 分钟按 1.25×（$3.5625）、保留 1 小时按 2×（$5.70）；缓存以 1,536 token 整块保留 | E11、E12 | 2026-09-26 |
| P2 | `Qwen/Qwen3-TTS`（及 VoiceDesign 变体） | $20.00 | 每 1M characters（按字符，非 token） | 语音合成无输入/输出区分，按输入文本字符数 | 页面标 ZDR；语音类另按「每分钟音频输入」计价的模型也存在（Voxtral-Small-24B-2507 $0.00300/分钟） | E2、E12 | 2026-09-26 |
| P3 | 图像生成 `FLUX-2-pro` | $0.015 | 每张图 | 无 | 同族另有按公式计价者，如 `FLUX-2-dev` = $0.01 ×(w/1024)×(h/1024)×(iters/28)，即尺寸与步数都会改变单价 | E12 | 2026-09-26 |
| P4（附） | 服务档位 | Standard 1× / Priority 1.5× / Flex 0.8× | 基础价倍数 | — | Flex 为「非生产/异步」，模型繁忙时最多等 10 分钟或返回 429；可用档位按模型不同；不支持所请求档位时不报错，按标准档与标准价服务 | E12、E18 | 2026-09-26 |

限制说明：站内多处出现 `% off` 角标与「Limited-time promotion」（E12），上述 P1–P3 均为页面常规列表价，未取折扣价；P4 是价目倍数不是绝对价。GPU 小时价（A100 $0.89 → B300 $4.89 / GPU-hour，B200 实例 $3.69/小时）与按小时计的私有部署不在上表，避免与 token 价混淆（E9、E10、E12）。

## 5. 界面证据

- 本轮未找到任何官方产品界面截图（Dashboard / 模型页 / 定价页的 UI 截图）。各页 `og:image` 统一为同一张品牌图 `https://deepinfra.com/open-graph.png`（E1、E2、E12、E13），属社交分享图，不是产品界面。
- 存在官方 `/media-center` 页，自述提供「Brand Assets & Logos」「Media FAQ」等资源，但该页正文中可提取到的图片 URL 只有 open-graph 图与页脚 SOC 2 / ISO 27001 徽标（E4）。
- 页脚徽标图片为第三方托管：`https://static.sprinto.com/_next/static/images/framework/soc2.png`、`.../iso-27001.png`（E1、E4）。属厂商自述的认证展示，未在独立审计方页面核实。
- 因此本报告只做信息结构与文案分析，不给像素、色值或视觉评分；未渲染页面，不描述布局观感。本机浏览器连接不可用，全部结论来自 HTTP 抓取的 HTML/文档文本。

## 6. 建议

可借鉴（建议）
1. 模型卡片把「输入价 / 输出价 / 缓存价 / 上下文 / 数据留存标签」压成一行短串（如 `$0.285 cached, $2.85 in, $14.25 out / 1M`），专业用户扫一眼即可筛掉候选（E1、E2）。
2. 单模型页顶部固定价格条 + 页签式结构（Demo / API），把「试用」和「接入」放在同一页，减少跳转（E11、E12）。
3. 计费档位显式化成「Standard 1× / Priority 1.5× / Flex 0.8×」并注明 Flex 的代价（更慢、可能 429），把不确定性写进价格表而不是藏在文档里（E12、E18）。
4. 密钥分级：普通 API key 之外提供可限定模型、到期时间、消费上限的临时 token，适合发给外部协作者（E15）。

不宜直接照搬（建议）
1. 多业务线并列（serverless API + 私有部署 + GPU 实例 + 集群 + 托管 Agent + Sandbox）会让主导航与 Dashboard 侧栏变长，专业个人容易迷失；若目标客户含专业个人，需先裁层级（E1、E13）。
2. 「登录才能试用」的门槛：模型 Demo 面板文案为「You need to log in to use this model」，对自助评估是摩擦；可考虑有限免费额度代替强制登录（E13）。
3. 缓存计价的复杂度（5m/1h 两档写入价 + 1,536 token 整块粒度）对非重度用户理解成本高，需要额外解释层（E11）。
4. 团队模型写明「所有成员共享同一批 API token 与模型」，按人隔离要联系官方；面向小团队的企业向设计不宜默认这种共享态（E7）。

目前无法确认
1. 是否有可用性 SLA 与赔付：ToS 全文未见 SLA/uptime 条款，状态页只有历史与当前探针；不能反推「不支持」（E3、E20）。
2. 官方宣称的 SOC 2 / ISO 27001 是否覆盖全部业务线、审计范围与有效期（E1、E4）；Trust Center 抓取返回 HTTP 403（E8 备注）。
3. 「ZDR / Zero Data Retention」在 ToS 中的承诺与文档页列出的例外（Google/Anthropic 模型、批量 API 加密落盘、支持排障留 30 天）之间的实际边界（E3、E10）。
4. 价格与模型目录更新频率极高（页面上同时出现多个 2026 年新模型与折扣角标），本轮数字只代表 2026-09-26 抓取时点（E1、E12）。

## 7. 证据表

| 编号 | 完整 URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持判断 |
|---|---|---|---|---|---|
| E1 | https://deepinfra.com/ | Machine Learning Models and Infrastructure \| DeepInfra | 成功 | 「100s of open-source models, private GPU deployments, and GPU rental」；页脚含 SOC 2 / ISO 27001 徽标与 Trust Center、Status 链接 | 产品类型、导航、认证自述 |
| E2 | https://deepinfra.com/models | Models \| Machine Learning Inference \| DeepInfra | 成功 | 「$0.285 cached, $2.85 in, $14.25 out / 1M」；卡片含 ZDR、fp8、1024k 标签 | 目录信息密度、标签体系 |
| E3 | https://deepinfra.com/terms | DeepInfra Terms of Service | 成功 | 「Provider will not retain, store, or log any Customer Data … ("Zero Data Retention")」；检索 SLA / uptime 无命中 | ZDR 承诺、SLA 未找到 |
| E4 | https://deepinfra.com/media-center | Media Center \| Press & Brand Assets \| DeepInfra | 成功 | 「Brand Assets & Logos」「press@deepinfra.com」；正文图片仅 open-graph 与认证徽标 | 官方素材入口、无产品截图 |
| E5 | https://docs.deepinfra.com/quickstart | Quickstart - DeepInfra | 成功 | 「Make your first API call in 60 seconds — no installation required」；base URL `https://api.deepinfra.com/v1/openai` | 接入路径 |
| E6 | https://docs.deepinfra.com/account/signing-in | Signing In - DeepInfra | 成功 | 「sign in … with Google, GitHub, email & password, or Corporate SSO」 | 开户方式 |
| E7 | https://docs.deepinfra.com/account/okta-sso | Okta SSO - DeepInfra | 成功 | 「All team members share the same API tokens and models」；「For per-user isolation … contact us」 | 团队模型与其限制 |
| E8 | https://docs.deepinfra.com/account/data-privacy | Data Privacy - DeepInfra | 成功 | 「Input data is not stored to disk」「We do not train on your data」；例外为 Google/Anthropic 模型 | 隐私口径与例外 |
| E9 | https://deepinfra.com/gpu-instances | GPU Instances \| Machine Learning Infrastructure \| DeepInfra | 成功 | 「1x NVIDIA B200 … $3.69/hour」；「Pay by the minute with no egress fees」 | GPU 实例线计价 |
| E10 | https://docs.deepinfra.com/private-models/custom-llms | Custom LLMs - DeepInfra | 成功 | 「Billed per GPU-hour, not per token」；「4 GPU limit per user」「Quantization is not currently supported」 | 私有部署与其限制 |
| E11 | https://deepinfra.com/moonshotai/Kimi-K3 | Kimi K3 API - Demo - DeepInfra | 成功 | 页内 JSON：`cents_per_input_token:0.000285`、`explicit_cache_write_token:{"5m":1.25,"1h":2}`、`explicit_cache_granularity_tokens:1536` | 精确价格与缓存规则 |
| E12 | https://deepinfra.com/pricing | Simple Pricing \| Machine Learning Infrastructure \| DeepInfra | 成功 | 「Standard 1x base price / Priority 1.5x / Flex 0.8x」；「$20.00 per 1M characters」；FLUX 公式价 | 计价单位、档位、折扣角标 |
| E13 | https://deepinfra.com/dash/api_keys | Dashboard - DeepInfra | 成功（仅页面骨架与文案，未登录） | 侧栏含 Keys / Usage / Billing / Team / Rate Limits；「You need to log in to use this model」；「Minimum $5.00」 | Dashboard 信息架构、登录门槛 |
| E14 | https://docs.deepinfra.com/account/authentication | Authentication - DeepInfra | 成功 | 「Scoped JWTs — short-lived, scope-limited tokens」；可按模型、到期（≤1 年）、消费上限限制 | 密钥分级能力 |
| E15 | https://docs.deepinfra.com/account/rate-limits | Rate Limits - DeepInfra | 成功 | 「default limit of 200 concurrent requests per model」；「HTTP 429 with a `Rate limited` message」 | 限流口径 |
| E16 | https://deepinfra.com/deepstart | DeepStart \| Production-Ready Machine Learning Models \| DeepInfra | 成功 | 页面 JSON：「Have raised between 250K and 10M USD」「Founded in the last 2 years」 | 初创计划准入条件 |
| E17 | https://deepinfra.com/compare | Compare LLM models | 成功 | 并排模型卡 + 「You need to log in to use this model」 | 选型对比入口 |
| E18 | https://docs.deepinfra.com/chat/overview | Chat Completions - DeepInfra | 成功 | 「Flex … a flex request may wait up to 10 minutes … or is rejected with an HTTP 429」；`fail_fast` 参数 | 档位代价与降级行为 |
| E19 | https://docs.deepinfra.com/api-reference/billing/usage | Usage - DeepInfra | 成功 | 返回体含 `months[].items[]`：model、units、rate、cost、pricing_type、discount、total_cost、invoice_id | 用量可按月/按模型以编程方式对账 |
| E20 | https://status.deepinfra.com/ | DeepInfra Status | 成功 | 「Each bar is one day … colored by how much of that day was lost」；「'Checks failing now' is faster than the badge beside it」 | 状态页口径，无赔付承诺 |
| E21（反证/限制） | https://deepinfra.com/blog | Blog \| Fast & Reliable AI Inference \| DeepInfra | 成功 | 「Model Deprecation: … Your model ID is the shortest-lived dependency in your stack」；「Token Verbosity Is the New Pricing War」 | 厂商自述承认模型下线与「便宜 token ≠ 便宜任务」；且官方文档写明弃用仅提前 1 周通知 |

补充反证/适用限制（不只列优点）
- 官方文档自述弃用规则：至少提前 1 周通知，弃用后请求自动转发到替代模型（https://docs.deepinfra.com/models，2026-09-26）——即模型 ID 稳定性弱，接口「不报错」但结果可能已换模型。
- 博客自述「Cheaper tokens do not necessarily translate to lower per-task cost」（E21），即页面上的 token 单价不能直接当任务成本比较。
- 访问阻碍：`https://trust.deepinfra.com/` 返回 HTTP 403，无法核实认证范围；`https://docs.deepinfra.com/account/billing` 返回 404；`/sla`、`/security` 未取到页面。curl.exe 直连 deepinfra.com 报 exit 35（TLS 层失败），改用 Python urllib 成功。
