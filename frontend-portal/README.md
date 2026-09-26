# 独立客户前端

基于既有 Sub2API 业务的新官网与客户控制台。开发顺序见 [路线图](docs/roadmap.md)，本轮实施 [M0 工程与共享界面](docs/模块设计/工程与共享界面.md)。

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

M0 的 `/` 暂返回未找到页面；正式业务页面按后续里程碑实现，内部预览不替代业务首页。

## 工程边界

- 主题：`src/styles/`，颜色、字体、尺寸与断点统一配置。
- 基础控件：`src/components/ui/`，基于 Radix 交互原语和统一视觉封装。
- 官网及控制台外壳：`src/components/layout/`。
- 导航规则：`src/lib/navigation.ts`；这里只决定入口显示，不提供后端鉴权。
- 内部预览及样例：`src/preview/`；不会发起业务请求。
- 业务接口沿用既有后端，当前阶段尚未接入。

实施契约见 [DESIGN.md](DESIGN.md)，组件预览规格见 [页面规格](design/foundation-preview.md)。
