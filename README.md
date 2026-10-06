# Vessel — 极简 Docker Compose 自部署应用控制台

> 基于 **Hallmark 1.1.0** 设计系统规范（Modern-Minimal / Cobalt 蓝钛矩阵工程控制台风格）、**GSAP 3** 高性能微交互与数字翻牌动效、以及 **Phosphor Icons** 构建的更精简、更优雅的 Docker Compose 应用自托管与生命周期管理平台。

---

## ✨ 核心特性

- **现代极客工程美学**：
  - 严格遵循 Hallmark Modern-Minimal 规范与 OKLCH 色彩空间构建（深石墨底色 `--color-paper`、钛金表面 `--color-paper-2`、微米发丝边框与电光钴蓝脉冲）。
  - Roman 正常字重排版，严禁任何 AI 斜体标题，严格杜绝虚假 UI 边框。
  - 核心控件完整落地 **8-State** 交互规范（default, hover, focus-visible, active, disabled, loading, error, success）。
- **GSAP 高性能动效**：
  - 遥测指标（CPU、内存、已释放磁盘容量、备份大小）采用 **RollingCounter** 平滑翻牌动效。
  - 应用卡片网格加载采用 **Staggered Reveal**（交错弹性进场）。
  - 模态弹窗与工作台具备精准物理弹性反馈。
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
- **动效引擎**：GSAP 3 + `@gsap/react`
- **图标系统**：`@phosphor-icons/react`
- **设计规范**：Hallmark 1.1.0 (`modern-minimal`, `tokens.css`, 8-state components)
- **后端服务**：Node.js 22+ + TypeScript + Express + WebSocket (`ws`) + YAML + Cron
- **对象存储**：AWS S3 SDK (适配 Cloudflare R2) + Archiver
- **容器编排**：Docker Engine API (`dockerode`) + Docker Compose CLI
- **反向代理**：Caddy v2 (动态 API + ACME 自动 TLS)
- **工程结构**：pnpm Workspace Monorepo

---

## 🚀 启动与运行

### 1. 本地全栈开发模式 (支持前端热重载)

同时启动 Vite 开发服务器 (5174 端口) 与后端 API 服务 (3900 端口)：

```bash
cd "F:\代码\vessel"
pnpm dev
```

- 前端开发控制台：**http://localhost:5174** (通过代理自动反向代理 API 与 WebSocket)
- 后端服务与 WebSocket：**http://localhost:3900**

### 2. 生产模式一键编译与启动

后端将直接托管编译后的 Vite 单页前端静态资源：

```bash
cd "F:\代码\vessel"
pnpm build
pnpm start
```

浏览器访问：**http://localhost:3900**

### 3. Docker 容器化部署

在已有 Docker 环境的服务器中直接启动：

```bash
docker compose -f docker-compose.prod.yml up -d
```

或使用脚本在全新 Linux VPS 上 30 秒一键安装：

```bash
sudo bash scripts/install.sh
```

---

## 📁 目录结构

```
F:\代码\vessel/
├── package.json              # Monorepo 根依赖与指令
├── pnpm-workspace.yaml       # 工作区配置
├── docker-compose.prod.yml   # 生产部署编排
├── Dockerfile                # 多阶段生产容器构建
├── scripts/
│   └── install.sh            # Linux 30秒一键安装脚本
├── .hallmark/                # Hallmark 1.1.0 规范配置与执行记录
│   ├── log.json
│   └── preflight.json
├── web/                      # 前端控制台 (React 19 + Vite + GSAP)
│   ├── src/
│   │   ├── styles/
│   │   │   ├── tokens.css    # Hallmark Cobalt 规范 OKLCH 设计代币
│   │   │   └── globals.css   # 全局排版与 8-State 工具类
│   │   ├── components/
│   │   │   ├── common/       # 8-state 按钮、RollingCounter 翻牌、Modal、Badge
│   │   │   ├── layout/       # Sidebar 侧栏、Header 遥测顶部栏
│   │   │   └── views/        # Overview, Apps, Domains, Backups, Registries, Maintenance
│   │   ├── hooks/useData.ts  # WebSocket 双向遥测与全栈状态管理
│   │   └── App.tsx
│   └── vite.config.ts
└── server/                   # 后端核心服务 (Express + WS + Docker)
    └── src/
        ├── db/               # 事务性原子持久化层
        ├── services/
        │   ├── docker.ts     # Docker Engine 交互与 Compose 进程流
        │   ├── caddy.ts      # Caddy REST API 客户端与证书自动管理
        │   ├── r2Backup.ts   # Cloudflare R2 (S3) 归档引擎
        │   ├── registry.ts   # GHCR 凭据校验与镜像 Digest 比对
        │   ├── cleaner.ts    # Docker 阶梯安全 Prune 任务
        │   └── scheduler.ts  # node-cron 定时调度中枢
        ├── routes/api.ts     # 全量 RESTful API
        ├── ws/wsHub.ts       # WebSocket 实时遥测与终端日志流
        └── index.ts          # 入口服务 (3900端口)
```
