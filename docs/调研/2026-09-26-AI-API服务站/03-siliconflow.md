# 硅基流动 SiliconFlow 调研（一手联网核验）

- 观察日期：2026-09-26（全部抓取均在当日完成）
- 调研范围：仅 siliconflow.cn 及其官方文档站 docs.siliconflow.cn；国际站 www.siliconflow.com 仅用于对照说明，价格不混用
- 抓取方式：HTTP 直接抓取（readable 抽取 + curl.exe 原始 HTML 落地）。本机浏览器连接不可用，未渲染任何页面，**未做视觉/像素/色值判断**
- 登录状态：未登录、未注册、未充值、未调用任何模型。本次实测的 cloud.siliconflow.cn 子路径（/models、/bills、/expensebill、/account/ak、/account/authentication）均跳「硅基流动统一登录」

## 1. 产品定位与人群

- 产品类型与定位：官网自我定位为模型服务平台，产品线包括大模型 API 云服务 + 企业级 MaaS（私有化/预留实例/AI 网关）+ AI 算力运营 [E1][E4][E5][E6]。与第三方 API 中转/转售的关系：**未核实**——官网自称"自研全栈推理引擎""支持国产异构 GPU 部署"，但均为厂商自述，只能说明官方宣称具备自建推理能力，**不能据此断定平台不存在第三方模型转售/代理关系**；公开页面未给出模型供给链路、上游授权或转售协议的任何说明 [E1][E4][E9]。
- 谁在用：官网自述面向开发者、Agent/编码应用、内容创作、企业智能、行业方案；国际站模型页自称 "Trusted by 10M+ users and 13,000+ enterprise customers"（厂商自述）[E1][E9][E19]。
- 与 AI API 中转站的相似处：统一 base_url `https://api.siliconflow.cn/v1`、兼容 OpenAI（文档亦提到兼容 Anthropic 协议）、API Key 管理、按 token 计费、余额充值、模型列表接口 [E8][E9]。
- 与 AI API 中转站的不同处（均为公开页面/文档可观察的差异，不代表供给链路已核实）：存在实名认证与开票等合规前置；同名模型用 `Pro/` 前缀区分支付来源（Pro 版仅支持充值余额支付，非 Pro 版支持赠费+充值余额）；另有企业级预留实例、私有化 MaaS、AI 网关等非按量转售形态的产品线 [E4][E5][E6][E10][E11]。
- 免费/收费双轨：部分模型同时提供免费版与收费版，免费版按原名称、收费版加 `Pro/`；免费模型 Rate Limits 固定，收费模型随用量级别变化 [E10]。

## 2. 导航 / 页面与功能表

状态取值：公开页面已核实 / 官方文档描述 / 登录后未核实 / 未找到证据

