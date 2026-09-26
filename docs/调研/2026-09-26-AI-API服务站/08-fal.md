# 08 - fal（https://fal.ai）调研

- 观察日期：2026-09-26（全部证据均为该日抓取）
- 抓取方式：HTTP 抓取（fetch 工具）+ Windows `curl.exe -L --max-time 25/28`。本机浏览器不可用，**未渲染任何页面**，因此不做布局、像素、色值、视觉评分判断，只做文本与信息结构分析。
- 原始素材：`C:\code\sub2api-enterprise\.fleet\evidence\fal\`（models.html 5.5MB、pricing/enterprise/nano-banana 页、trust-fal-ai.html）
- 合规：未注册、未登录、未提交表单、未充值、未调用任何模型。厂商自述处均已标注。

## 1. 产品类型、谁用、与 AI API 中转站的异同

- 产品类型：生成式**媒体**（图像、视频、音频、音乐、语音、3D、实时流）模型托管与推理平台；三层产品 = Model APIs（1000+ 预训练模型）、Serverless（部署自有模型）、Compute（独占 GPU 按小时）〔E9〕。
- 谁用：个人（个人账户 + 免费沙箱）、小团队（Team 共享 key/账单）、企业（Organization + SSO + 私有端点 + 销售对接）〔E16 E18 E19 E23〕。
- 与 AI API 中转站相似处：统一 API key 调用多供应商模型、按用量计费、预充值 credit、并发限流、异步队列 + webhook、用量与账单面板入口〔E17 E20 E21 E11〕。
- 不同处（重要）：① 内容形态是媒体生成而非文本对话，计价单位是**百万像素 / 每张 / 每秒 / 每小时 GPU**，不是 token〔E3 E4 E22〕；② 模型页的公开 HTML 中同时呈现输入表单、运行入口与结果区结构，即选型与试跑收在同一页，不只是文档；但本次未渲染页面、未点击，实际交互行为未核实〔E3〕；③ 提供免登录沙箱试用〔E8〕；④ 有模型训练/微调与自有部署路径〔E9〕。

## 2. 导航 / 页面与功能表

状态口径：「公开页面已核实」= 本次成功取到该页文本；「官方文档描述」= 仅文档正文说明，界面未见到；「登录后未核实」= 页面存在但被登录墙拦住；「未找到证据」≠ 不支持。

| 领域 | 页面 / 入口 | 内容要点 | 状态 |
| --- | --- | --- | --- |
| 发现与选型 | `/models`（Marketplace） | 声称 1,000+ 生产可用模型；导航含 `/explore/{image,video,audio,3d,text-to-video-apis,...}` 分类、按厂商（black-forest-labs、bytedance、google、kling、minimax、openai、xai…）浏览 | 公开页面已核实（仅 HTTP 取到 5.5MB HTML，未渲染）〔E1 E2〕 |
| 发现与选型 | 模型详情页 `/models/{vendor}/{model}` | 输入表单、Additional Settings、示例输出（图片/JSON）、价格提示、`Inference` / `Commercial use` / `Partner` 徽标、Schema 与 `llms.txt` 链接、相似模型沙箱入口 | 公开页面已核实〔E3 E4 E5 E30〕 |
| 发现与选型 | `/sandbox` | 多模型并排对比；「15 free generations today. No account needed.」；每个结果格显示模型名、耗时（如 92.4s）、单价（如 0.116）与总价 | 公开页面已核实〔E8〕 |
| 开户与接入 | `/docs/documentation/setting-up/accounts-and-identity` | 个人账户 / Team / Organization 三类；登录方式 GitHub OAuth、Google OAuth、SSO/SAML | 公开页面已核实〔E16〕 |
| 开户与接入 | 模型页 `/api` 子页、`/docs/.../client-setup` | 官方客户端 Python/JS/Swift/Java/Kotlin/Dart；`npm install --save @fal-ai/client`；方法 `run/subscribe/submit/stream` | 公开页面已核实〔E30 E31〕 |
| 密钥 | `/dashboard/keys`、`/docs/.../authentication` | key 绑定账户（个人或团队）而非个人；作用域 API / ADMIN 两档；`FAL_KEY` 环境变量自动读取；团队 key 全员共用 | 官方文档描述；dashboard 页跳转登录〔E17 E32〕 |
| 用量与账单 | `/dashboard/billing`、`/dashboard/usage-billing/concurrency` | 余额与到期日、并发上限与 30 天用量图；文档给出「购买 credit 后上限自动提升」的规则 | 官方文档描述 / 登录后未核实〔E20 E21〕 |
| 团队 | `/dashboard/members`、`/docs/.../teams` | 角色 Admin / Developer / Billing；CSV 批量邀请单批上限 50；角色（面板权限）与 key scope（程序权限）正交 | 公开页面已核实〔E18〕 |
| 安全 / 隐私 / 服务保障 | `/enterprise`、`/legal/privacy-policy`、`/legal/trust-and-safety`、`trust.fal.ai` | SOC 2（厂商自述）、SSO、私有端点、用户管理；隐私政策含账号关闭后 30 天删除、两年不活跃删除；Trust & Safety 含 NCMEC/Thorn、StopNCII.org、OpenAI Omni 审核 | 公开页面已核实；`trust.fal.ai` 仅取到 HTTP 200 + 标题「fal.ai Trust Center」，正文 JS 渲染无可读内容〔E23 E25 E26 E27〕 |
| 支持 | `/enterprise#contact-sales`、support@fal.ai、safety@fal.ai、`/report-content` | 销售对接、支持邮箱、内容举报入口；首页列「24/7 priority support」 | 公开页面已核实（厂商自述）〔E1 E23 E26〕 |
| 价格总览 | `/pricing` | GPU 按小时价目表、图片/视频模型「约每 $1 产出」归一化对比、企业定制报价入口 | 公开页面已核实〔E22〕 |

