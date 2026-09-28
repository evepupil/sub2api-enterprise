# 独立客户前端

基于既有 Sub2API 业务的新官网与客户控制台。开发顺序见 [路线图](docs/roadmap.md)，已接入官网、账号、密钥、统计与余额订单，当前验收边界见模块文档。

## 本机要求

使用 Windows Node.js 24 和 pnpm 10.34.5，在本目录安装依赖；依赖、缓存、构建产物与原 `frontend/` 分开。

```powershell
pnpm install --frozen-lockfile
pnpm check
```

检查包括格式、静态分析、严格类型、核心业务测试和生产构建。开发输出 `.next` 与生产输出 `.next-build` 分离。页面外观与实际交互需另做浏览器验收。

## 本地联调

先确认 `.env.local` 中的后端服务已运行，再启动前端。以下使用本项目隔离环境的地址：

```powershell
Invoke-WebRequest http://127.0.0.1:8080/health | Select-Object StatusCode
pnpm dev
```

默认开发命令使用与已验证构建一致的 Webpack，并绑定 `127.0.0.1`。本机访问 `http://127.0.0.1:3000`；开发资源与接口共用下面的访问地址配置，本机两个入口同时保留。

前端开发命令不会代替独立后端服务。登录接口返回 502 时，应先检查后端进程、数据库和内部地址；不要通过清空账号资料或关闭身份校验处理连接问题。前端开发服务与后端都应在各自终端或后台运行，关闭对应进程会中断联调。

### 通过 Cloudflare Tunnel 访问 dev

同机运行的 cloudflared 将服务地址指向 `http://127.0.0.1:3000`，HTTP Host Header 保持默认，让请求携带浏览器访问的域名。

在 `.env.local` 填写实际隧道地址后重启 `pnpm dev`：

```dotenv
PORTAL_PUBLIC_URL=https://dev.example.com
```

这一个地址会同时用于开发资源、热更新连接和接口来源检查。本机 `http://127.0.0.1:3000`、`http://localhost:3000` 仍可使用。第三方登录供应商的回调应配置为这个实际对外地址。

需要增加另一个开发入口时，使用完整 origin（协议、域名及非默认端口），多个用逗号分隔：

```dotenv
PORTAL_DEV_ORIGINS=https://another-dev.example.com,https://your-tunnel.trycloudflare.com
```

额外入口只对开发服务生效；生产接口继续按固定对外地址校验。后端内部地址与隧道无关，继续填写实际可连接的 Sub2API 地址。

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
- `PORTAL_PUBLIC_URL`：浏览器实际访问的门户 origin，用于同源与付款回跳检查。本地示例 `http://127.0.0.1:3000`，生产填写正式 HTTPS 域名。

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

## 客户控制台

本站提供登录、注册、邮件恢复和 `/console` 下的概览、密钥、用量、余额订单、账号设置。客户请求通过 `/api/portal/` 固定代理，组织成员仅使用配额。付款回跳兼容底座的 `/payment/result`，只查询真实订单状态。

底座 `frontend_url` 指向门户公开地址。启用 OAuth 时，供应商登记和底座 redirect URL 均填写 `https://门户域名/api/portal/auth/oauth/<provider>/callback`，provider 支持 github/google/linuxdo/wechat/dingtalk/oidc；前端回调 URL 指向门户 `/auth/.../callback`。供应商回调不要指向另一后端域名，以免 Cookie 断开。通行密钥 RP ID 与站点来源匹配门户域名。

外部登录、验证码、Stripe、Airwallex、微信及支付通知须在对应测试配置中联调后启用。业务实现与本地验证分别见[账号模块](docs/模块设计/账号与密钥.md)、[统计模块](docs/模块设计/用量统计.md)、[余额模块](docs/模块设计/余额与订单.md)。