| 区块 | 页面或路径 | 已观察到的功能 | 状态 |
|---|---|---|---|
| 发现与选型 | siliconflow.cn/models | 按厂商分组（DeepSeek/Qwen/智谱/Kimi/MiniMax 等）"探索系列"，文案"1 个 API，3 行代码，100+ 主流模型" | 公开页面已核实 [E3] |
| 发现与选型 | siliconflow.cn/pricing | 模型价格总览，分对话/生图/语音/视频四类；对话模型分输入、输出、缓存命中三列 | 公开页面已核实 [E2] |
| 发现与选型 | cloud.siliconflow.cn/models | 模型详情页含价格与限速，可进"在线体验" | 官方文档描述 [E8] |
| 开户与接入 | siliconflow.cn 首页右上"登录" | 支持短信登录、邮箱登录 | 官方文档描述 [E8] |
| 开户与接入 | docs quickstart | 4.1 创建 API Key → 4.2 REST 调用 → 4.3 OpenAI 库调用（`pip install openai`，base_url 指向 api.siliconflow.cn/v1） | 官方文档描述 [E8] |
| 开户与接入 | cloud.siliconflow.cn/account/ak | "API 密钥"页，点"新建 API 密钥"创建 | 登录后未核实 [E8] |
| 开户与接入 | cloud.siliconflow.cn/account/authentication | 个人实名（支付宝人脸）/企业实名（法人人脸 或 对公打款随机金额） | 官方文档描述 [E11] |
| 密钥 | cloud.siliconflow.cn/account/ak | 密钥列表与创建入口；Rate Limit 按账号级别而非按 key 定义 | 官方文档描述 [E8][E10] |
| 用量与账单 | cloud.siliconflow.cn/bills（费用账单） | 查看使用与费用明细；免费模型在该页费用显示为 0 | 官方文档描述 [E10][E12] |
| 用量与账单 | cloud.siliconflow.cn/expensebill（余额充值） | 在线充值 / 支付宝自动续费 / 企业对公转账三种方式 | 官方文档描述 [E12] |
| 用量与账单 | cloud.siliconflow.cn/invoice（开具发票） | 自助申请开票，按已消费金额开票，未消费充值余额不可开票 | 官方文档描述 [E13] |
| 用量与账单 | 代金券 | 赠金转为代金券，可在「余额充值 > 代金券」查看列表 | 官方文档描述（更新公告）[E20] |
| 团队/组织 | siliconflow.cn/ai-gateway | 按用户、API Key、项目、组织维度配置模型权限、流量与配额；多租户、审计日志、成本穿透 | 公开页面已核实（产品页）/ 登录后未核实（控制台）[E6] |
| 团队/组织 | 子账号、成员角色、成员配额 | — | 未找到证据 |
| 安全/隐私/服务保障 | docs 隐私政策 | API 推理不长期存储业务输入输出，不用于预训练/微调；收集 IP、模型名、Token 消耗量、请求时间与状态码等日志 | 公开页面已核实（厂商自述）[E14] |
| 安全/隐私/服务保障 | docs 平台使用协议 | 内容合规红线（违法违规内容清单等） | 公开页面已核实 [E16] |
| 安全/隐私/服务保障 | 具体 SLA 可用性指标与赔付 | 仅见"提供明确的服务等级协议与运行保障机制"表述 | 未找到证据 [E5] |
| 支持 | 文档站 + contact@siliconflow.cn | 错误码排查（400/401/403/429/5xx）、Rate Limits 说明、财务/发票 FAQ | 公开页面已核实 [E8][E10][E12][E13] |
| 支持 | 企微客服 + 飞书表单 | 企业咨询/上架/限速提升均走表单预约 | 官方文档描述（表单链接可见）[E4][E10] |
| 试用体验 | 在线体验（playground） | 左侧边栏选语言模型/文生图/图生图，填参数与提示词点"Run" | 官方文档描述 [E8] |
| 试用体验 | 新用户免费额度当前数值 | 仅在国际镜像站见到"14 元免费额度（约 2 千万 Qwen1.5-14B tokens）"旧文案 | 未找到证据（见 BLOCKED）[E21] |

## 3. 用户任务路径（均未实际注册/充值/调用，仅为路径推演）

**路径 A：专业个人 —— 从选型到跑通第一条请求**
1. 打开 siliconflow.cn 首页，看到"开箱即用的大模型 API…按量计费"与"立即体验"入口 [E1]。
2. 到 siliconflow.cn/models 按厂商/系列浏览，或到 siliconflow.cn/pricing 比价 [E2][E3]。
3. 点右上"登录"进入 cloud.siliconflow.cn，短信或邮箱登录 [E8]。
4. 完成实名认证（个人人脸，30 天内仅可变更一次）[E11]。
5. 进入 API 密钥页新建密钥 [E8]。
6. 本地安装 openai 库，`base_url="https://api.siliconflow.cn/v1"` 发起调用 [E8]。
   - 证据分布：第 1–2 步为公开页面；第 3–6 步为官方文档描述，控制台界面本身登录后未核实。

**路径 B：小团队 —— 限额与成本治理**
1. 先用免费模型（需实名）验证，费用在账单中显示为 0 [E10]。
2. 观察 429 错误（RPM/RPH/RPD/TPM/TPD/IPM/IPD 任一触顶）[E10]。
3. 通过月消费自动升级用量级别：L0 <¥50，L1 ¥50–200，L2 ¥200–2000，L3 ¥2000–5000，L4 ¥5000–10000，L5 ≥¥10000 [E10]。
4. 需要快速提升时走"购买级别包"联系表单，或直接购买专属实例（专属实例通常无 Rate Limits）[E10]。
5. 若需按 API Key/项目/组织做配额，则转向企业 AI 网关产品 [E6]。