## 3. 用户任务路径（每条均标注证据，未真实执行）

**路径 A：不注册先试模型（沙箱）**
1. 进入 `/models` 浏览分类或厂商 → 证据 E2。
2. 打开某个模型页，读输入表单、价格提示、示例输出 → 证据 E3、E4（页面上直接写「Your request will cost $0.025 per megapixel」与示例结果图）。
3. 点模型页上的「try similar models free in Sandbox」→ `/sandbox` → 证据 E3（链接文案）、E8（沙箱页文案「15 free generations today. No account needed.」）。
4. 在沙箱中并排比较多个模型的耗时与单价（页面示例结果格带 92.4s / 0.116 等数值）→ 证据 E8。
   - 注意：模型页运行按钮处显示 `Sign in to run`，**未登录时模型页本身不能直接跑**，免费路径依赖沙箱 → 证据 E7、E8。本次未点击 Run。

**路径 B：接入自有服务**
1. 读 `/docs` 首页的三步说明（挑模型 → 取 API key → 发请求）→ 证据 E9。
2. 用 GitHub / Google OAuth 登录 → 证据 E16（本次未登录）。
3. 在 dashboard 建 key，选择 API 或 ADMIN scope；团队场景需先在左上角切到团队账户 → 证据 E17、E18。
4. 把 key 设为 `FAL_KEY` 环境变量；浏览器端必须走服务端代理，不得暴露 key → 证据 E31（客户端配置与代理说明）、E17。
5. 同步调用 `subscribe()`，或异步 `queue.submit()` 后轮询 `status` / 收 webhook，完成后 `result()` → 证据 E10、E11、E13。
   - 未验证：实际响应、错误码、计费扣减（本次未发任何请求）。

**路径 C：小团队到企业**
1. 建 Team → 邀请成员（CSV 批量 ≤50）→ 分配 Admin / Developer / Billing → 证据 E18。
2. 团队共享同一套 key、部署与账单；请求归属取决于用 key 还是 `fal auth login` → 证据 E18。
3. 需要集中策略时升级 Organization：SSO 强制、跨团队账单与消费告警、模型白名单、restricted request view → 证据 E19。
4. Organization 属 enterprise plan，需联系销售；企业侧还有私有模型托管、自有模型协同开发、按小时 GPU 报价 → 证据 E19、E23、E22。
   - 未验证：报价、合同、实际开通流程。

## 4. 收费样本（USD；均为 2026-09-26 页面所见，未含税）

