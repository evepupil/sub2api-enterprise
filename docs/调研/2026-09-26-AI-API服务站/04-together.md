# 04 Together AI 调研（AI API 服务用户侧）

- 观察日期：2026-09-26（全部抓取均在当日完成，UTC+8 白天）
- 调研对象：https://www.together.ai 及其文档站 https://docs.together.ai、控制台 https://api.together.ai
- 抓取方式：HTTP 抓取（fetch_content 可读化 + Windows curl.exe 落盘原文）。本机浏览器不可用，**未渲染页面**，因此本报告只做信息结构与文案分析，不给像素/色值/视觉评分。
- 声明：未注册账号、未登录、未提交任何表单、未充值、未调用任何模型。所有"登录后"内容均标为「登录后未核实」。

## 1. 产品类型、谁在用、与 AI API 中转站的异同

产品类型：第一方模型托管 + 推理云（Serverless Inference / Batch / Provisioned Throughput / Dedicated Model / Dedicated Container）+ GPU 集群租赁 + 微调 + 代码执行沙箱。用户侧入口是一个 OpenAI 兼容 API（base_url `https://api.together.ai/v1`，文档另一处示例写 `https://api.together.xyz/v1`，两个域名并存，见 E2/E13）。

谁在用（页面自述的目标人群，均为厂商自述）：专业个人/独立开发者（注册即用、预付费、按 token 计费、有 Playground，E2/E3/E13）；小团队（项目为协作边界，可加协作者与外部协作者、按环境拆项目，E7）；企业（Contact Sales 走定制走查/Enterprise trial/定制定价，E11；Silver/Gold 支持档位带 P0 SLA，E10；ZDR、VPC、EU 区域，E8）。

与「AI API 中转站」相似处：
- 一把 key + OpenAI 兼容 base_url 就能接现有代码（E2、E13）。
- 模型目录按输入/输出单价列价，按 token 计费（E1）。
- 额度=预付余额，余额见底即停（E3）。

不同处（对重新设计有影响的）：
- 它是上游模型方，不是转售方：模型列表里含自家托管 + 三方模型，且同一模型有 serverless / batch / PTU / dedicated 四种交付方式与不同计价（E1、E9）。
- 完全预付费、**无免费试用**、最低 $5 起充（E3）——与很多中转站"注册送额度"的拉新模型相反。
- 没有按 key 的花费/速率上限：限额只在组织级（E4）。
- 速率限制是"动态"的、按模型、随近期成功流量增长，官方不公布固定阈值（E5）。

## 2. 导航/页面与功能表

状态口径：公开页面已核实 = 当日 HTTP 200 且我看到了正文；官方文档描述 = 官方文档写明但我未进入该界面；登录后未核实 = 需登录；未找到证据 = 当日未找到，不代表不支持。