**路径 C：企业 —— 采购与合规**
1. 打开 siliconflow.cn/enterprise 看 MaaS 私有化能力与场景，点"立即咨询"进飞书表单 [E4]。
2. 到 siliconflow.cn/reserved 看预留实例规格、价格与交付周期，预约咨询 [E5]。
3. 到 siliconflow.cn/ai-gateway 评估多模型统一接入、智能路由、限流限额、审计日志 [E6]。
4. 账号侧先做企业实名（法人人脸或对公打款），才能开企业抬头发票与对公充值 [E11][E12][E13]。

## 4. 收费样本（币种：人民币 ¥；观察日期 2026-09-26；来源均为 E2/E5）

| 样本 | 计价单位 | 输入 | 输出 | 缓存命中 | 页面价格标签 | 适用条件 |
|---|---|---|---|---|---|---|
| deepseek-ai/DeepSeek-R1 | 每千 tokens | ¥0.004 | ¥0.016 | ¥0.0004 | 兜底价 | 即 ¥4 / ¥16 / ¥0.4 每百万 tokens；页面原标签为「兜底价」，其含义与长期有效性未核实 [E2] |
| deepseek-ai/DeepSeek-V4-Pro | 每千 tokens | ¥0.012 | ¥0.024 | ¥0.001 | 刊例价 | 即 ¥12 / ¥24 / ¥1 每百万 tokens；页面原标签为「刊例价」，其含义与长期有效性未核实 [E2] |
| 预留实例 zai-org/GLM-5.1（高性能实例规格） | 每组/月 | — | ¥772,200 /组/月，折合 ¥3.575 / M tokens | — | 示例规格报价 | 折合单价按 TPM、每月 30 天、总体利用率 50% 折算；性能基于输入 24k/输出 1k tokens、缓存命中率 80% 测试 [E5] |

- 价格标签说明：`deepseek-ai/DeepSeek-V3.2` 三项价格（输入 ¥0.004、输出 ¥0.006、缓存 ¥0.0004 每千 tokens）在页面数据中标注为**活动价**，属页面原标签；该标签含义未由官方定义，但字面提示可能为阶段性价格，因此**不当作长期价引用** [E2]。
- 页面数据字段存在三种取值：兜底价（72 个模型）、刊例价（24 个）、活动价（2 个）；本次抓取的页面文本中未见平台对这三个词给出定义，故口径仅按字面理解，长期有效性未核实 [E2]。
- 免费模型（如 Qwen/Qwen3-8B、BAAI/bge-m3、deepseek-ai/DeepSeek-OCR）价格显示为 0，实名后可用 [E2][E10]。
- 未核实：充值档位、代金券面额、国际站价格（国际站为美元口径且文案不同，明确不与国内混用）[E18]。

## 5. 界面证据

- 我**没有渲染任何页面**，也未登录，因此不对布局、配色、字号、间距做任何描述或评分。以下官方文档截图 URL 仅证明"官方给出了该界面的示意"，我未在真实登录态下看到这些界面。
  - 在线充值界面示意：`https://sf-maas-uat-prod.oss-cn-shanghai.aliyuncs.com/doc-resources/images/faqs/mic/image_recharge_online.webp`（对应《Financial》余额充值-在线充值）[E12]
  - 支付宝自动续费界面示意：`.../faqs/mic/image_recharge_auto.webp`（对应同一页 Auto-Recharge）[E12]
  - 企业对公转账订单页示意：`.../faqs/mic/image_recharge_corp.webp`（对应 Corporate Bank Transfer）[E12]
  - 费用账单页示意：`.../faqs/mic/image_1.webp`（对应"如何查询使用账单"）[E12]
  - 实名认证页示意：`.../faqs/authentication/image.webp`（对应个人实名流程第 3 步）[E11]
  - 以上 5 个 URL 均返回 HTTP 200、content-type: image/webp（仅校验可访问性，未查看像素内容）。
- 仅 HTML 结构可分析的部分：本次实测的 cloud.siliconflow.cn 五个路径（/models、/bills、/expensebill、/account/ak、/account/authentication）返回的 HTML 标题均为"硅基流动统一登录"，正文含登录/注册/手机号/验证码文案 → 这五个路径在未登录时**重定向到登录页**，控制台内部信息架构无法从公开 HTML 得到 [E17]。
- 可以确认的信息结构（非视觉）：控制台侧边栏存在"实名认证""余额充值""费用账单""API 密钥""模型微调""开具发票"等入口，依据是文档中的路径描述 [E8][E11][E12][E13]。

