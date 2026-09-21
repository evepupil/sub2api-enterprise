# 数据库定时同步

把远端 sub2api 各环境的数据库定时拉回本机，每个环境只留**本次**和**上次**两份。
主要用途是保住用户余额这类没法重新生成的数据。

## 它做什么

每个来源固定走四步，任何一步失败都不会动已有的备份：

1. **远端导出**：在目标机器上对数据库容器执行 `pg_dump`（自定义格式 + zstd 压缩），同时算好 SHA256。
2. **下载**：用 `scp` 拉回本机的暂存目录。
3. **校验**：本地重算 SHA256 与远端比对，不一致就丢弃本次结果。
4. **轮转**：校验通过后才把暂存目录提升为 `current`，原来的 `current` 退为 `previous`，更早的删掉。

除了数据库文件，每份快照还额外带一个 `users-balance.csv`，里面只有余额相关字段
（账号、状态、余额、冻结余额、累计充值），不用还原整个库就能直接看余额。
密码哈希、TOTP 密钥这类敏感字段不会进这个 CSV。

## 本地目录结构

```
<destinationRoot>/
  sync.log                 运行日志，超过 5000 行自动截断
  prod/
    current/               最新一份
      sub2api.dump         数据库导出文件
      users-balance.csv    余额明细
      meta.json            这份快照的时间、大小、校验值、用户数、余额合计
    previous/              上一份，结构相同
  box/
    current/
    previous/
```

## 配置

配置文件放在仓库外，默认路径 `%USERPROFILE%\.sub2api\db-sync.config.json`，
这样服务器地址和密钥路径不会进代码库。照着 `db-sync.config.example.json` 改即可。

| 字段 | 说明 |
| --- | --- |
| `destinationRoot` | 本地存放目录，支持 `%USERPROFILE%` 这类环境变量 |
| `retainSnapshots` | 保留份数，默认 2（本次 + 上次） |
| `sources[].name` | 来源名称，同时是本地子目录名 |
| `sources[].enabled` | 设为 `false` 可临时停掉某个来源 |
| `sources[].sshHost` | `~/.ssh/config` 里的主机别名，或直接写地址 |
| `sources[].port` / `sshUser` / `identityFile` | 不用别名时才需要填 |
| `sources[].containerName` | 目标机器上 PostgreSQL 容器名 |
| `sources[].databaseUser` / `databaseName` | 数据库账号与库名 |

推荐在 `~/.ssh/config` 里配好主机别名，把端口、密钥、保活参数都写进去，
配置文件里只留一个别名，脚本这边就不用关心连接细节。

## 运行

```powershell
# 同步全部来源
pwsh -File sync-db.ps1

# 只同步其中一个
pwsh -File sync-db.ps1 -Only box

# 指定其他配置文件
pwsh -File sync-db.ps1 -ConfigPath D:\somewhere\db-sync.config.json
```

## 定时任务

```powershell
# 注册，默认每小时一次
pwsh -File install-task.ps1

# 改间隔
pwsh -File install-task.ps1 -IntervalHours 2

# 删除
pwsh -File install-task.ps1 -Remove
```

默认跟随登录态运行，普通权限就能注册。想让注销后也继续跑，加 `-RunWhenLoggedOff`，
但注册时需要管理员身份的终端。

任务设置了「上一轮没跑完就跳过新一轮」，脚本内部也加了一把全局锁，
两道保险都是为了避免两个进程同时动同一批目录。

## 还原

导出文件是 PostgreSQL 自定义格式，用容器里的 `pg_restore` 还原最省事：

```bash
# 把文件送到目标机器后
docker cp sub2api.dump sub2api-postgres:/tmp/
docker exec sub2api-postgres pg_restore -U sub2api -d sub2api --clean --if-exists /tmp/sub2api.dump
```

只想看余额不想还原，直接打开 `users-balance.csv`。

## 几个设计上的硬约束

这些不是可有可无的细节，每一条都对应一个真实踩过的坑：

- **先校验再轮转**。传输中断拿到半截文件是常态，如果直接覆盖，唯一一份好备份就没了。
  所以新快照一律先落到暂存目录，校验通过才允许顶掉旧的；暂存目录为空时直接拒绝轮转。
- **每一步都能重试**。生产服务器那条线握手超时是常态，实测经常第一次失败第二次就成。
  重试间隔逐次拉长，不会在对端不可用时疯狂打点。
- **每次调用都有硬超时，超时连子进程一起结束**。走 Cloudflare 隧道时 ssh 会拉起
  cloudflared 子进程；在计划任务环境里没有可用的标准输入，ssh 偶尔会挂着不退，
  子进程占住管道，整个任务一直卡在「运行中」，后面每一轮都被跳过。
  所以统一用带超时的方式启动，并且禁止 ssh 读标准输入。
- **一个来源失败不影响其他来源**。生产拉不回来，不该连带本地环境那份也丢掉。
- **远端临时文件无论成败都清理**，避免把对方磁盘撑满。

## 测试

```powershell
pwsh -File tests\Snapshot.Tests.ps1
```

覆盖轮转逻辑和文件校验。轮转是这套脚本里唯一会删除已有备份的地方，
出错的代价是丢掉唯一一份好备份，所以单独覆盖，包括「暂存为空时拒绝轮转且旧快照原样保留」这种边界。

## 文件说明

| 文件 | 职责 |
| --- | --- |
| `sync-db.ps1` | 入口，编排每个来源的导出、下载、校验、轮转 |
| `install-task.ps1` | 注册 / 删除 Windows 计划任务 |
| `lib/Config.psm1` | 读取并校验配置 |
| `lib/Remote.psm1` | ssh / scp 调用，重试与超时 |
| `lib/Snapshot.psm1` | 快照目录与轮转 |
| `lib/Log.psm1` | 日志输出与截断 |
| `tests/Snapshot.Tests.ps1` | 轮转与校验的单测 |
