# 独立客户前端

基于既有 Sub2API 业务的新官网与客户控制台。开发顺序见 [路线图](docs/roadmap.md)，目前已建立共享工程并实现 M1 官网四页。

## 本机要求

使用 Windows Node.js 24 和 pnpm 10.34.5，在本目录安装依赖；依赖、缓存、构建产物与原 `frontend/` 分开。

```powershell
pnpm install --frozen-lockfile
pnpm check
```

检查包括格式、静态分析、严格类型、导航规则测试和生产构建。页面外观与实际交互需另做浏览器验收。

## 组件预览

```powershell
pnpm preview:offline
```

构建后用 Edge 打开 `.preview/index.html`。此命令只生成文件，不启动服务；页面使用正式共享组件与主题，包含控件、官网外壳和控制台外壳三个视图。所有记录为预览样例，表单操作只修改当前页面内存。

Next 应用也保留内部 `/design` 页面，只在服务端环境变量 `PORTAL_UI_PREVIEW=1` 时返回预览，默认关闭且禁止搜索收录。运行开发或预览服务器前，遵守用户明确授权的约定。

官网四页的离线预览：

```powershell
pnpm preview:public
```

用 Edge 打开 `.preview/public.html`，可切换首页、模型目录、状态和帮助，以及正常、错误、关闭、需登录和空数据。该文件使用实际页面组件和明确标注的样例数据；资源内嵌，不启动服务。

## 官网接口配置

正式路由为 `/`、`/catalog`、`/status` 和 `/help`。服务端配置说明见 [.env.example](.env.example)：

- `SUB2API_INTERNAL_URL`：固定的 Sub2API origin，例如部署内可访问的后端地址，不包含 `/api/v1`、查询或凭证。未配置时，模型和状态显示暂时不可用。
- `PORTAL_ACCOUNT_URL`：M2 账号接入前可连接已有客户网站。配置后显示其登录和控制台入口，未配置则隐藏账号操作。

只调用公开设置、模型广场和状态接口，不转发用户凭证。数据请求包含五秒总超时，不使用旧价格或示例数据兜底。帮助正文采用已核对的本地内容，公开客服文本和文档链接取后端配置；受保护的公告接口不向匿名访客请求。

## 工程边界

- 主题：`src/styles/`，颜色、字体、尺寸与断点统一配置。
- 基础控件：`src/components/ui/`，基于 Radix 交互原语和统一视觉封装。
- 官网及控制台外壳：`src/components/layout/`。
- 导航规则：`src/lib/navigation.ts`；这里只决定入口显示，不提供后端鉴权。
- 内部预览及样例：`src/preview/`；不会发起业务请求。
- 官网数据：`src/lib/api/` 与 `src/features/`；匿名请求、价格规则和状态转换分开维护。
- 官网首页效果：`src/components/effects/`、`src/styles/marketing.css`，来源见 [素材记录](docs/前端设计/官网素材与动效来源.md)。

实施契约见 [DESIGN.md](DESIGN.md)，组件预览规格见 [页面规格](design/foundation-preview.md)。