## 6. 建议（均为参考意见，未做取舍）

**可借鉴**
1. 价格页把"输入 / 输出 / 缓存命中"拆成三列并标注每百万 tokens 口径，比只给一个综合价更利于生产选型 [E2]。
2. 用显式前缀（`Pro/`）区分"同一模型的免费版与收费版"，并在文档里说明两者支付来源差异，避免用户在账单上产生困惑 [E10]。
3. 把用量分层（L0–L5 按自然月消费金额）与限速（RPM/TPM 等）直接挂钩，并在文档中给出升级规则与 429 处理建议 [E10]。
4. 实名认证把"个人 vs 企业"对账号归属与开票能力的影响写在流程前，属于合规前置信息的合理暴露 [E11]。

**不宜直接照搬**
1. 价格数据字段使用"兜底价/刊例价/活动价"但页面不给定义，外部读者难以判断哪一个是长期价；重新设计时应把口径写死 [E2]。
2. 关键商务动作（企业咨询、限速提升、上架审核）在所见文档中均指向飞书外部表单，不在产品自身闭环内；对 SaaS 前端的可追踪性不利（仅就所见路径而言）[E4][E10]。
3. 控制台未登录即统一跳登录页，价格与模型选择虽在官网公开，但"用量/账单/密钥"完全不可预览，新用户对成本模型的预期只能靠文档 [E17]。
4. 免费额度、试用激励的当前口径散落在旧文档与国际镜像站，官网首页未见清晰呈现（见 BLOCKED）[E21]。

**目前无法确认**
1. 具体 SLA 可用性百分比与赔付机制：官网仅写"提供明确的服务等级协议"，未公开数值 [E5]。
2. 团队/子账号体系（成员角色、按成员配额、账单分摊）是否存在，公开页面与文档均未给出证据 [E6]。
3. 控制台内密钥页、账单页、模型详情页的真实布局与交互（登录墙 + 无渲染）[E17]。
4. 代金券当前面额/有效期与充值档位；以及免费模型清单的实时边界 [E2][E20]。

## 7. 证据表