| 模块 | 页面/入口 | 公开可见的内容 | 状态 |
|---|---|---|---|
| 发现与选型 | /models（E15） | 模型库，按 Chat/Image/Video/Code/Voice 分模态；Serverless 页有模型卡片与 "Free" 标记（E13） | 公开页面已核实 |
| 发现与选型 | /pricing（E1） | 价格总表，可切换「Price per 1M tokens / Batch API price」，含 LLM、图像、视频、语音、微调、GPU、沙箱 | 公开页面已核实 |
| 发现与选型 | whichllm.together.ai、chat.together.ai（E11 导航） | 选型助手与对话体验站 | 公开页面已核实（仅导航可见，未逐一访问） |
| 在线试用 | Playground（导航指向 https://api.together.ai/playground/） | 点击后 302 到 `/signin?redirectUrl=%2Fplayground`（E12） | 登录后未核实 |
| 在线试用 | 文档：Playground 识别账号下所有 API key，跨 key/项目展示可用模型（E4） | 说明 Playground 与 key/项目的关系 | 官方文档描述 |
| 开户与接入 | /signin（E12） | 三种登录：Continue with Google / GitHub / SSO；页面写明同意 privacy policy 与 terms | 公开页面已核实 |
| 开户与接入 | docs/quickstart（E2） | 4 步：注册→项目 API keys 页建 key→装 SDK（Python/TS）→首次调用；也可用 OpenAI SDK 或 REST | 公开页面已核实 |
| 密钥 | docs/api-keys-authentication（E4） | 项目级作用域；可设过期时间；仅创建时显示一次；支持轮换/吊销；legacy key 带 Deprecated 徽标且不可吊销只能重新生成 | 公开页面已核实 |
| 密钥 | 同上 | **无按 key 的花费上限或速率限制**，限制作用于组织级 | 公开页面已核实 |
| 用量与账单 | docs/billing-credits（E3） | 全预付费；最低 $5；余额为 0 即暂停 API；无免费试用；auto-recharge 按阈值+目标余额自动扣款；充值额度不过期 | 公开页面已核实 |
| 用量与账单 | docs/billing-payment-methods（E14） | 卡（Visa/Mastercard/Amex）+ ACH 银行转账；ACH 到账 1–3 工作日；ACH 为默认时 auto-recharge 不可用 | 公开页面已核实 |
| 用量与账单 | docs/billing-usage-limits（E6） | 组织级 cost analytics；可按产品/行项/项目(beta)/API key(beta) 分组；可切 $ 或 units；billing 页 Current Usage 看当月草稿账单 | 公开页面已核实 |
| 用量与账单 | docs/rate-limits（E5） | 动态限额；超额 429 + `x-ratelimit-reset`；低于动态速率时的失败返回 503（归因平台容量） | 公开页面已核实 |
| 团队 | docs/projects（E7） | 项目=协作边界；可见性 open/closed/private；默认项目全员可进且不可退出；项目 slug 会进入 dedicated 端点名；外部协作者需显式开启 | 公开页面已核实 |
| 团队 | docs/organizations、roles-permissions、SSO（E14 侧边导航） | 组织、RBAC、单点登录为文档条目 | 官方文档描述 |
| 安全/隐私/服务保障 | docs/zero-data-retention（E8） | ZDR 组织级开关，**默认关闭**；默认会存储 prompt 与输出并可能用于产品改进；训练用数据为独立 opt-in 且默认关；passthrough 模型默认允许 | 公开页面已核实 |
| 安全/隐私/服务保障 | trust.together.ai（E16） | 首页正文抓取失败（HTML 无可读内容），仅从 /provisioned-throughput 页面看到徽标：SOC 2 Type II、ISO 27001:2022、NVIDIA preferred partner | 公开页面已核实（徽标）/ 未找到证据（trust 站正文） |
| 服务保障 | /provisioned-throughput（E9） | PTU 承诺两条：Max normalized TPM、Availability 目标 99% 月度成功率；超额流量回落 serverless 且**不受 SLA 覆盖** | 公开页面已核实（厂商自述） |
| 支持 | /support（E10） | Standard（含于 Scale，PT 工作时间，P0–P4 best efforts）/ Silver（Enterprise，P0 1 小时、P1 4 小时、P2 8 小时、P3 2 天；Slack）/ Gold（合同额 10%，P0 24x7、TAM、优先队列）；Build 与 GPU 集群客户走 Discord | 公开页面已核实 |
| 企业入口 | /enterprise（实为 Contact Sales，E11） | 表单式销售入口：定制走查、Enterprise trial、定制套餐、自定义模型/方案；含 Salesforce 客户引述 | 公开页面已核实 |
| 未找到 | /playground、/security（E17） | 两个路径均 404 | 未找到证据 |

## 3. 用户任务路径（仅依据页面文案，未实际执行）

