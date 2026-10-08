# 客户官网（frontend-portal）部署

官网、客户控制台和模型调用接口共用一个域名（codu.xyz），由 nginx 入口按路径分流；旧管理后台另绑一个域名（admin.codu.xyz），直接指到后台。两边都经 Cloudflare 隧道接入，服务器只对外开 SSH。官网服务器（Next.js）经内网地址调后台，浏览器从不直接访问后台。

```
用户 / API 客户端
   │ https://codu.xyz                         https://admin.codu.xyz
   ▼                                           ▼
Cloudflare 隧道（cloudflared，令牌模式，公开主机名在 Cloudflare 后台配）
   │ http://127.0.0.1:8088                    │ http://127.0.0.1:8080
   ▼                                           ▼
nginx 入口（edge）                           sub2api（后台 + 自带的管理前端）
   ├─ /api/v1、/v1、/v1beta、/backend-api、/antigravity、/models、/responses、/images、
   │  不带 /v1 的模型调用别名、其余 /api/*            → sub2api :8080
   └─ /api/portal/*、/_next/* 与其余路径（官网页面、控制台）→ 官网 :3000 ──内网──▶ sub2api
```

文件：`deploy/portal-edge/compose.portal.yaml`（叠加在 `deploy/docker-compose.yml` 上，加官网与入口两个服务）、`deploy/portal-edge/nginx/`（入口配置）、`frontend-portal/Dockerfile`（官网镜像）。

## 1. 构建镜像

和上一次部署一样，把干净的源码包传到服务器上构建（服务器在海外，依赖源直接用官方的；本机构建会把 `.fleet`、各处依赖目录都打进构建上下文）：

```bash
# 本机：打包当前提交
git archive --format=tar.gz -o codu-src-<提交>.tar.gz HEAD
# 服务器：解压到 /opt/sub2api-enterprise/source-<提交> 后
docker build -t sub2api-enterprise:<提交> --build-arg COMMIT=<提交> \
  --build-arg GOPROXY=https://proxy.golang.org,direct --build-arg GOSUMDB=sum.golang.org source-<提交>
docker build -t sub2api-enterprise-portal:<提交> --build-arg NPM_REGISTRY=https://registry.npmjs.org source-<提交>/frontend-portal
```

国内构建时去掉这几个参数即可（默认走 goproxy.cn 与 npmmirror）。

## 2. 运行

```bash
cd deploy   # 服务器上是 /opt/sub2api-enterprise
docker compose -f docker-compose.yml -f portal-edge/compose.portal.yaml up -d --wait
```

| 变量 | 说明 |
|---|---|
| `PORTAL_IMAGE` | 官网镜像（必填，写明确的版本标签） |
| `NGINX_IMAGE` | 入口镜像，默认 `nginx:stable-alpine`，生产钉成摘要 |
| `PORTAL_BIND_HOST` / `PORTAL_EDGE_PORT` | 入口在主机上的监听，默认 `127.0.0.1:8088`，只给本机的 cloudflared 连 |

- 官网健康检查 `GET /api/portal/health`（只看进程，不连后台；后台暂时连不上时官网照样能打开，不会被反复重启）。入口自己的健康检查查 `/api/health`，被转到同一个地址。
- 入口的配置模板在容器启动时展开：改了 `portal.conf.template` 要 `restart edge`，只 `up` 不会重建。

## 3. 入口分流与真实 IP

- 模型调用的各种写法都交给后台：带 `/v1` 的、Gemini 的 `/v1beta`、Codex 直连 `/backend-api`、`/antigravity`，以及不带 `/v1` 前缀的 `/models`、`/responses`、`/images`、`/chat/completions`、`/messages/count_tokens` 等（后者转成 `/v1` 再交给后台）。官网的模型页因此用 `/catalog`，不和后台的 `/models` 抢路径。
- 流式回复：交给后台的路径都关了缓冲，超时 30 分钟，边生成边转发。
- 真实 IP：cloudflared 从本机经端口映射连进来，入口看到的来源是容器网关地址；真实用户 IP 在 Cloudflare 带的 `CF-Connecting-IP` 里。入口先用它还原出用户 IP（只信任容器网段与本机发来的这个头），再以 `X-Forwarded-For` 交给后台和官网，并清掉客户端自带的同类头。后台按这个 IP 限流（登录每分钟 20 次，注册、发验证码、找回密码每分钟 5 次）、记审计日志；不还原的话所有用户都会被当成同一个地址一起限流。