| 编号 | URL | 页面标题 | 访问 | 原文短摘录（≤30 词） | 支持判断 |
|---|---|---|---|---|---|
| E1 | https://siliconflow.cn/ | 硅基流动 SiliconFlow - 大模型 API 与 AI 云服务平台 | 成功 200 | "开箱即用的大模型 API…按量计费"；"自研全栈推理引擎""支持国产异构 GPU 部署"（厂商自述） | 首页定位与产品线；供给链路仍未核实 [§1][§3-A] |
| E2 | https://siliconflow.cn/pricing | 大模型 API 价格方案 - 硅基流动 SiliconFlow | 成功 200 | "面向生产选型的模型价格页：一屏对比主流厂商与模型的输入、输出、缓存命中成本" | 价格结构与价格样本 [§4] |
| E3 | https://siliconflow.cn/models | 模型中心｜硅基流动 SiliconFlow 大模型云服务 | 成功 200 | "1 个 API，3 行代码，100+ 主流模型轻松调用" | 模型广场按厂商分组 [§2] |
| E4 | https://siliconflow.cn/enterprise | 硅基流动企业级 MaaS 平台与私有化部署 | 成功 200 | "覆盖从异构算力纳管、模型训练、推理部署到场景落地的闭环解决方案" | 企业服务与咨询入口 [§3-C] |
| E5 | https://siliconflow.cn/reserved | 硅基流动预留实例服务｜大模型预留算力与企业级推理部署 | 成功 200 | "价格 ¥ 772,200 /组/月 折合单价 ¥ 3.575 / M tokens" | 预留实例报价与 SLA 表述 [§4][§6] |
| E6 | https://siliconflow.cn/ai-gateway | 硅基流动大模型服务网关｜统一接入 智能路由 多模型调度 | 成功 200 | "支持按用户、API Key、项目、组织等维度配置模型权限、流量与配额管理" | 企业治理能力；也是本轮所见团队功能唯一线索 [§2][§6] |
| E7 | https://siliconflow.cn/token-factory | AI 算力运营服务与 Token 工厂 - 硅基流动 SiliconFlow | 成功 200 | "AI 算力运营"（页面存在，正文未细读） | 仅证明产品线存在 [§1] |
| E8 | https://docs.siliconflow.cn/cn/userguide/quickstart | Quickstart | 成功 200 | "Click on 'Create API Key'… base_url='https://api.siliconflow.cn/v1'" | 开户与接入路径 [§2][§3-A] |
| E9 | https://docs.siliconflow.cn/cn/userguide/introduction | Platform introduction | 成功 200 | "Compatible with OpenAI and Anthropic protocols" / "Enterprise-grade SLA backed by developer-verified reliability" | 产品矩阵与兼容性；SLA 仅定性 [§1][§2] |
| E10 | https://docs.siliconflow.cn/cn/userguide/faqs/rate-limit-and-upgradation | Rate limits | 成功 200 | "Rate limits are defined at the user account level, not at the API key level" / L0–L5 消费门槛 | 限速与用量分层 [§3-B] |
| E11 | https://docs.siliconflow.cn/cn/userguide/faqs/authentication | Real-name Authentication | 成功 200 | "Unable to perform 'Account Recharge' / Unable to apply for 'Invoice Issuance'" | 实名前置与个人/企业差异 [§2][§3-C] |
| E12 | https://docs.siliconflow.cn/cn/userguide/faqs/misc_finance | Financial | 成功 200 | "Online Recharge, Alipay Auto-Recharge, and Corporate Bank Transfer" / 单笔上限 ¥100,000 | 充值方式与账单查询 [§2][§5] |
| E13 | https://docs.siliconflow.cn/cn/userguide/faqs/invoice | Invoices | 成功 200 | "Only the amount already consumed can be applied for invoicing" | 开票规则 [§2][§3-C] |
| E14 | https://docs.siliconflow.cn/cn/legals/privacy-policy | 隐私政策（更新日期 2026-07-30） | 成功 200 | "我们不会长期存储您的任何业务输入与输出数据；不会将您的业务数据用于任何大模型的预训练" | 数据留存口径（厂商自述）[§2] |
| E15 | https://docs.siliconflow.cn/cn/legals/recharge-policy | 用户充值协议 | 成功 200 | "充值完成后 360 日内，对于尚未消费的余额您可自行操作退款" | 退款/有效期口径 [§2] |
| E16 | https://docs.siliconflow.cn/cn/legals/terms-of-service | 平台使用协议 | 成功 200 | 内容合规红线条款清单（违法违规内容不得生成/传播） | 合规约束；SLA 在协议中仅出现 1 次且上下文不明确 [§2] |
| E17 | https://cloud.siliconflow.cn/models（及 /bills、/expensebill、/account/ak、/account/authentication） | 硅基流动统一登录 | 成功 200 但被登录墙拦截 | 页面标题均为"硅基流动统一登录" | 控制台需登录，公开 HTML 无产品内容 [§5] |
| E18 | https://www.siliconflow.com/pricing | Serverless Pricing（国际站） | 成功 200 | "plus $1 in free credits" / "no minimum commitments" | 仅作国内外不混用的对照证据 [§4] |
| E19 | https://cloud.siliconflow.cn/models（国际站渲染文案） | SiliconFlow（登录墙页面内文案） | 成功 200 | "Trusted by 10M+ users and 13,000+ enterprise customers" | 用户规模（厂商自述）[§1] |
| E20 | https://docs.siliconflow.cn/cn/release-notes/overview | 更新公告 | 成功 200（经搜索结果摘录） | "赠金升级为代金券…代金券设有有效期，具体时间可在「账户总览」中查看" | 激励形式与欠费拦截说明 [§2] |
| E21 | https://docs.siliconflow.com/cn/faqs/billing-rules（国际镜像，仅搜索结果摘录） | 价格说明 | 未直接访问成功（.cn 同路径 404） | "新用户注册即得 14 元免费额度 (相当于 2 千万 Qwen1.5-14B Tokens)" | 反证/适用限制：内容明显陈旧，不能当作当前政策 [§4][§6] |