路径 A：从选型到第一次调用（证据：E2、E13、E4）
1. 在 /models 或 serverless 页按模态浏览模型，卡片标出模态标签与 "Free" 等标记（E13）。
2. 打开 quickstart，第 1 步"注册账号"→ 进入项目的 API keys 页（E2）。
3. 点 Create key、命名、可选设置过期日期，复制（只显示一次）（E2、E4）。
4. 设环境变量 `TOGETHER_API_KEY`，装 Python/TS SDK，或用 OpenAI SDK 指向 base_url，或直接 curl（E2）。
5. 发出第一个 chat completion（示例模型 MiniMax M3），可加 stream、system prompt、JSON schema、图片输入（E2）。
说明：以上均为文档步骤描述，我未注册、未创建 key、未发请求。

路径 B：开户充值与持续可用（证据：E12、E3、E14）
1. 登录页选 Google / GitHub / SSO（E12）。
2. 进 billing 设置，在 Credit balance 卡片点 Add credits，最低 $5，用默认支付方式支付（E3）。
3. 可选开启 auto-recharge：设"低于某余额触发"和"补到某余额"，按单笔交易补足（E3）。
4. 卡支付数分钟内到账；ACH 需 1–3 工作日清算；若默认方式为 ACH，则 auto-recharge 不可用（E3、E14）。
5. 余额到 0 → API 访问暂停，直到再次充值（E3）。
说明：未执行任何支付。

路径 C：团队协作与成本归因（证据：E7、E4、E6）
1. 组织内建项目（默认项目存在且全员可进、不可退出），选可见性 open/closed/private（E7）。
2. 在 Settings > Project > Collaborators 输入邮箱添加协作者，默认给 editor 角色（E7）。
3. 需要外部人员时先开启 Allow external collaborators（E7）。
4. 每个项目建自己的 key，key 只能访问本项目资源（E4）。
5. 在 cost analytics 里按 Project(beta) 或 API key(beta) 分组看花费与用量（E6）。
说明：均为文档描述，未进入控制台。另有限流自助排障路径：429 时读 `x-ratelimit-reset`、指数退避、摊平突发，或改走 dedicated/batch（E5）。

## 4. 收费样本（均为 2026-09-26 观察到的页面原文，币种按页面 "$" 记，页面未逐项标注 USD）

| # | 项目 | 原文价格 | 计价单位 | 输入/输出区别 | 适用条件 | 来源 |
|---|---|---|---|---|---|---|
| P1 | MiniMax M3 | $0.30（输入）/ $1.20（输出），cached $0.06 | 每 1M tokens | 有，输入与输出分开；另有缓存输入价 | Serverless 列表价；页面注明"Displayed prices refer to the lowest resolution/duration settings" | E1 |
| P2 | Kimi K3 | $3.00（输入）/ $15.00（输出），cached $0.30 | 每 1M tokens | 有 | 同上，Serverless 列表价 | E1 |
| P3 | Ternary Bonsai 27B | $0.00 / $0.00 | 每 1M tokens | 无区别 | 免费模型，serverless 卡片亦标 "Free" | E1、E13 |
| P4 | 账户门槛 | 最低 $5 充值；**无免费试用** | 一次性充值额 | 不适用 | 全预付费，余额为 0 停用；Scale/Enterprise 合同客户按原合同继续计费 | E3 |
| P5 | PTU 估算 | "Est. monthly cost $21 600"（10 PTUs） | 计算器输出 | 按 input/cached/output 三类 TPM/PTU 折算 | 页面明示按 24/7（约 43,800 分钟/月）连续预留估算，**是估算器默认输出而非公布单价** | E9 |
| P6 | GPU（仅作对比，注意有效期） | HGX H100 on-demand $3.99/GPU/小时，标注 "Promo Promotion valid until 09/30/26" | 每 GPU 每小时 | 不适用 | **促销价，不得当长期价**；同页 HGX B200 on-demand $8.19、H200 $5.99 | E1 |