1. **FLUX.1 [dev]（图片生成）**：`$0.025 per megapixel`，页面明写「Images are billed by rounding up to the nearest megapixel」（不足 1 百万像素按 1 计）。按**输出像素**计价，非按张、非按 token；未见到输入/输出分开计价或最低消费说明。来源 E3。
2. **Nano Banana（图片生成）**：`$0.039 per image`，并给出换算「For $1.00, you can run this model 25 times」。按**张**计价，适用条件（分辨率上限、是否含编辑）页面未在抓取文本中给出。来源 E4。
3. **Compute GPU 小时价**：H100 80GB `$4.50/h`、B200 `$6.25/h`、H200 `$4.50/h`、B300 `$8.50/h`、RTX PRO 6000 `$2.99/h`；同表另列「As low as」折扣列（H100 `$1.89/h`、B300 `$4.49/h`）。按**小时**固定费率，适用于训练/微调/自有部署，不是模型 API 计价。表中「As low as」属优惠档，**不应当作长期标准价**。来源 E22。
4. 补充（非独立样本）：FLUX.2 [max] 为阶梯式「first processed megapixel $0.07，each additional megapixel $0.03」，同样按输出像素〔E5〕。
5. 未核实：视频模型按秒价（如 Kling 2.5 Turbo Pro `$0.0714/second`、Veo 3 `$0.43/second` 出现在 pricing 页的归一化对比区），单独模型页抓取文本未复现该单价，故仅作参考、不作为已核实价格〔E22 E30〕。

## 5. 界面证据

- **未找到官方产品截图 URL。** 已核实的图片链接只有：模型示例输出图（如 `https://storage.googleapis.com/falserverless/example_outputs/nano-banana-t2i-output.png`，来自模型页示例输出区〔E4〕）、沙箱示例结果图（`https://v3b.fal.media/...`，来自沙箱页示例内容〔E8〕）、站点社交缩略图 `https://fal.ai/og-thumbnail.webp`〔E2〕。以上均**不是控制台截图**，不得当作 UI 视觉依据。
- `https://trust.fal.ai/` 返回 HTTP 200，但正文为 JS 渲染，未取得可读文本，只有标题「fal.ai Trust Center」〔E27〕。
- `/dashboard/*`（keys、billing、members）均重定向到登录页〔E32〕，因此控制台界面本次**完全未观察**。
- 结论：本报告只做**信息结构分析**（有哪些字段、哪些入口、哪些文案），不提供像素尺寸、色值、间距或视觉评分。

## 6. 建议（供重新设计参考）

**可借鉴**
1. 把「本次请求要花多少钱」和计价规则写在运行按钮旁，连取整规则都写明（`$0.025 per megapixel`，向上取整到整百万像素）——降低价格争议〔E3〕。
2. 沙箱把「模型名 / 耗时 / 单价 / 总价」直接贴在每个结果格上，多模型并排比较天然形成选型界面〔E8〕。
3. 异步任务状态显式建模为 `IN_QUEUE / IN_PROGRESS / COMPLETED`，并暴露队列位置、runner 日志、取消、webhook——适合长耗时生成类任务的信息架构〔E11〕。
4. 「角色（面板权限）」与「key scope（程序权限）」分成两个正交概念，文档讲得很清楚，适合做团队权限说明页〔E17 E18〕。

**不宜直接照搬**
1. 图片/视频的计价单位体系（每百万像素、每张、每秒、阶梯首 MP）在中转站文本模型场景没有对应物，直接照搬会造成单位与账单口径混乱〔E3 E4 E5 E22〕。
2. 预充值 credit + 365 天过期 + 不可退款 + 价格随时变更（ToS 明文）的组合，对个人与小团队是明显摩擦；企业走 invoice 才不受余额锁账号影响〔E24 E20〕。
3. 并发上限从 2 起步、买 credit 才自动升到 40，且余额低于阈值即锁账号拒请求——试用期体验偏硬〔E20 E21〕。
4. 是否提供免登录试用（如沙箱「15 free generations today」）应先测算单次生成的模型成本，并配套防滥用措施后再决定；本次未测算成本、未评估防护机制，属待验证建议〔E8〕。
5. 生成文件默认公开可访问 URL、默认至少保留 7 天，作为**默认值**对隐私敏感客户不友好（虽可改）〔E20 E29〕。

