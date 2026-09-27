# 独立客户前端部署

所属：[M5 部署与验收](../docs/roadmap.md#m5) · [模块设计](../docs/模块设计/部署与验收.md)

此目录只部署客户网站及入口代理，连接已经运行的 Sub2API。原后台和数据库继续独立维护。`/catalog` 是网站模型目录，`/models` 保留给模型 API。

## 部署前需要的地址

在本目录把 `.env.example` 复制为 `.env`，填写镜像版本、Go 内部地址、官网公开地址和监听端口。该文件不提交。当前模板默认只监听回环地址，由已有 HTTPS 入口转发；不要直接把数据库或内部 Go 服务暴露到公网。

| 配置                  | 填写内容                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `PORTAL_IMAGE`        | 本次明确版本的前端镜像；保留上一版标签用于回退                        |
| `PORTAL_BACKEND_URL`  | 容器中可访问的 Go 地址，例如 `http://backend:8080`                    |
| `PORTAL_PUBLIC_URL`   | 用户实际访问的站点原点，例如 `https://portal.example.com`；不带路径   |
| `GO_UPSTREAM`         | Nginx 可访问的 Go 内部主机与端口，例如 `backend:8080`；不带协议或路径 |
| `PORTAL_BIND_ADDRESS` | 默认 `127.0.0.1`，配合已有 HTTPS 入口                                 |
| `PORTAL_HTTP_PORT`    | 默认 `8088`                                                           |

示例地址不能直接用于生产。Docker 内的 `127.0.0.1` 指容器自身。使用 WSL Docker 时，`host.docker.internal` 指 Linux Docker 主机，不等同于 Windows 上监听回环地址的开发服务。若 Go 在其他 Compose 项目中，使用容器可访问的内部地址，或把两边接入同一专用网络。

Go 的网站前端地址、支付完成页、OAuth 回调及 WebAuthn 站点配置也必须与实际域名相符。这里提供配置位置和验证方法，不会自动覆盖底座配置。

## 构建与首次启动

从仓库根目录执行。以下为本项目 Windows + WSL Docker 的命令；正式 Linux Docker 主机可直接执行其中的 `docker` 命令。

```powershell
pnpm --dir frontend-portal check
wsl.exe -d Ubuntu-24.04 --cd /mnt/c/code/sub2api-enterprise docker build --file frontend-portal/Dockerfile --tag sub2api-portal:版本号 frontend-portal
```

将 `.env` 的镜像版本设为刚构建的标签，再运行：

```powershell
wsl.exe -d Ubuntu-24.04 --cd /mnt/c/code/sub2api-enterprise docker compose --project-name sub2api-portal --env-file frontend-portal/deploy/.env --file frontend-portal/deploy/compose.yaml config --quiet
wsl.exe -d Ubuntu-24.04 --cd /mnt/c/code/sub2api-enterprise docker compose --project-name sub2api-portal --env-file frontend-portal/deploy/.env --file frontend-portal/deploy/compose.yaml up -d --wait
```

镜像内部单独安装 Linux 依赖，Windows 的 `node_modules` 和本地环境文件不参与镜像构建。运行服务使用普通用户。地址在启动时注入，同一镜像可连接不同环境。

## 上线检查

| 检查                                    | 预期                                         |
| --------------------------------------- | -------------------------------------------- |
| `GET /api/health`                       | 新前端健康 JSON，禁止缓存                    |
| `GET /health`                           | Go 健康响应                                  |
| `GET /`、`/catalog`、`/status`、`/help` | 新网站页面；价格和状态取已启用的底座配置     |
| `GET /api/v1/settings/public`           | Go 的公开配置 JSON                           |
| `GET /api/portal/settings/public`       | 新前端代理的配置 JSON                        |
| 无密钥访问 `/v1/models`、`/models`      | Go 的鉴权错误，不能返回网页 HTML             |
| `POST /v1/responses` 等推理路径         | 直达 Go，流式响应不被前端缓冲                |
| WebSocket 模型入口                      | 升级请求通过，连接可保持                     |
| 个人／组织管理员／普通成员              | 导航、消费归属和可操作范围正确               |
| 登录、找回密码、充值回跳                | 最终停留在客户站域名；余额以订单实际到账为准 |

TLS 由外层已有入口负责。外层需要保留 Host，并支持模型长连接；其超时或缓存设置也会影响流式调用。新前端转给底座的可信网站原点来自 `PORTAL_PUBLIC_URL`。入口清除来访者伪造的转发身份头，默认把直连对端作为来源；有真实 IP 需求时，按实际可信代理网段单独配置，不直接信任任意请求头。

HTTP 访问日志仅记录路径和状态，不记录查询字符串、来源页、Authorization 或请求体，避免登录回调和重置密码链接中的令牌进入访问日志。排障期间也不要开启带完整凭据的调试日志。

## 原后台独立入口

后台使用单独域名，整站指向原 Go 服务。`nginx/management.conf.example` 给出同一 Nginx 的可选配置；使用前填入真实管理域名，作为模板挂载并允许相同环境替换。该文件默认不加载。

如果由现有反向代理直接承接管理域名，可继续沿用原入口。客户站的网页路径不会自动提供原管理页；访问管理功能应使用管理域名。

## 升级与回退

每次使用新的版本标签，保留上一版镜像和 `.env` 的非敏感版本记录。远程仓库镜像先执行 `docker compose … pull portal`；本机构建的镜像不用拉取。

修改 `.env` 中的 `PORTAL_IMAGE`，执行同一条 `up -d --wait`，确认健康检查、静态资源、公开配置及账号查询正常。入口使用 Docker DNS 定期重新解析地址，更新前端容器不依赖旧容器 IP。

需要回退时把 `PORTAL_IMAGE` 改回上一版标签，再执行 `up -d --wait`，重新检查 `/api/health`、`/catalog` 和已登录控制台。前端版本替换不包含数据库迁移。不能用删除卷、清理数据库或强制回滚 Go 的方式回退网站。

静态文件和页面产物位于同一镜像。多实例滚动发布时应在外部入口保持版本一致或提供旧静态文件，避免旧页面在新容器上找不到旧脚本；本模板默认单实例。

## 不使用 Docker 的运行方式

在目标系统单独安装依赖并构建，不能把 Windows 依赖复制到 Linux。生产构建输出在 `.next-build`，开发服务输出在 `.next`，两者互不覆盖。

```powershell
pnpm --dir frontend-portal install --frozen-lockfile
pnpm --dir frontend-portal build
$env:SUB2API_INTERNAL_URL = 'http://127.0.0.1:8080'
$env:PORTAL_PUBLIC_URL = 'https://portal.example.com'
$env:HOSTNAME = '127.0.0.1'
$env:PORT = '3000'
pnpm --dir frontend-portal start
```

启动命令会把静态资源复制到独立产物目录，再运行服务。若直接运行产物，先执行 `pnpm prepare:standalone`，连同整个 `.next-build/standalone` 目录一起交付。

## 自动检查与验收边界

仓库中的 Portal CI 对新前端执行格式、静态分析、严格类型、单元测试、生产构建、资源准备及镜像构建。CI 不会推送镜像或替换线上服务。

本地隔离底座和模拟上游可以验证权限、消费统计、支付通知处理及传输行为。真实第三方登录、设备通行密钥和支付供应商需要对应测试配置；正式域名的 TLS、外层代理、支付回调和容量须在指定目标上验收。具体已验证结果和未验项目记录于[部署与验收模块](../docs/模块设计/部署与验收.md)。
