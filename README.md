# Vessel — 极简 Docker Compose 自部署应用控制台

> 更精简、更优雅的 Docker Compose 应用自托管与生命周期管理平台。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Engine%2024%2B-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Caddy](https://img.shields.io/badge/Caddy-v2%20TLS-1F88C0?logo=caddy&logoColor=white)](https://caddyserver.com/)

---

## 📑 目录

- [✨ 核心特性](#-核心特性)
- [🛠️ 技术栈](#️-技术栈)
- [⚡ 快速开始（一键安装）](#-快速开始一键安装)
- [⚙️ 自定义参数与高级安装](#️-自定义参数与高级安装)
- [🐳 生产与本地运行](#-生产与本地运行)
  - [1. 生产 Docker Compose 部署](#1-生产-docker-compose-部署)
  - [2. 本地全栈开发模式](#2-本地全栈开发模式)
  - [3. 生产模式一键编译启动](#3-生产模式一键编译启动)
- [🔄 版本升级与旧版迁移](#-版本升级与旧版迁移)
  - [常规重复运行升级](#常规重复运行升级)
  - [历史安全修复版本迁移（旧版 `/app/server/data` 迁移）](#历史安全修复版本迁移旧版-appserverdata-迁移)
- [💾 数据备份与恢复深度语义](#-数据备份与恢复深度语义)
  - [系统快照 vs 应用卷备份](#系统快照-vs-应用卷备份)
  - [数据卷备份与恢复安全机制](#数据卷备份与恢复安全机制)
  - [数据库逻辑备份与恢复](#数据库逻辑备份与恢复)
- [🧪 开发验证与自动化测试](#-开发验证与自动化测试)
- [🚀 发布者配置（CI/CD）](#-发布者配置cicd)
- [📁 项目架构与目录结构](#-项目架构与目录结构)
- [📄 开源协议](#-开源协议)

---

## ✨ 核心特性

- **Docker Compose 一等公民**：
  - 以原生 `docker-compose.yml` 与 `.env` 为核心，零私有黑盒封装，完全透明。
  - 独立工作区隔离目录，支持启动、停止、重启、拉取重建及环境变量在线配置。
  - 基于 WebSocket 的流式实时部署控制台终端（带 ANSI 日志渲染与平滑自动滚动）。
- **Caddy 原生自动 SSL 证书与动态反代**：
  - 内置极轻量 Caddy 引擎，支持 REST API 动态热挂载域名路由。
  - 原生全自动向 Let's Encrypt / ZeroSSL 申请 TLS 证书，到期前 30 天静默自动续订。
  - 混合网络架构：默认共享 `vessel-net` 内部容器网络（服务名+端口直连），同时支持按需转发宿主机端口。
- **Cloudflare R2 双层全能备份**：
  - **系统级灾备**：自动打包平台持久化数据与所有应用 Compose 配置，直传 R2。
  - **应用级归档**：支持为指定应用挂载卷执行独立归档上传。
  - 支持自定义 Cron 周期定时调度与保留版本数自动淘汰清理，支持一键连通性测试。
- **私有镜像仓鉴权 (GHCR & Docker Hub)**：
  - 快捷绑定 GitHub 用户名与带有 `read:packages` 权限的 PAT (Personal Access Token)。
  - 一键验证并自动注入 Docker 守护进程认证，免密拉取 `ghcr.io/username/repo:tag` 私有镜像。
- **镜像版本巡检与安全阶梯清理**：
  - 定时比对远程 Registry Digest 与本地容器镜像，发现新版本时高亮提醒并支持一键无感升级。
  - 阶梯式磁盘瘦身：自动安全清理悬空镜像 (`<none>:<none>`) 与构建缓存，对无引用镜像提供 72 小时安全冷却保护期，并在界面实时反馈释放的磁盘空间 (MB)。

---

## 🛠️ 技术栈

- **前端控制台**：React 19 + Vite 6 + TypeScript + Tailwind CSS
- **后端服务**：Node.js 22+ + TypeScript + Express + WebSocket (`ws`) + YAML + Cron
- **对象存储**：AWS S3 SDK (适配 Cloudflare R2) + Archiver
- **容器编排**：Docker Engine API (`dockerode`) + Docker Compose CLI (v2+)
- **反向代理**：Caddy v2 (动态 API + ACME 自动 TLS)
- **工程结构**：pnpm Workspace Monorepo

---

## ⚡ 快速开始（一键安装）

### 环境要求

- **操作系统**：Linux x86_64 (amd64) 或 aarch64 (arm64)
- **权限要求**：`root` 或具备 `sudo` 权限的用户
- **网络连接**：能够访问 GitHub、GHCR（或自建镜像仓）及系统软件源
- **端口要求**：宿主机 TCP `80`、`443`（Caddy 反代与证书申请）以及 `3900`（控制台端口，可自定义）

### 推荐在线安装

公开发布后，直接在终端执行一键安装脚本（自动处理依赖检测、安装 Docker/Compose 并启动容器）：

```bash
curl -fsSL https://github.com/SpeedupMaster/vessel/releases/latest/download/install.sh | sudo sh
```

> **提示**：若已经是 `root` 用户，可将 `sudo sh` 简写为 `sh`。`-f` 参数确保遇到 HTTP 错误时不将错误页当作脚本执行。

### 自动化/安全下载后执行（带完整性校验）

对于对安全和审计要求严格的环境，建议分步下载、校验哈希后再运行：

```bash
# 下载指定版本的安装脚本与哈希清单
curl -fSL https://github.com/SpeedupMaster/vessel/releases/download/v1.0.0/install.sh -o install.sh
curl -fSL https://github.com/SpeedupMaster/vessel/releases/download/v1.0.0/SHA256SUMS -o SHA256SUMS

# 校验完整性
sha256sum -c SHA256SUMS

# 执行安装
sudo sh install.sh
```

### 首次登录与密码获取

安装完成后，打开浏览器访问：`http://<服务器IP>:3900`

- **默认账号**：`admin`
- **初始随机密码获取方式**：
  ```bash
  sudo cat /opt/vessel/data/initial-admin-password
  ```
- **安全要求**：首次登录控制台后**必须立即修改密码**。密码修改成功后，系统会自动销毁并删除该初始密码文件。
- **预设密码选项**：若希望跳过初始文件密码，可在首次安装启动前设置环境变量 `VESSEL_ADMIN_PASSWORD`（长度不得少于 12 位）。

---

## ⚙️ 自定义参数与高级安装

### 环境变量参数

通过在管道右侧向安装脚本传递环境变量，可灵活定制安装目录、端口与 Docker 安装行为：

```bash
curl -fsSL https://github.com/SpeedupMaster/vessel/releases/latest/download/install.sh | \
  sudo env VESSEL_INSTALL_DIR=/opt/vessel VESSEL_PORT=4390 sh
```

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VESSEL_INSTALL_DIR` | `/opt/vessel` | 安装主目录与数据持久化路径，必须为无空格的绝对路径 |
| `VESSEL_PORT` | `3900` | 宿主机控制台访问端口（**禁止设置为 80 或 443**，该端口专属于 Caddy） |
| `VESSEL_IMAGE` | Release 内置固定 Digest | 指定自建镜像路径或特定版本镜像（例如 `ghcr.io/speedupmaster/vessel:v1.0.0`） |
| `VESSEL_INSTALL_DOCKER` | `1` | 缺少 Docker 时自动安装。设为 `0` 仅禁用 Docker Engine 自动安装，仍会检测并补齐 Compose 插件与启动服务 |

### 多发行版自动检测与依赖修复矩阵

安装器能够智能识别 `/etc/os-release`，并在依赖缺失时仅按需调用包管理器安装缺失项，**绝不执行全系统包升级**：

| 发行版系列 | 检测包管理器 | Compose 插件候选安装包 |
| --- | --- | --- |
| **Debian / Ubuntu / Raspbian** | `apt-get` | `docker-compose-plugin` → `docker-compose-v2` → `docker-compose` (≥ 2.0) |
| **RHEL / CentOS / Rocky / AlmaLinux / Fedora / Amazon Linux** | `dnf` (缺失时回退 `yum`) | `docker-compose-plugin` → `docker-compose` |
| **Alpine Linux** | `apk` | `docker-cli-compose` (需开启 community 源) |
| **openSUSE / SLES** | `zypper` | `docker-compose` |

- **Docker 服务自启**：安装器按优先级检测 `systemd`、`OpenRC` 或 `service`，启动 Docker 并设置开机自启；安装后最多等待 60 秒检测 `docker info` 就绪。
- **生产建议**：生产服务器建议提前使用发行版官方软件源完成 Docker 部署，并传入 `VESSEL_INSTALL_DOCKER=0` 执行安装。

### 自有域名安装入口配置

若拥有自建分发域名，可在现有 Caddy 或反代服务中设置 302 重定向：

```caddyfile
vessel.example.com {
    redir /install.sh https://github.com/SpeedupMaster/vessel/releases/latest/download/install.sh 302
}
```

随后即可使用简洁链接执行安装：`curl -fsSL https://vessel.example.com/install.sh | sudo sh`。

---

## 🐳 生产与本地运行

### 1. 生产 Docker Compose 部署

若希望通过克隆源码或直接使用 Compose 管理：

```bash
# 启动生产容器
docker compose -f docker-compose.prod.yml up -d

# 查看运行状态与日志
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### 2. 本地全栈开发模式

支持前端 Vite 热重载与后端服务联调：

```bash
# 安装依赖
pnpm install

# 并行启动 Vite 开发服务 (5174 端口) 与后端服务 (3900 端口)
pnpm dev
```

- **前端控制台**：`http://localhost:5174`（自动反向代理 API 与 WebSocket）
- **后端服务与 WebSocket**：`http://localhost:3900`

### 3. 生产模式一键编译启动

在宿主机直接编译并托管静态资源：

```bash
pnpm build
pnpm start
```

访问：`http://localhost:3900`

---

## 🔄 版本升级与旧版迁移

### 常规重复运行升级

对于通过官方安装脚本部署的实例，**重复执行新版本 Release 的安装脚本即可实现原地升级**：

```bash
curl -fsSL https://github.com/SpeedupMaster/vessel/releases/latest/download/install.sh | sudo sh
```

- **数据完整保留**：自动继承 `/opt/vessel/data` 下的数据库、已有管理员账号、应用数据及已配置的自定义端口。
- **故障保护机制**：
  - 新镜像拉取失败时，绝不替换原有 Compose 文件或现有运行容器。
  - 原配置自动备份归档为 `docker-compose.previous.yml`。
  - 若启动异常，可通过以下命令回溯排查：
    ```bash
    sudo docker compose -p vessel -f /opt/vessel/docker-compose.yml logs --tail 100
    ```
- **配置防篡改**：安装器会校验 Compose 配置签名与容器归属，拒绝覆盖未托管的同名容器或第三方挂载目录。

### 历史安全修复版本迁移（旧版 `/app/server/data` 迁移）

> [!CAUTION]
> **升级前数据导出必须在删除旧容器前完成！**
> 早期旧版容器将数据写入了内部未持久化的 `/app/server/data`，而新版本标准统一挂载至 `/app/data`。若直接重建或删除旧容器会导致数据丢失。

#### 1. 导出旧数据

```bash
docker stop vessel-hub
docker cp vessel-hub:/app/server/data ./vessel-data-before-upgrade
```

#### 2. 迁移数据至新目录

检查导出的备份，将 `vessel_db.json`、`apps/` 和 `backups/` 目录复制至新版本绑定的数据持久化目录（例如 `./data/` 或 `/opt/vessel/data/`）。

#### 3. 重新拉取构建启动

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

#### 4. 凭据体系平滑升级

- 新版本后端全面升级为带独立随机盐的 **scrypt** 密码哈希算法。
- 用户使用原密码首次登录时，系统会自动将旧版 SHA-256 哈希透明迁移至加盐 scrypt。
- 若账号此前仍在沿用历史默认密码，系统将强制重定向至修改密码页，完成修改前禁止访问管理接口。

---

## 💾 数据备份与恢复深度语义

### 系统快照 vs 应用卷备份

| 备份类型 | 备份内容与范围 | 适用场景 | 恢复影响 |
| --- | --- | --- | --- |
| **系统级快照 (System Snapshot)** | Vessel 平台数据库、元数据配置、应用 Compose 配置与附属构建文件 | 控制台灾难恢复、跨服务器环境迁移 | 保留当前管理员凭据与备份历史记录，回滚受保护 |
| **应用卷备份 (Application Volume)** | 应用关联的 Docker Named Volume 与可写目录 Bind Mount | 应用持久化业务数据（如文件、上传资源、嵌入式存储） | 依赖 Docker Engine 辅助容器，需短暂停机应用 |
| **数据库逻辑备份 (Database Dump)** | PostgreSQL (`pg_dump`)、MySQL/MariaDB (`mysqldump`)、MongoDB (`mongodump`) 结构化数据 | 结构化数据库独立归档、跨版本逻辑迁移 | 需运行对应的数据库容器，支持单库重命名与命名空间映射 |

### 数据卷备份与恢复安全机制

1. **真实数据卷归档**：
   - 备份执行时自动拉取极轻量的 `alpine:3.21`（支持通过 `VESSEL_BACKUP_IMAGE` 覆盖）作为挂载辅助容器，直接读取真实数据卷内容，杜绝仅备份工作目录的虚假备份。
   - 备份过程中优雅暂停应用容器，确保数据一致性，完成后自动恢复容器运行状态。
   - **挂载支持规范**：支持 Named Volume 与可写目录 Bind Mount。只读挂载与 tmpfs 不纳入持久化；可写单文件 Bind Mount 会明确报错提示，防止产生不完整备份。
2. **两阶段原子级卷恢复**：
   - 数据恢复先在临时 Docker 卷中解压并校验结构。
   - 保留恢复前的原始备份副本，然后再原子替换目标数据卷内容。
   - 若解压或恢复失败，自动触发安全回滚；若回滚依然受阻，保留原始副本路径并在界面直观提示，方便管理员人工排查。
3. **并发安全与任务互斥**：
   - 系统备份与恢复期间全局锁定管理配置写入，杜绝脏数据。
   - 备份归档文件名均包含随机唯一标识（UUID），彻底解决并发任务冲突。

---

## 🧪 开发验证与自动化测试

项目具备严密的本地测试与 CI 回归机制，全面覆盖单元测试、安全防护、Docker 数据持久化往返与跨发行版安装器桩测试：

```bash
# 1. 冻结锁文件并安装完整依赖
pnpm install --frozen-lockfile

# 2. 运行单元测试、安全验证与前端类型检查/打包
pnpm check

# 3. 执行 POSIX 安装器隔离与依赖容错测试
sh scripts/test-installer.sh

# 4. 构建验证镜像并执行真实容器持久化验证
docker build -t vessel:ci .
bash scripts/test-container.sh

# 5. 运行真实 Docker 卷挂载与备份恢复往返测试
VESSEL_DOCKER_TEST=1 node --test server/tests/docker.integration.mjs
```

---

## 🚀 发布者配置（CI/CD）

1. **推送版本标签**：向仓库推送符合语义化版本规范的标签（例如 `v1.0.0`）。
2. **自动化发布流程**（`.github/workflows/release.yml`）：
   - 自动运行 `pnpm check`、安装器回归与真实 Docker 数据卷测试。
   - 编译构建 `linux/amd64` 与 `linux/arm64` 双架构生产镜像，推送至 GitHub Container Registry (`ghcr.io/speedupmaster/vessel:vX.Y.Z`)。
   - 自动锁定镜像 Digest 并动态注入 `install.sh`。
   - 生成 `SHA256SUMS` 校验清单并随 `install.sh` 一同上传至该版本的 GitHub Release 资产。
3. **首次发布包可见性确认**：
   - 首次发布后，前往 GitHub 仓库对应的 Packages 页面，将 GHCR 包的可见性设为 **Public**，以确保公网服务器无需 GitHub 认证即可免密拉取。

---

## 📁 项目架构与目录结构

```
vessel/
├── package.json              # Monorepo 根依赖与指令 (pnpm workspaces)
├── pnpm-workspace.yaml       # 工作区配置
├── docker-compose.prod.yml   # 生产部署 Compose 编排
├── Dockerfile                # 多阶段生产容器构建 (Alpine + Node 22 + Caddy + Docker CLI)
├── scripts/
│   ├── install.sh            # 跨 Linux 发行版 POSIX 一键安装器
│   ├── test-installer.sh     # 安装器隔离回归测试
│   ├── test-installer-dependencies.sh # 跨发行版包管理器与依赖桩测试
│   └── test-container.sh     # 生产容器开箱就绪与持久化验证
├── web/                      # 前端管理控制台 (React 19 + Vite 6 + Tailwind)
│   ├── src/
│   │   ├── styles/
│   │   │   ├── tokens.css    # 主题样式变量与配色
│   │   │   └── globals.css   # 全局排版与基础样式
│   │   ├── components/
│   │   │   ├── common/       # 通用基础组件、指标翻牌、Modal
│   │   │   ├── layout/       # Sidebar 侧栏导航、Header 遥测指标状态栏
│   │   │   └── views/        # Overview, Apps, Domains, Backups, Registries, Maintenance
│   │   ├── hooks/useData.ts  # WebSocket 双向遥测与全栈状态中枢
│   │   └── App.tsx
│   └── vite.config.ts
└── server/                   # 后端核心服务 (Express + WS + Dockerode + Caddy + R2)
    └── src/
        ├── db/               # 原子事务持久化层 (vessel_db.json)
        ├── middleware/       # 认证鉴权、参数校验中间件
        ├── services/
        │   ├── docker.ts     # Docker Engine 交互与 Compose 进程流管理
        │   ├── volumeBackup.ts # 辅助容器真实数据卷归档与两阶段恢复引擎
        │   ├── caddy.ts      # Caddy REST API 动态热挂载与 ACME 证书管理
        │   ├── r2Backup.ts   # Cloudflare R2 (S3) 归档引擎与清理调度
        │   ├── registry.ts   # GHCR 凭据校验与镜像 Digest 比对
        │   ├── cleaner.ts    # Docker 阶梯安全 Prune 任务 (72小时冷却期)
        │   └── scheduler.ts  # node-cron 定时调度中枢
        ├── routes/api.ts     # 全量 RESTful API 路由
        ├── ws/wsHub.ts       # WebSocket 实时遥测与终端 ANSI 日志流
        └── index.js          # 入口服务 (默认 3900 端口)
```

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源。
