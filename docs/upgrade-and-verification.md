# 安全修复版本：升级与验证

## 升级旧版 Docker 部署

旧版程序写入 `/app/server/data`，而 Compose 挂载的是 `/app/data`。**必须在删除或重建旧容器之前导出原数据**：

```bash
docker stop vessel-hub
docker cp vessel-hub:/app/server/data ./vessel-data-before-upgrade
```

保留该目录作为独立的原始副本。检查实际 Compose 挂载目录后，把副本中的 `vessel_db.json`、`apps/` 和 `backups/` 放入新版本的 `./data/`，不要覆盖另一份正在使用的数据。再执行：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

新版本显式使用 `DATA_DIR=/app/data`，并持久化 Caddy 与 Docker registry 配置。原本已改过密码的账号继续使用原密码，登录时旧 SHA-256 密码摘要会迁移到带随机盐的 scrypt。仍使用旧默认密码的账号必须先修改密码，才能访问管理接口。

## 新安装

默认管理员为 `admin`。初始随机密码写在数据目录的 `initial-admin-password` 文件，首次登录后必须修改；成功改密后删除该文件。也可在首次启动前设置至少 12 位的 `VESSEL_ADMIN_PASSWORD`，已有数据库不会因此被重置。不要把该变量或初始密码文件提交到版本库。

```bash
docker exec vessel-hub cat /app/data/initial-admin-password
```

管理 API 和 WebSocket 都需要认证。WebSocket 使用 `vessel` 与 `auth.<token>` 子协议；现有前端已同步更新。上传恢复与普通 API 使用 Authorization 请求头，备份下载链接仅在下载接口接受 token 参数。

## 备份与恢复的语义

- 系统快照保存平台数据库和应用配置，不等同于所有应用卷的业务数据备份。恢复系统快照保留当前管理员凭据与备份目录记录，并重新加载调度。
- 应用卷备份通过 Docker daemon 实际读取 named volume 与可写目录 bind mount，不再只打包 Compose 工作目录。先拉取 `alpine:3.21` 辅助镜像，停止原本运行的应用容器，导出数据，再恢复原运行状态。辅助镜像可用 `VESSEL_BACKUP_IMAGE` 覆盖。
- 当前应用卷归档支持可写目录挂载；只读挂载和 tmpfs 不属于持久化业务数据。可写单文件 bind mount 会明确报错，不会伪装为完整备份。运行中的共享卷若同时被其他项目写入，需由管理员协调停机。
- 数据卷恢复先在临时 Docker volume 中解压，保留恢复前副本，再替换目标目录内容；失败时尝试回滚。回滚失败会保留恢复前副本路径，并停止自动恢复运行，供人工恢复。恢复操作会短暂停机。
- 旧版 ZIP 仍可恢复配置，但不能补回旧版本从未归档的 Docker 数据卷，界面响应会明确说明。
- 数据库备份在 R2 中统一使用 `databases/<appId>/<fileName>`；系统与应用卷分别使用 `system/`、`apps/`。云端删除失败保留本地文件与记录供重试。
- PostgreSQL、MySQL、MariaDB、MongoDB 逻辑恢复需要对应数据库容器。Redis RDB 及其他未支持的逻辑恢复会返回明确错误，不能将其视为成功；可使用应用卷备份保存完整持久化目录。

## 验证命令

```bash
pnpm install --frozen-lockfile
pnpm check
docker build -t vessel:ci .
bash scripts/test-container.sh
VESSEL_DOCKER_TEST=1 node --test server/tests/docker.integration.mjs
```

回归测试隔离 Docker、R2 和真实数据库。Docker 集成测试创建独立容器/卷，验证真实数据往返、恢复后删除新增数据、恢复运行状态，并清理测试资源。CI 包含构建、回归、真实卷往返及容器替换后认证数据持久化验证。

证书状态来自域名的真实 TLS 握手，握手失败显示“未知”；磁盘指标是 `DATA_DIR` 所在文件系统，容器/镜像计数来自 Docker Engine。未连接 Docker 不再显示模拟成功或虚构容量。

## 2026-10-13 补充修复与验证

- 备份记录和归档名使用随机唯一标识，避免并发完成时发生冲突。保留数量分别按应用、备份类型和数据库名称计算；本地删除失败时保留目录记录以便重试。
- 数据库恢复弹窗只显示当前应用的数据库备份；编辑目标数据库不再重置表单。MongoDB 完整归档恢复时不再默认过滤到 `app_db`；单库改名使用 namespace 映射，完整归档指定单库目标时明确拒绝执行。
- 数据库备份与恢复根据选定服务的镜像识别引擎，避免 Compose 注释中的其他数据库名称影响命令；`.env` 中带引号的凭据通过 dotenv 解析。
- 系统快照恢复包含归档中的应用构建上下文和附属配置文件，保留未归档的现有文件；配置写入或数据库发布失败时尝试回滚，回滚失败保留恢复前副本并返回路径。
- 系统备份／恢复期间阻止管理配置写入；备份删除与对应应用任务互斥。域名写入不等待 TLS 查询，重复域名和不存在的目标应用会被拒绝；真实证书状态由刷新接口查询。
- 单个刷新接口失败不会丢弃其他接口成功返回的数据；清理任务完成后只更新执行结果，不覆盖运行期间保存的新配置。

本轮本地回归覆盖上述分支。真实 Docker 数据卷、MongoDB 原生命令与 R2 网络交互仍需在具备对应服务的环境执行集成验证；隔离测试不代表这些外部服务已经通过实测。