未核实：Scale / Enterprise 的实际价格、PTU 单价（Price PTU/MIN）、支持档位 Silver/Gold 的实际成交价、企业折扣。页面明确写着 "Find the ideal custom plan and pricing" 需联系销售（E11），且 Gold 支持标价 "10% of contract"（E10），比例已核实但合同额未核实。

## 5. 界面证据

可确认存在的**官方图片 URL**（官网页面内嵌，HTTP 200，2026-09-26 核验）：
- https://cdn.prod.website-files.com/69654e88dce9154b5f1206dd/69f2267b1fdeb2e4b237411a_hero-serverless-2026-04-29.avif —— /serverless-inference 首屏（E13）。未渲染，无法确认画面内容。
- https://cdn.prod.website-files.com/69654e88dce9154b5f1206dd/6a42bd48f7e69e5b82f181df_provisioned-throughput_hero.avif —— /provisioned-throughput 首屏（E9）。其 alt 文本为 "Together AI interface showing MiniMax M3 model details, code snippet, pricing, and endpoints status offline."，即官方自述该界面含模型详情、代码片段、定价、端点状态。
- https://cdn.prod.website-files.com/69654e88dce9154b5f1206dd/69a49f8c704175852f725145_og-pricing.jpg —— pricing 页 OG 分享图，不含可用界面信息。
- /provisioned-throughput 另有三张图解 avif（Capacity Pool / Reservation Card / Lane Diagram，E9），从文件名看是概念示意图而非控制台截图。

界面结论：以上均为**公开静态图片**，不是登录态截图，也不是我的登录操作结果。Playground 与控制台我**没有看到任何界面**——所有 api.together.ai 路径都重定向到 signin（E12）。因此控制台信息结构只能引用文档写明的控件名：billing 的 Credit balance 卡片与 Add credits、Auto-recharge 面板的 Set thresholds/Edit limits（E3）；Settings > Project > Collaborators 的 Add Collaborator（E7）；cost analytics 的 Measure/Group by/Filter/Time range（E6）；API keys 页的 Create API Key 与三点菜单（E4）。这些是**文案级结构**，不含布局、间距、色彩，不做视觉评分。

## 6. 建议

可借鉴：
1. 把"最小可跑通"写成 4 步并给可复制代码：注册→建 key→装 SDK→首请求，同页并列 SDK / OpenAI SDK / REST 三种接入（E2）。
2. 密钥页把安全语义写进 UI 文案：只显示一次、可设过期、可吊销、可轮换、legacy key 打 Deprecated 徽标（E4）。
3. 价格表按**计量单位分组**（每 1M tokens / 每张图 / 每音频分钟 / 每视频 / 每 GPU 小时 / 每 GiB 月），并明确输入与输出分列 + 缓存价（E1）。
4. 账单侧提供草稿账单入口（billing 页 Current Usage）与按项目/API key 归因的用量图（E6）。

不宜直接照搬：
1. **无免费试用 + 最低 $5 预付费**（E3）是上游模型方的选择；中转站照搬会显著抬高注册转化门槛。
2. **没有按 key 的额度/速率上限**（E4）在多租户转售下风险很高：一把泄露的 key 可直接烧光余额，Together 自己也把该风险写进了提示。
3. 动态、不公布固定阈值的速率限制（E5）让用户拿不到可规划的容量数字；中转站若卖确定性，应反过来提供可见配额。
4. GPU 集群、PTU、Dedicated Container、微调训练（E1、E9）属重型交付，不在本项目范围，照搬会稀释"API 中转"叙事。

目前无法确认：
1. Playground 的实际交互（模型选择器、参数面板、模态切换、是否出代码片段）——登录后未核实（E12）。
2. 控制台密钥创建、充值、auto-recharge、协作者管理、cost analytics 的真实界面与可用性——登录后未核实，仅有文档文案（E3/E4/E6/E7）。
3. trust.together.ai 合规正文（SOC 2 Type II / ISO 27001 范围、报告获取方式、赔付细节）——正文抓取失败（E16），仅见产品页徽标。
4. 团队/企业分层是否仍在售：/support 仍以 Scale/Enterprise 命名档位（E10），文档却写这些 tier 标签已退役（E6），无法定论。
5. 发票/对公、除卡与 ACH 之外的支付方式在中国大陆场景的可用性——未找到证据。