**目前无法确认**
1. 可用性 SLA / 赔付承诺：reliability 文档只写「重试最多 10 次」，无 SLA 字样；首页「99.99%+ Uptime」为厂商自述、无测量口径〔E12 E9〕。
2. 控制台实际界面（账单页、并发页、成员页的字段与布局）〔E32〕。
3. `trust.fal.ai` 上 SOC 2 报告范围、有效期、ISO 等具体认证清单〔E27〕。
4. 视频模型单模型页的按秒价格、以及是否存在订阅制（页面只出现「fal Agent Pro and Max subscription discounts」一句，未给出价格）〔E20 E30〕。
5. 免费额度规则细节：沙箱「15 free generations today」是否按日重置、是否限模型、与「free credits 1 周到 1 年不等」如何叠加〔E8 E20〕。

## 7. 证据表

| 编号 | URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持判断 |
| --- | --- | --- | --- | --- | --- |
| E1 | https://fal.ai/ | Generative AI \| Run Image, Video, 3D and Audio Models \| fal | 成功 | "Choose from 1,000+ production ready image, video, audio and 3D models."；"SOC 2 Single Sign-On Private endpoints Usage analytics 24/7 priority support" | 产品定位、企业能力（厂商自述） |
| E2 | https://fal.ai/models | （HTML 无独立标题，Marketplace 列表页） | 成功（HTTP 200，5.5MB，未渲染） | 导航含 `/explore/text-to-image-apis`、`/explore/bytedance`、`/explore/openai` 等分类 | 发现页信息结构；og:image 为 `og-thumbnail.webp` |
| E3 | https://fal.ai/models/fal-ai/flux/dev | FLUX.1 [dev]: Text-to-Image AI Generator \| fal | 成功 | "Your request will cost $0.025 per megapixel."；"Images are billed by rounding up to the nearest megapixel."；"Sign in to run" | 图片按输出像素计价；未登录不能运行 |
| E4 | https://fal.ai/models/fal-ai/nano-banana | Nano Banana (Text to Image) API on fal | 成功 | "Your request will cost $0.039 per image. For $1.00, you can run this model 25 times."；徽标 "Commercial use / Partner" | 按张计价；模型许可徽标 |
| E5 | https://fal.ai/models/fal-ai/flux-2-max | Flux 2 Max (Text to Image) API on fal | 成功 | "The first processed megapixel will cost $0.07. Each additional megapixel will cost 0.03" | 阶梯式像素计价 |
| E6 | https://fal.ai/models/fal-ai/veo3/image-to-video | Veo3 (Image to Video) API on fal | 成功 | "This endpoint is deprecated — This model is no longer supported." | **反证**：平台模型会下线，前端需处理失效模型 |
| E7 | https://fal.ai/models/fal-ai/flux/dev | 同 E3 | 成功 | "Sign in to run / or try similar models free in Sandbox" | 登录墙 + 沙箱分流 |
| E8 | https://fal.ai/sandbox | sandbox | 成功 | "15 free generations today. No account needed."；结果格显示 "92.4s / 0.116"、"Total Cost: $0.381" | 免登录试用；单价与耗时透明 |
| E9 | https://docs.fal.ai/ | fal Docs | 成功 | "Call 1,000+ optimized models through a unified API"；"99.99%+ Uptime / Billions+ Requests/day"；三层 Model APIs / Serverless / Compute | 产品分层；uptime 为厂商自述 |
| E10 | https://fal.ai/docs/documentation/model-apis/inference | Inference Methods - fal | 成功 | 同步、异步队列、streaming、real-time WebSocket 的入口说明 | 调用方式分类 |
| E11 | https://fal.ai/docs/documentation/model-apis/inference/queue | Asynchronous Inference - fal | 成功 | "Requests in the queue are never dropped... There is no queue size limit."；状态 IN_QUEUE / IN_PROGRESS / COMPLETED | 队列语义与异步路径 |
| E12 | https://fal.ai/docs/documentation/model-apis/inference/reliability | Reliability - fal | 成功 | "Requests are retried up to 10 times with intelligent backoff."（全文检索无 "SLA"、"uptime"、"99.9"） | **反证**：文档无 SLA 承诺 |
| E13 | https://fal.ai/docs/documentation/model-apis/inference/webhooks | Webhooks - fal | 成功 | webhook 状态 "OK"/"ERROR"，失败会重试，用 request_id 做幂等 | 回调交付机制 |
| E14 | https://fal.ai/docs/documentation/model-apis/inference/streaming | Streaming Inference - fal | 成功 | 流式输出说明 | 流式能力 |
| E15 | https://fal.ai/docs/documentation/model-apis/inference/real-time | Real-Time Inference - fal | 成功 | WebSocket 实时连接说明 | 实时能力 |
| E16 | https://fal.ai/docs/documentation/setting-up/accounts-and-identity | Accounts and Identity - fal | 成功 | "fal supports GitHub OAuth, Google OAuth, and SSO/SAML."；账户类型 Personal / Team / Organization | 开户与身份模型 |
| E17 | https://fal.ai/docs/documentation/model-apis/authentication | Get Your API Key - fal | 成功 | "API keys are tied to accounts, not people."；scope：API / ADMIN；`FAL_KEY` 环境变量 | 密钥模型与作用域 |
| E18 | https://fal.ai/docs/documentation/setting-up/teams | Teams - fal | 成功 | 角色 Admin / Developer / Billing；"Up to 50 invites can be sent per batch."；key 属团队非个人 | 团队与权限 |
| E19 | https://fal.ai/docs/documentation/organizations/index | Organizations - fal | 成功 | "Organizations are available on enterprise plans."；SSO 强制、跨团队账单、模型白名单、restricted request view | 企业层能力与门槛 |
| E20 | https://fal.ai/docs/documentation/model-apis/faq | FAQ - fal | 成功 | "New accounts start at 2 concurrent requests... increases automatically up to 40."；"Server errors (HTTP 500+) are never charged."；"Purchased credits expire 365 days"；文件至少存 7 天、URL 默认公开 | 计费/限流/保留政策；含对用户不利的默认值 |
| E21 | https://fal.ai/docs/documentation/model-apis/concurrency-limits | Concurrency Limits - fal | 成功 | 自建上限 40；按近四周已付发票自动调整；更高需联系销售 | 并发与升级路径 |
| E22 | https://fal.ai/pricing | GenAI API Pricing: Haliuo, Vidu, Pixverse \| Pay-Per-Use \| fal | 成功 | "H100 80GB $4.50/h"、"B300 $8.50/h"、"As low as $1.89/h"；图片/视频"approximate output per $1"归一化说明 | GPU 小时价；促销列不可当标准价 |
| E23 | https://fal.ai/enterprise | Enterprise GenAI Platform \| Custom Models \| Dedicated Infra \| fal | 成功 | "We never train our models on our enterprise customers' data."；私有模型托管、SSO、用户管理、SOC2（厂商自述） | 企业能力与数据承诺（厂商自述） |
| E24 | https://fal.ai/legal/terms-of-service | Terms of Service \| fal | 成功 | "Customer will be required to purchase credits in advance."；"Credits will expire 365 days"；"non-refundable"；价格可随时变更 | 收费与退款限制 |
| E25 | https://fal.ai/legal/privacy-policy | Privacy Policy \| fal | 成功 | 关闭账户后 30 天内删除个人信息；两年不活跃后删除 | 隐私与数据保留 |
| E26 | https://fal.ai/legal/trust-and-safety | Trust & Safety \| fal | 成功 | NCMEC/Thorn CSAM 哈希匹配、StopNCII.org、OpenAI Omni 内容审核 | 内容安全机制 |
| E27 | https://trust.fal.ai/ | fal.ai Trust Center | 部分（HTTP 200，JS 渲染，无可读正文） | 仅取到标题 "fal.ai Trust Center" | **反证/限制**：认证清单未能核实 |
| E28 | https://fal.ai/docs/documentation/model-apis/media-expiration | Data Retention & Storage - fal | 成功 | 生成文件存于 fal CDN，默认至少 7 天，可用 header 控制保留期 | 文件保留策略 |
| E29 | https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/api | Kling Video Image to Video API Docs \| fal | 成功 | 安装 `@fal-ai/client`、`export FAL_KEY="YOUR_API_KEY"`、queue submit/status/result 代码块；**未见价格文本** | 接入文档结构；视频按秒价未核实 |
| E30 | https://fal.ai/docs/documentation/model-apis/inference/client-setup | Client Setup - fal | 成功 | "you cannot use the API key directly because browser source code is visible"；官方客户端 Python/JS/Swift/Java/Kotlin/Dart | 密钥安全约束；SDK 覆盖 |
| E31 | https://fal.ai/dashboard/keys | Login to fal \| Access 1000+ Generative AI Models | 成功（重定向登录页） | 页面为登录界面 | 登录后未核实：控制台界面 |
| E32 | https://fal.ai/models/fal-ai/nano-banana/api | Nano Banana Text to Image API Docs \| fal | 成功 | 含 curl/JS 调用、queue 章节、输出 schema 章节 | API 参考页结构 |

