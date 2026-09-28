# M1 首页页面

2026-09-28 当前首页以 [Proactiv 整站改版](proactiv-redesign.md#5-首页逐区块规格) 的企业版 10 个区块为准，营销文案集中在 `src/content/marketing.ts`。下面四段浅色首页是历史记录，已被新规格取代；真实价格、注册配置、可访问性和身份边界继续保留。

依据：[官网规格](public-site.md) 和已确认08号首页图。导出 `HomeView({catalog,site})`，四段内容。

1. 首屏hero：上留白64px，下24px，中心“个人与团队的模型服务”；h1“主流模型，统一接入与计费。”，桌面48px、手机32px，副行“按量计费 · 密钥管理 · 团队配额”。按钮“查看模型”到/catalog；第二按钮“查看接入说明”到/help。灰白极轻网格背景+Spotlight不遮文字，动画在减少动态偏好关闭。
2. 产品展示：复用已核对官方Aceternity ContainerScroll适配，最大1120px，轻微透视随滚动回正，图像public/illustrations/dashboard-preview.png。图注“控制台界面示意”，alt说明示例布局而非真实业务数据。图无伪装可点击控件。与hero紧接不做巨大空白。
3. 模型与价格：标题28px，右侧“查看全部模型”/catalog +统一“美元 / 百万 Token”。ready取3个不同实际模型，复用ModelCard；其他状态复用简洁状态表达，禁止将样例9张截图当实时价格。
4. 接入与账户：左右两块简短内容，一块“开始使用”三步“选择模型”“创建密钥”“充值后调用”，链接/help；一块“个人与团队”列“个人密钥与用量”“组织成员与消费配额”“按成员查看费用”。只陈述已有底座能力，无增长指标、客户logo墙、99.99%保障、套餐、试用。

效果文件 `src/components/effects/spotlight.tsx`、`container-scroll.tsx`，基于本机 .fleet/prototypes/aceternity-home-20260926/src/components/ 对应已引用官方源码，不重新联网取。专属样式放 `src/styles/marketing.css`，被globals导入。颜色/尺寸的静态数值放主题变量，组件只有语义类。Motion安装已由主控完成。不得为组件依赖Next图片/路由以免离线预览不能运行；本地图片可普通img（为这一个资源解释性eslint例外），不能全局关规则。

真实业务界面可以使用这张说明图，但必须显示示意图注；不把构造的图内余额/消费称为运营数据。模型卡片则只取正式接口。
