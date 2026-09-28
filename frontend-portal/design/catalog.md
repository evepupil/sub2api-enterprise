# M1 模型目录页面

2026-09-28 视觉按 [Proactiv 内页规格](proactiv-redesign.md#6-其它页面层) 更新。紧凑模型卡、四价顺序、筛选和实际价格来源继续遵循下文。

依据：[官网规格](public-site.md)。组件 `CatalogView({result})`、`ModelCard({model})`，只消费公开类型，不调用网络。

页面顶部 PageHeader“模型与价格”，右侧“美元 / 百万 Token”。下方单行工具栏：标签“搜索模型”的输入，placeholder“搜索模型代号”；厂家Select含“全部厂家”和由实际models去重生成的厂家。手机上下排，桌面搜索弹性、厂家宽192px。通过本地状态过滤，名称/厂家大小写不敏感；搜索和选择立即生效，无分页（模型数量少）。

主体为三列xl、两列md、单列手机，gap16px。每张卡片padding20，表面白、border、8px圆角，无大阴影。头部36px厂家logo、厂家名16px/600、下面型号18px/500，长型号可换行。分隔线后四价严格输入/缓存写入/缓存读取/输出，标签12px次级色、数值16px/tabular，小额保持精度。用dl表达，宽度不足不裁价格，极窄可2×2。卡片不含描述、标签、操作按钮、详情链接或调用示例。

ModelCard logo本地品牌SVG，OpenAI/Anthropic/Google已有原型素材复制到public/providers；未知厂家用一个中性圆形首字母，必须仍有厂家名称。不要从网络加载任意URL。

状态：ready但无models=>“暂无公开模型”；筛选无结果=>“没有匹配的模型”+清空筛选按钮；disabled=>“模型目录尚未开放”；authentication-required=>“请登录后查看模型”；unavailable=>“模型价格暂时无法加载”+重试（当前页刷新）。禁止样例价兜底。加载由路由loading文件用6张Skeleton表达。

调用 `formatPrice` 获取金额，ModelCard不自行算倍率。供首页复用时无筛选工具，只渲染最多3张同样卡片。