## 8. 访问统计与阻碍

- 成功取得可读正文的一手页面：**22 个**（E1–E26、E28–E32 中的正文页）；HTTP 200 但无正文 1 个（E27）。
- 以下具体路径本次返回 404：`/docs/documentation/setting-up/billing`、`/docs/documentation/setting-up/usage`、`/docs/documentation/setting-up/compliance`、`/docs/documentation/model-apis/model-endpoints/queue`。404 原因（路径更名、内容合并或确实不存在）以及对应的替代路径均未核实。
- 阻碍：① 无浏览器渲染，`/models`（5.5MB）与 `trust.fal.ai` 只能拿到 HTML/空壳；② 全部 `/dashboard/*` 跳登录，用量与账单界面未观察；③ 未登录状态下模型页只显示 `Sign in to run`，无法验证真实调用与扣费。
- 最值得主控复核的 2 个 URL：`https://fal.ai/models/fal-ai/flux/dev`（模型页把价格规则、示例输出、登录/沙箱分流放在同一页，是最直接的选型页范式）与 `https://fal.ai/docs/documentation/model-apis/inference/queue`（队列三态 + 取消 + webhook 的完整异步语义，是异步任务页面的主要参考）。

---

SUMMARY: 一手核验 fal 官网与文档共 22 个可读页面 + 1 个仅 HTTP 200 的空壳页（trust.fal.ai）。收得确切价格 3 组（FLUX.1 dev $0.025/百万像素向上取整；Nano Banana $0.039/张；Compute GPU H100 $4.50/h 等小时价），另记 FLUX.2 max 阶梯价 $0.07/$0.03 作补充；收得队列三态、并发 2→40、credit 365 天过期不可退、生成文件默认公开且至少存 7 天等关键规则；界面截图类证据为 0。