## 4. 后台要改的配置

1. **站点前端地址、接口地址**：都填 `https://codu.xyz`（重置密码邮件里的链接、管理前端显示的接口地址）。
2. **模型广场**：要打开，并有渠道把对外卖的模型挂到分组上，官网首页、模型页、价格页才有模型和价格。渠道不填价格时，展示和扣费都按全局价格表，不改变现有计费。
3. **对外服务状态**（可用率，可选）：打开并建渠道监测，监测项名称写模型名、分组标签写分组名。
4. **谷歌登录**（可选）：Google Cloud「Web 应用」客户端的重定向 URI 与后台的谷歌回调都填 `https://codu.xyz/api/portal/auth/oauth/google/callback`。
5. **人机验证**（可选）：Cloudflare Turnstile 小组件的允许主机名加 `codu.xyz`；后台打开 Turnstile、填站点公钥和密钥。
6. **邮箱验证、找回密码**：要先配好发信服务（SMTP），否则开不了。
7. **后台版本**：官网控制台用到的用量总览、余额汇总与流水、邀请返利自动到账等接口，需要提交 3f232ca1d（2026-10-04）及之后的后台；这几项没有数据库结构变化。

## 5. 升级与回滚

- 升级前先备份：数据库导出（`pg_dump`）加 `.env`、编排与入口配置，放在 `/opt/sub2api-enterprise/backups/<时间>/`，数据库导出另拉一份回本机。
- 升级：改 `.env` 里的 `SUB2API_IMAGE`、`PORTAL_IMAGE` 为新版本，`docker compose up -d --wait sub2api portal`（只改了官网时只重建官网镜像，`up -d --no-deps --wait portal`）。后台重启约十几秒，官网几秒。换完容器执行 `docker compose exec edge nginx -s reload`：入口每 30 秒才重新解析一次容器地址，不重载可能有半分钟转到旧地址；重载不断开现有连接。
- 回滚：把这两个镜像改回上一个版本标签再 `up -d`；入口配置从备份目录拷回后 `restart edge`。服务器上至少保留上一版镜像。
- 改 Cloudflare 公开主机名会立刻生效；回退时把官网域名指回原来的地址即可。

## 6. 上线后检查

- `https://codu.xyz`、`/catalog`、`/pricing` 有模型和价格；`/api/portal/health` 返回 200；`curl -I https://codu.xyz` 带 `X-Frame-Options`、`Strict-Transport-Security` 等安全响应头。
- `https://admin.codu.xyz` 是管理后台。
- 新邮箱注册、登录，进控制台把各页点一遍。
- 用 API 密钥请求 `https://codu.xyz/v1/models` 返回模型列表；一次流式对话边生成边显示；控制台日志页能看到这次调用，记录的 IP 是用户的真实 IP。

## 7. 生产部署记录

- 2026-10-08：codu 服务器从 9-27 的旧版（提交 ec4a85840，重做前的旧官网）升到 b3beb6d75（新官网 + 后台），镜像在服务器上构建；入口补「从 CF-Connecting-IP 还原真实 IP」并把健康检查转到新官网；后台填站点前端地址与接口地址；新建 OpenAI 渠道挂到「企业独享」分组（12 个 GPT 模型，价格按全局价格表）并打开模型广场；codu.xyz 改指入口 8088，admin.codu.xyz 指后台 8080（Cloudflare 公开主机名由用户改）。备份在服务器 `backups/pre-portal-20261008-093020/`，数据库导出另存本机。
- 2026-10-08 下午：官网升到 d7b2eef09（分组旁直接写倍率 ×0.3、模型页与价格页页首写「充值 1 元 = 1 美元」、控制台「折扣」列改「官方价」），后台不变（b3beb6d75）。只在服务器上重建官网镜像，换官网后入口 `nginx -s reload`，切换 6 秒，入口没有出错的请求；经公网核对中英文页首小字与倍率写法。备份在服务器 `backups/pre-rate-20261008-163911/`（`.env` 与数据库导出）。