## 7. 证据表

| 编号 | URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持的判断 |
|---|---|---|---|---|---|
| E1 | https://www.together.ai/pricing | Pricing \| Together AI | 成功 200 | "Price per 1M tokens … MiniMax M3 $0.30 $1.20 … Displayed prices refer to the lowest resolution/duration settings." | 价格表结构与 P1/P2/P3/P6 |
| E2 | https://docs.together.ai/docs/quickstart | Quickstart - Together AI docs | 成功 200 | "Select Create key, give it a name, and copy the value. New keys are only shown once." | 4 步接入路径；OpenAI 兼容 base_url |
| E3 | https://docs.together.ai/docs/billing-credits | Credits - Together AI docs | 成功 200 | "Together AI does not currently offer free trials. Access … requires a minimum $5 credit purchase. Together AI is fully prepaid." | 预付费门槛、无试用、auto-recharge |
| E4 | https://docs.together.ai/docs/api-keys-authentication | Authentication - Together AI docs | 成功 200 | "No per-key usage limits: You can't cap spend or rate-limit individual API keys. Usage limits apply at the organization level." | 密钥作用域与风险；Playground 识别所有 key |
| E5 | https://docs.together.ai/docs/rate-limits | Rate limits - Together AI docs | 成功 200 | "Together uses dynamic rate limits instead of fixed thresholds … Requests at or below your dynamic rate return 503." | 动态限流机制与自助处置 |
| E6 | https://docs.together.ai/docs/billing-usage-limits | Usage limits & analytics | 成功 200 | "Build Tiers (Build Tier 1–5), Scale, and Enterprise tier labels have been retired." / "Group by API key (beta)" | 用量分析能力；与 E10 口径冲突（反证） |
| E7 | https://docs.together.ai/docs/projects | Projects - Together AI docs | 成功 200 | "A project is an isolated workspace … Collaborators of project A cannot see or access anything in project B." | 团队/项目模型与外部协作者 |
| E8 | https://docs.together.ai/docs/zero-data-retention | Zero data retention - Together AI docs | 成功 200 | "ZDR is not enabled by default … Together stores the prompts you send and the responses models return, and may use them for product improvements." | 隐私默认值（反证：默认非零保留） |
| E9 | https://www.together.ai/provisioned-throughput | Provisioned Throughput \| Together AI | 成功 200 | "Together targets a 99% monthly success rate for eligible requests." / "SLAs do not apply to overage traffic." | PTU 与可用性承诺（厂商自述）、P5 估算器 |
| E10 | https://www.together.ai/support | Support \| Together AI | 成功 200 | "Silver … P0: 1 hour P1: 4 hours … Gold … 10% of contract" | 支持档位与响应 SLA |
| E11 | https://www.together.ai/enterprise | Contact Sales \| Together AI | 成功 200 | "Find the ideal custom plan and pricing" / "Get started with your Enterprise trial" | 企业入口为销售表单；企业价不公开 |
| E12 | https://api.together.ai/signin?redirectUrl=%2Fplayground | Sign In · Together AI | 成功 200（302 自 /playground/） | "Choose a sign-in option Continue with Google Continue with GitHub Continue with SSO" | 登录方式；Playground 需登录（未核实） |
| E13 | https://www.together.ai/serverless-inference | Serverless Inference \| Together AI | 成功 200 | "Access all the top open-source models in one place." / 模型卡片标 "Free" | 发现/选型入口；首屏图 URL |
| E14 | https://docs.together.ai/docs/billing-payment-methods | Payment methods & invoices | 成功 200 | "Credit and debit cards … ACH bank transfers" | 支付方式与到账时延 |
| E15 | https://www.together.ai/models | Build with leading AI models \| Together AI | 成功 200 | 模型库页面标题与模态分类 | 模型目录存在（未逐条核对） |
| E16 | https://trust.together.ai/ | （标题未能取得） | **失败**：可读内容抽取报错 | HTML 无可读正文；仅在 /provisioned-throughput 见 "SOC 2 Type II"、"ISO 27001:2022" 徽标 | 合规正文未核实（反证/限制） |
| E17 | https://www.together.ai/playground ；https://www.together.ai/security | Page not found | 200 但为 404 页 | "Page not found" | 这两个路径不存在；真实入口在 api.together.ai |
| E18 | https://docs.together.ai/docs/billing | Overview - Together AI docs | 成功 200（重定向至 Credits 内容） | 与 E3 同文 | 说明 docs/billing 已指向 Credits 页 |