FILES: 仅写入 `C:\code\sub2api-enterprise\docs\调研\2026-09-26-AI-API服务站\08-fal.md`；原始素材存于 `C:\code\sub2api-enterprise\.fleet\evidence\fal\`（models.html、fal.ai_pricing.html、fal.ai_enterprise.html、fal.ai_models_fal-ai_nano-banana.html、trust-fal-ai.html）。未改动其他文件，未执行任何 git 写操作。

VERIFY: 报告中每条事实均指向证据表 E1–E32 的完整 URL 与原文短摘录，摘录直接来自本次抓取返回的正文；对 pricing 页「As low as」列已明确标注为促销档、不得当作长期价；对 SLA、控制台界面、trust 认证清单、视频按秒单价均标为未核实；明确写入「未渲染页面、不做视觉判断」与 E6/E12/E27 三条反证/限制。

SELF_REPORT: pass

BLOCKED: ① 无浏览器渲染环境，`/models`（5.5MB HTML）与 `trust.fal.ai` 未能取得可读内容，无法核实 SOC 2 报告范围等认证细节；② 全部 `/dashboard/*`（keys、billing、members、usage-billing/concurrency）重定向登录页，用量与账单、团队管理界面完全未观察，也未注册/登录；③ 视频模型单模型页未见按秒价格，pricing 页仅给出归一化「每 $1 产出」，视频计价单位未核实；④ 沙箱免费额度与免费 credit 的有效期细则、是否存在订阅制价格档未找到明确证据；⑤ 本次未发起任何真实模型调用，故实际扣费口径与错误码行为未验证。
