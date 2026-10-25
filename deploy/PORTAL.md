# 客户官网（frontend-portal）部署

官网、客户控制台和模型调用接口共用一个域名（codu.xyz），由 nginx 入口按路径分流；旧管理后台另绑一个域名（生产上 2026-10-25 起是 admin1.codu.xyz），直接指到后台。两边都经 Cloudflare 隧道接入。仓库里还有一个可选的直连域名入口（不经 Cloudflare、直接解析到服务器，只接模型调用，见 3.1）；生产 2026-10-25 迁到首尔机后不开直连（那台的 80/443 给别的项目用），只走隧道。官网服务器（Next.js）经内网地址调后台，浏览器从不直接访问后台。

生产现状（2026-10-25 起）：首尔机 43.133.242.12，部署目录 `/opt/sub2api-enterprise`，容器名加 `codu-` 前缀、各容器设内存上限、隧道连接器也作为容器跑在编排里；那台机器同时跑着用户别的项目。细节见服务器上的 DEPLOYMENT.md，迁移经过见第 7 节。

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

API 客户端
   │ https://api.codu.xyz（DNS 直接指到服务器，不经 Cloudflare）
   ▼
服务器 443 → nginx 入口（edge）的直连入口
   ├─ /v1/*、/v1beta/*                 → sub2api :8080
   ├─ 其余路径                          → 404
   └─ 用 IP 直连或别的域名              → 握手时拒绝
```

文件：`deploy/portal-edge/compose.portal.yaml`（叠加在 `deploy/docker-compose.yml` 上，加官网与入口两个服务）、`deploy/portal-edge/compose.api-direct.yaml`（再叠一层，给入口加直连域名）、`deploy/portal-edge/nginx/`（入口配置）、`frontend-portal/Dockerfile`（官网镜像）。

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
# 要直连域名时再叠一层（见 3.1）
docker compose -f docker-compose.yml -f portal-edge/compose.portal.yaml -f portal-edge/compose.api-direct.yaml up -d --wait
```

| 变量 | 说明 |
|---|---|
| `PORTAL_IMAGE` | 官网镜像（必填，写明确的版本标签） |
| `NGINX_IMAGE` | 入口镜像，默认 `nginx:stable-alpine`，生产钉成摘要。镜像要带 nginx 官方的证书模块（`ngx_http_acme_module`，生产钉的 1.30.5 镜像带），入口配置会加载它 |
| `PORTAL_BIND_HOST` / `PORTAL_EDGE_PORT` | 入口在主机上的监听，默认 `127.0.0.1:8088`，只给本机的 cloudflared 连 |
| `API_DIRECT_HOST` | 直连域名（叠了 `compose.api-direct.yaml` 时必填），如 `api.codu.xyz` |
| `ACME_DIRECTORY` | 证书从哪申请，默认 Let's Encrypt 正式环境；试跑可换测试环境 `https://acme-staging-v02.api.letsencrypt.org/directory` |
| `API_DIRECT_BIND` / `API_DIRECT_PORT` | 直连入口在主机上的监听，默认 `0.0.0.0:443`（只开 IPv4） |

- 官网健康检查 `GET /api/portal/health`（只看进程，不连后台；后台暂时连不上时官网照样能打开，不会被反复重启）。入口自己的健康检查查 `/api/health`，被转到同一个地址。
- 入口的配置模板在容器启动时展开：改了 `portal.conf.template` 要 `restart edge`，只 `up` 不会重建。

## 3. 入口分流与真实 IP

- 模型调用的各种写法都交给后台：带 `/v1` 的、Gemini 的 `/v1beta`、Codex 直连 `/backend-api`、`/antigravity`，以及不带 `/v1` 前缀的 `/models`、`/responses`、`/images`、`/chat/completions`、`/messages/count_tokens` 等（后者转成 `/v1` 再交给后台）。官网的模型页因此用 `/catalog`，不和后台的 `/models` 抢路径。
- 流式回复：交给后台的路径都关了缓冲，超时 30 分钟，边生成边转发。
- 真实 IP：cloudflared 从本机经端口映射连进来，入口看到的来源是容器网关地址；真实用户 IP 在 Cloudflare 带的 `CF-Connecting-IP` 里。入口先用它还原出用户 IP（只信任容器网段与本机发来的这个头），再以 `X-Forwarded-For` 交给后台和官网，并清掉客户端自带的同类头。后台按这个 IP 限流（登录每分钟 20 次，注册、发验证码、找回密码每分钟 5 次）、记审计日志；不还原的话所有用户都会被当成同一个地址一起限流。

### 3.1 直连域名（不经 Cloudflare）

国内经 Cloudflare 常被掐连接，所以另开一个直连域名给 API 客户端用（2026-10-12 用户要求）。它只接模型调用，官网、控制台、管理后台照旧走 Cloudflare。

- **DNS**：只加一条 A 记录指到服务器 IP，代理状态关掉（灰色云朵，「仅 DNS」）。不加 IPv6 记录（AAAA）：IPv6 经 Docker 转发进容器时看不到用户 IP。
- **端口**：入口对外加开 443（只开 IPv4），容器里是 8443。80 不用开。
- **证书**：入口 nginx 自带的证书模块向 Let's Encrypt 申请、到期前自动续，不用另装工具，也不用定时任务。验证走 443 本身（tls-alpn-01）。申请记录和证书存在数据卷 `edge-acme`，重建容器不会重新申请；删掉数据卷就会重新申请（Let's Encrypt 对同一域名每周签发次数有上限）。证书签好之前，入口日志里会有几条 `cannot load certificate`，签好后就没有了。
- **只放模型调用**：`/v1/` 与 `/v1beta/`（Gemini 原生接口）开头的转给后台，其余路径一律 404。用 IP 直连或别的域名指过来的，握手时直接拒绝；证书对、请求里写别的域名的，直接断开。
- **流式**：和隧道入口的模型调用一样关缓冲、超时 30 分钟，边生成边转发；请求体不限大小，由后台自己限。
- **真实 IP**：直连时连接来源就是用户 IP（Docker 端口映射保留来源地址），客户端自带的 `X-Forwarded-For`、`CF-Connecting-IP` 等一概不信，入口用连接来源重写后交给后台，防止伪造 IP 绕过限流。
- **风险**：直连等于公开了服务器 IP。被攻击时没有 Cloudflare 挡着，整台机器（官网、后台）都受影响。这个 IP 或域名要是被墙，断的只是直连这一路，codu.xyz 走 Cloudflare 隧道不受影响。
- **本机验证**：用 Let's Encrypt 官方的测试证书服务（Pebble）加回显后台，把上面几条连同重启后不重新申请证书、HTTP/2 都验过一遍。

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
- 入口加减端口（比如开、关直连入口）要重建入口容器（`up -d --no-deps --wait edge`），codu.xyz 会断几秒、正在输出的请求会中断，挑人少的时候做。关直连入口：编排里去掉直连那几项再重建入口，证书数据卷留着，下次再开不用重新申请。
- 改 Cloudflare 公开主机名会立刻生效；回退时把官网域名指回原来的地址即可。

## 6. 上线后检查

- `https://codu.xyz`、`/catalog`、`/pricing` 有模型和价格；`/api/portal/health` 返回 200；`curl -I https://codu.xyz` 带 `X-Frame-Options`、`Strict-Transport-Security` 等安全响应头。
- `https://admin.codu.xyz` 是管理后台。
- 新邮箱注册、登录，进控制台把各页点一遍。
- 用 API 密钥请求 `https://codu.xyz/v1/models` 返回模型列表；一次流式对话边生成边显示；控制台日志页能看到这次调用，记录的 IP 是用户的真实 IP。
- 直连域名：`curl -sv https://api.codu.xyz/v1/models` 证书是 Let's Encrypt 签的、不带密钥回 401；`/api/v1/settings/public`、`/` 回 404；`curl -k https://<服务器 IP>/` 握手失败；入口访问日志（`docker compose logs edge`）里直连请求的来源是用户的公网 IP，不是 172 开头的容器地址。

## 7. 生产部署记录

- 2026-10-08：codu 服务器从 9-27 的旧版（提交 ec4a85840，重做前的旧官网）升到 b3beb6d75（新官网 + 后台），镜像在服务器上构建；入口补「从 CF-Connecting-IP 还原真实 IP」并把健康检查转到新官网；后台填站点前端地址与接口地址；新建 OpenAI 渠道挂到「企业独享」分组（12 个 GPT 模型，价格按全局价格表）并打开模型广场；codu.xyz 改指入口 8088，admin.codu.xyz 指后台 8080（Cloudflare 公开主机名由用户改）。备份在服务器 `backups/pre-portal-20261008-093020/`，数据库导出另存本机。
- 2026-10-08 下午：官网升到 d7b2eef09（分组旁直接写倍率 ×0.3、模型页与价格页页首写「充值 1 元 = 1 美元」、控制台「折扣」列改「官方价」），后台不变（b3beb6d75）。只在服务器上重建官网镜像，换官网后入口 `nginx -s reload`，切换 6 秒，入口没有出错的请求；经公网核对中英文页首小字与倍率写法。备份在服务器 `backups/pre-rate-20261008-163911/`（`.env` 与数据库导出）。
- 2026-10-08 晚上：官网升到 084d91bb1（控制台铃铛接后台「公告管理」，顶部公告条与示例通知删掉），后台不变（b3beb6d75）。只重建官网镜像（新加了 Markdown 显示的依赖），换官网后重载入口，切换 6 秒，入口没有出错的请求；经公网核对公告的两个官网接口在（没登录回 401）。备份在服务器 `backups/pre-bell-20261008-224227/`（`.env`、数据库导出、上一版 DEPLOYMENT.md）。
- 2026-10-09 下午：官网升到 49d2e3075（密钥表单的分组下拉照原版 sub2api 写分组描述、倍率与高峰加价；弹窗里的下拉滚轮滚不动修好，用户反馈），后台不变（b3beb6d75）。只重建官网镜像，换官网后重载入口，切换 7 秒，入口没有出错的请求。备份在服务器 `backups/pre-groups-20261009-154803/`（`.env`、数据库导出、上一版 DEPLOYMENT.md）。
- 2026-10-09 晚上：官网升到 3cac1579d（充值走卡网：账单页「充值」「购买兑换码」打开后台「充值链接」里的店铺；用量页标题行加可用余额），后台不变（b3beb6d75）。后台设置「余额不足提醒 → 充值链接」由 https://codu.xyz 改成卡网店铺 https://catfk.com/shop/W24ODYB1。只重建官网镜像，换官网后重载入口，切换 6 秒，入口没有出错的请求；经公网核对官网读到的充值链接就是店铺地址。备份在服务器 `backups/pre-recharge-20261009-194232/`。同日渠道按分组账号重配（模型广场与官网价格页的模型），改前的渠道配置备份在 `backups/pre-channels-20261009-184337/`、`backups/pre-guankey-20261009-191511/`。
- 2026-10-11：用户要求分组名去掉「共享通道」「专用通道」（客户总问区别，实际差别不大），直接改库改了 7 个分组（如 gemini-共享通道 → gemini、claude-max-专用通道 → claude-max）。改名只改显示，密钥、渠道、计费都按分组编号走；官网约 1 分钟后显示新名字。两个 claude-kiro 分组去掉后缀会重名，等用户定。镜像不变。备份在服务器 `backups/pre-rename-groups-20261011-071504/`。
- 2026-10-14：开直连域名 api.codu.xyz（3.1，入口配置 1bf26d43f），镜像不变。A 记录由用户在 Cloudflare 加，直接指服务器。服务器的入口编排加 443 端口、直连模板与证书数据卷，重建入口用了 6.5 秒，codu.xyz 实际只断了不到 1 秒；Let's Encrypt 证书上线后几秒内签好（2027-01-12 到期，自动续）。经公网核对：不带密钥调 `/v1/models`、`/v1beta/models` 回 401，其余路径 404，IP 直连与别的域名握手被拒，80 连不上；后台日志里直连请求的来源是用户的真实公网 IP，伪造的 IP 头没传进去；国内直连建连约 0.3 秒。备份在服务器 `backups/pre-api-direct-20261014-155018/`。
- 2026-10-25：生产从美国机（40.160.143.121，4 核 8G）迁到用户的首尔机（43.133.242.12，腾讯云 2 核 3.3G，同时跑着用户别的项目）。后台升到 889ce7804（线上 b3beb6d75 + 转换线路断流修复，见技术设计 18.13），官网不变（3cac1579d）。镜像在美国编好后直传首尔（两台之间几百 MB 十几秒；本机到美国很慢，大文件别经本机中转），数据库、缓存、入口按美国用的摘要在首尔拉。首尔先用一份库拷贝在 18080/18088 试跑通过；切换时美国停写入，数据库、后台数据卷（自动生成的 config.yaml、价格表）、缓存数据卷直传首尔，核对数量与余额合计一致后起服务，首尔隧道连上再停美国隧道。停服 2 分 12 秒，客户不用重新登录。首尔不开直连；隧道连接器作为 `codu-cloudflared` 容器跑在编排里（宿主机网络，监控端口 20251）。上线后经 codu.xyz 正式线路验证断流修复（临时假上游、专属分组、管理员密钥，测完删除并退回扣费）：上游 130 秒不出字时收到 12 次心跳、正常收完，补丁慢吐时分 25 段实时送达、正常收完。本机每小时备份加上首尔（来源 `codu-prod`，`useSudo: true`）。美国机容器已停、数据保留一周备回退，备份在美国机 `backups/pre-seoul-20261025-064457/`。