反证与适用限制（至少一条）：
- **默认不保护隐私**：ZDR 默认关闭，prompt 与输出会被存储且"可能用于产品改进"（E8）。任何"企业级隐私"的视觉叙事都必须配这个默认值说明，否则是误导。
- **SLA 有边界**：99% 月度成功率只覆盖"合约容量内、走 PTU 端点、标准产品限制内"的请求；超额流量回落 serverless 且明确不在 SLA 内（E9）。
- **分层口径自相矛盾**：支持页仍按 Scale/Enterprise 命名档位（E10），文档称这些 tier 标签已退役（E6）。引用任一单页都可能过时。
- **价格页自带的免责**："Displayed prices refer to the lowest resolution/duration settings. Actual prices might vary."（E1）——图像/视频/音频单价尤其不能当固定价；P6 的 H100 $3.99 标注促销至 09/30/26，不可当长期价。

## 8. 抓取与访问情况

成功访问 17 个 URL（200 且正文可读，E1–E15、E17、E18）。失败 1 个（E16 trust.together.ai 正文抽取失败）。阻碍：本机浏览器不可用，控制台/Playground 全部不可见；api.together.ai 一律重定向 signin；docs 的 Playground 专门页 404。原始素材落盘 `.fleet\evidence\together\`（pricing.html、quickstart.html、billing-credits.html、apikeys.html、usage-limits.html、zero-data-retention.html、paymethods.html、signin.html、trust.html、llms.txt 等）。

---

SUMMARY: 收了 Together AI 官网/文档 17 个可读页面，整理为 18 条证据（E1–E18）、6 条确切收费样本（P1–P6，其中 P6 为促销价已标注）、4 条用户任务路径、3 个官方图片 URL。所有事实均附页面出处，无凭记忆内容。
FILES: 只写了 C:\code\sub2api-enterprise\docs\调研\2026-09-26-AI-API服务站\04-together.md；原始素材存 C:\code\sub2api-enterprise\.fleet\evidence\together\。未改动其他任何文件。
VERIFY: 用 curl.exe 对每个引用 URL 记录 HTTP 状态码（全部 200，E16 正文抽取失败、E17 为 404 页、E12 为 signin 重定向），并把 HTML 原文落盘到 evidence 目录后本地去标签复核引文；报告内的价格与引文均可在对应 .html 中直接检索到。未运行代码、未启动服务、未做 git 写操作。
SELF_REPORT: pass
BLOCKED: (1) Playground 与控制台全部界面登录后未核实，仅有文档文案；(2) trust.together.ai 合规正文抓取失败，SOC 2/ISO 27001 仅见产品页徽标；(3) Scale/Enterprise 实际价格、PTU 单价、Silver/Gold 成交价未公开，只能写未核实；(4) /support 与 docs 关于 tier 是否退役口径冲突，无法定论；(5) 无任何登录态截图，官方图片仅能标为"官方静态图"，未渲染不能描述画面。