### 反证与适用限制（保留项）
- 官网首页未出现任何明确的免费额度数值，而网上可检索到的"14 元免费额度"文案来自旧路径/镜像站且绑定 Qwen1.5 系列，故本次调研**不确认当前新用户试用额度** [E21]。
- `docs.siliconflow.cn/cn/userguide/faqs/billing-rules`、`/cn/faqs/*` 等历史路径实测返回 HTTP 404（curl 与抽取服务各验证一次），说明文档站已改版，旧链接不可引用 [E21]。
- 预留实例的"¥3.575 / M tokens 折合单价"依赖 50% 利用率假设，实际成本与利用率强相关，不可与按量价格直接横向比较 [E5]。
- 国际站为美元计价且营销文案不同，本报告所有价格结论仅限国内站 [E18]。

## BLOCKED

- 未登录：控制台（密钥页、账单页、模型详情页、用量级别设置页、发票页）界面与真实交互**全部登录后未核实**；未注册、未充值、未调用模型，因此没有任何"我看到了控制台"的结论。
- 未渲染：本机浏览器连接不可用，所有页面均为 HTTP 文本级观察，**不做布局与视觉结论**；官方文档截图仅校验了 URL 可访问（HTTP 200 / image/webp），未查看其像素内容。
- 未找到证据：具体 SLA 可用性百分比与赔付条款；团队/子账号/成员配额体系；新用户当前免费额度数值；代金券当前面额与有效期；充值档位列表。
- 口径不明与未核实：价格页数据字段"兜底价/刊例价/活动价"在本次抓取的页面文本中未见定义，仅按字面理解，三个标签的长期有效性均未核实；平台与上游模型方/第三方 API 的供给与转售关系亦未核实，官网"自研推理引擎"为厂商自述，不能反向证明不存在第三方转售。
- 未采集：siliconflow.com 国际站价格明细、cloud-rd.siliconflow.cn 等旁站、任何第三方评测或媒体报道（本轮只用一手页面）。
- 采集限制：为控制时长，只精读了 6 个官网页面 + 8 个文档/协议页面，未穷尽文档站（如 API 手册、场景示例、更多 FAQ）。

---

SUMMARY: 成功访问并读取内容的一手页面共 16 个（官网 7 个：首页/pricing/models/enterprise/reserved/ai-gateway/token-factory；文档与协议 8 个：quickstart、introduction、rate limits、authentication、misc_finance、invoice、privacy-policy、recharge-policy、terms-of-service——其中 token-factory 仅确认存在未细读）；另有 1 个登录墙页面组（cloud.siliconflow.cn 5 个路径，均跳统一登录）与 1 个国际站对照页。整理证据 21 条，收费样本 3 条（含 1 条企业预留实例报价），用户任务路径 3 条，界面证据 5 个官方截图 URL，建议 12 条，BLOCKED 6 项。原始素材已落地。
FILES: 报告写入 C:\code\sub2api-enterprise\docs\调研\2026-09-26-AI-API服务站\03-siliconflow.md；原始素材在 C:\code\sub2api-enterprise\.fleet\evidence\siliconflow\（pricing-raw.html、pricing-extract.txt、home-cn.html、reserved.html、tos.html、privacy-policy.html、recharge-policy.html、texts.txt、cloud-*.html 等）。未改动其他任何文件，未执行任何 git 写操作。
VERIFY: 逐条核对方式——(1) 每个证据 URL 都用 curl.exe 复测状态码（结果：官网/文档页 200，旧路径 /cn/userguide/faqs/billing-rules 与 /cn/faqs/* 为 404，已如实标注）；(2) 价格数字来自 siliconflow.cn/pricing 原始 HTML 内嵌数据，按模型名精确匹配抽取，未核实渲染后的显示结果，输出到 .fleet/evidence/siliconflow/pricing-extract.txt 可复核；(3) 报告内所有价格均标注币种、计价单位（每千 tokens 原始值 + 每百万 tokens 换算）、输入/输出/缓存区别、价格标签与来源编号；(4) 文件编码 UTF-8，行数在 100–160 区间内（约 150 行）。
SELF_REPORT: pass
BLOCKED: 见报告末节 BLOCKED。要点：无法登录故控制台界面与团队/子账号能力未核实；无浏览器故不做任何视觉结论；SLA 赔付条款、当前免费额度数值、代金券面额、充值档位均未找到一手证据；价格页"兜底价/刊例价/活动价"三词无官方定义，口径拿不准；本轮只精读 14 个页面，文档站未穷尽。
