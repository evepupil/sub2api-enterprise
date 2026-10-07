# 客户官网（frontend-portal）部署

官网、客户控制台和模型调用接口共用一个域名（如 `codu.xyz`），入口反向代理按路径分流；旧管理后台另绑一个域名，整站交给 sub2api。官网服务器（Next.js）经内网地址调后台，浏览器从不直接访问后台。

```
浏览器 / API 客户端
   │  https://codu.xyz
   ▼
入口反向代理（Caddy）
   ├─ /v1/* /v1beta/* /backend-api/* /antigravity/* /api/v1/* /api/event_logging/*  →  sub2api :8080（生产先过 ACF 安全网关）
   └─ 其余路径（官网页面、控制台、官网接口 /api/portal/*）                             →  官网 :3000
                                                                                         │ SUB2API_INTERNAL_URL
                                                                                         ▼
                                                                                   sub2api（内网）
```

## 1. 构建镜像

```bash
cd frontend-portal
docker build -t sub2api-enterprise-portal:<版本> .
```

- 依赖默认走 npmmirror；海外构建加 `--build-arg NPM_REGISTRY=https://registry.npmjs.org`。
- 基础镜像拉不下来时用本地或镜像源里的 Node 24：`--build-arg NODE_IMAGE=node:24.18.0-alpine`。
- 不走镜像仓库时和后台一样：`docker save sub2api-enterprise-portal:<版本> | gzip > portal.tar.gz`，传到服务器后 `docker load < portal.tar.gz`。

## 2. 运行

`deploy/docker-compose.yml` 里的 `portal` 服务，可调的环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORTAL_IMAGE` | `sub2api-enterprise-portal:latest` | 镜像与版本标签 |
| `PORTAL_BIND_HOST` / `PORTAL_PORT` | `127.0.0.1` / `3000` | 主机上的监听地址；入口代理在主机上时只听本机 |
| `PORTAL_BACKEND_URL` | `http://sub2api:8080` | 官网服务器调后台的内网地址（容器里叫 `SUB2API_INTERNAL_URL`）；不填时登录与控制台接口返回「服务暂时不可用」 |

健康检查：`GET /api/portal/health` 返回 `{"ok":true}`。它只看官网进程在不在、不连后台——后台暂时连不上时官网页面照样能打开，不会因此反复重启。

## 3. 入口分流

模板见 `deploy/Caddyfile.portal`（已用 `caddy validate` 校验）：

- 交给后台的路径：`/v1/*`、`/v1beta/*`（OpenAI、Anthropic、Gemini 各家接口）、`/backend-api/*`（Codex 直连）、`/antigravity/*`、`/api/v1/*`（后台接口，以后的支付回调也走这里）、`/api/event_logging/*`（Claude Code 遥测上报）。其余路径全部给官网。
- 流式回复：模型调用那段 `flush_interval -1`，压缩只列具体类型，不能写 `text/*`（否则 `text/event-stream` 被压缩攒包，看起来卡住）；长对话与生图的超时放宽到 10～15 分钟。
- 生产服务器（141.11.138.251）现状是 Caddy 先把流量交给 ACF 安全网关（`acf-gateway:8080`）再到 sub2api：模型调用那段的上游写网关地址；官网那段写 `sub2api-portal:3000`（Caddy 接在 sub2api 的容器网络里）或 `localhost:3000`（Caddy 在主机上）。

## 4. 后台要改的配置

1. **可信代理**：`SERVER_TRUSTED_PROXIES`（或配置文件 `server.trusted_proxies`）加上容器网络的网段，例如 `172.16.0.0/12`。官网把用户真实 IP 放在 `X-Forwarded-For` 里转给后台，后台按 IP 限流（登录每分钟 20 次，注册、发验证码、找回密码每分钟 5 次）；不加的话所有用户都会被当成官网容器这一个 IP，很快一起被限流。
2. **站点前端地址**：系统设置填 `https://codu.xyz`，重置密码邮件里的链接才会落到官网。
3. **谷歌登录**：Google Cloud「Web 应用」客户端的「已获授权的重定向 URI」与后台设置里的谷歌回调地址都填 `https://codu.xyz/api/portal/auth/oauth/google/callback`。
4. **人机验证**：Cloudflare Turnstile 小组件的允许主机名加上 `codu.xyz`；后台打开 Turnstile，填站点公钥和密钥（只能开一家，腾讯、阿里的验证码官网不支持）。
5. **官网展示数据**：后台打开「模型广场」（模型与价格）和「对外服务状态」（可用率：监测项名称写模型名、分组标签写分组名）。
6. **站名**：系统设置里的站点名称改成 Codu（邮件模板里用到）。
7. **后台版本**：官网控制台用到的用量总览、余额汇总与流水、邀请返利自动到账等接口，后台要包含提交 3f232ca1d（2026-10-04）及之后的版本；这几项没有数据库结构变化。

## 5. 升级与回滚

- 升级：`docker load` 新镜像 → 改 `PORTAL_IMAGE` → `docker compose up -d portal`，切换只有几秒。想零中断可先用别的端口起新容器试跑，确认后再把入口代理指过去。
- 回滚：`PORTAL_IMAGE` 改回上一个版本标签，再 `docker compose up -d portal`。服务器上至少保留上一版镜像。
- 官网与后台可以分开升级；后台先升（新接口向前兼容），官网后升。

## 6. 上线后检查

- `https://codu.xyz`、`/catalog`、`/pricing` 有模型和价格；`/api/portal/health` 返回 200；`curl -I https://codu.xyz` 带 `X-Frame-Options`、`Strict-Transport-Security` 等安全响应头。
- 用新邮箱注册、登录，进控制台把各页点一遍；找回密码邮件里的链接能打开官网的重置页。
- 用 API 密钥请求 `https://codu.xyz/v1/models` 返回模型列表；一次流式对话能边生成边显示；控制台日志页能看到这次调用。
