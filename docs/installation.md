# 一键安装与发布

## 当前状态

仓库已包含安装器、隔离回归测试和 GitHub Actions 发布流程。目标仓库为 `SpeedupMaster/vessel`。安装命令依赖该仓库成功发布的 Release；`vessel.example.com` 仅为自有域名配置示例。

## 用户安装

准备 Linux amd64/arm64 服务器、root/sudo 权限和 curl。服务器需要可以访问 GitHub、GHCR，缺少 Docker 时还需访问 Docker 软件源。TCP 80、443、3900 默认应可用，防火墙放行由管理员按实际需求设置。

公开发布后：

```sh
curl -fsSL https://github.com/SpeedupMaster/vessel/releases/latest/download/install.sh | sudo sh
```

已经是 root 时可将 `sudo sh` 换成 `sh`。`-f` 避免把 HTTP 错误页当安装脚本。管道写法不保证调用方能检测下载端所有失败；自动化部署推荐先完成下载再执行：

```sh
curl -fSL https://github.com/SpeedupMaster/vessel/releases/download/v1.0.0/install.sh -o install.sh && sudo sh install.sh
```

安装包包含 `SHA256SUMS`，可在执行前下载并用 `sha256sum -c SHA256SUMS` 检查文件。安装脚本内固定的是对应 Release 的镜像 digest，不会因为可变标签更新而拉取其他构建。

默认访问 `http://服务器IP:3900`。账号为 `admin`，首次登录密码位于 `/opt/vessel/data/initial-admin-password`，登录后必须更改。脚本不打印密码、不重置已有账号、不删除数据目录。

```sh
sudo cat /opt/vessel/data/initial-admin-password
```

## 自定义安装

变量放在管道右侧，传给安装器：

```sh
curl -fsSL https://github.com/SpeedupMaster/vessel/releases/latest/download/install.sh | \
  sudo env VESSEL_INSTALL_DIR=/opt/vessel VESSEL_PORT=4390 sh
```

| 变量 | 默认 | 含义 |
| --- | --- | --- |
| `VESSEL_INSTALL_DIR` | `/opt/vessel` | 安装与数据目录，使用无空格绝对路径 |
| `VESSEL_PORT` | `3900` | 宿主机控制台端口，不能为 80 或 443 |
| `VESSEL_IMAGE` | Release 固定 digest | 指定自建镜像或其他已发布版本 |
| `VESSEL_INSTALL_DOCKER` | `1` | 缺少 Docker 时使用官方安装脚本；设为 `0` 禁用 |

Docker 已存在时，安装器不升级 Docker。缺少 Compose v2、守护进程未启动时会停止并提示。自动安装 Docker 使用 `get.docker.com`；Docker 官方将便利脚本定位于开发／测试环境。生产环境建议预先按发行版官方软件源方式安装 Docker，再设置 `VESSEL_INSTALL_DOCKER=0`。

## 发布者首次配置

1. 将代码推送到实际 GitHub 仓库，启用 Actions。
2. 推送稳定版本标签，例如 `v1.0.0`。`.github/workflows/release.yml` 会执行回归与构建、安装器隔离测试、真实 Docker 测试，再构建并推送 `linux/amd64`、`linux/arm64` 镜像。
3. 镜像路径自动使用小写仓库全名：`ghcr.io/owner/repo:v1.0.0`。工作流使用 `GITHUB_TOKEN`，需要仓库／组织允许 `packages: write` 和 `contents: write`。
4. 首次发布后检查 GHCR 包的可见性，并设为 Public，才能让没有 GitHub 凭据的用户拉取；GitHub 源码和 Release 也需公开才能支持无凭据下载。
5. 工作流将最终镜像 digest 注入安装脚本，上传 `install.sh` 和 `SHA256SUMS` 到该版本的 GitHub Release。
6. 在干净 Linux 服务器上用公开安装命令进行验收，再公布安装入口。当前本地测试不替代该验收。

版本标签应指向已审阅的代码。流程只接受稳定 `vX.Y.Z`，不会发布未通过检查的安装资产。

## 自有域名入口

将 `https://vessel.example.com/install.sh` 通过 HTTPS 重定向到实际 Release 安装资产；例如已有 Caddy 网站配置中添加：

```caddyfile
vessel.example.com {
    redir /install.sh https://github.com/SpeedupMaster/vessel/releases/latest/download/install.sh 302
}
```

此配置用于安装入口网站，不应直接覆盖 Vessel 自动生成的 Caddyfile。也可由现有静态托管/CDN 提供同样重定向。安装命令中的 `-L` 会跟随重定向。需要稳定变更控制时，把重定向目标固定到具体版本。

## 重复安装与升级

对安装器管理的部署重复运行新版 Release 脚本，会保留 `/opt/vessel/data`、管理员凭据和已保存的控制台端口，拉取新版本后重新创建服务。自定义安装目录每次都必须通过 `VESSEL_INSTALL_DIR` 传入。升级前先完成独立数据备份。

安装器会拒绝覆盖其他来源的 Compose 配置、不同数据挂载或不同 Compose 项目的同名容器。旧版 `/app/server/data` 存在数据未持久化风险，迁移步骤见 [升级与验证指南](upgrade-and-verification.md)。不会自动删除旧容器或替用户猜测应保留哪份数据。

镜像拉取失败时，不替换原 Compose 配置或现有容器。启动或就绪检查失败时，返回非零退出码并保留数据及本次配置；旧 Compose 保存为 `docker-compose.previous.yml`。安装器不自动执行可能不兼容数据格式的版本回退。

```sh
sudo docker compose -p vessel -f /opt/vessel/docker-compose.yml logs --tail 100
```

## 开发验证

```sh
sh -n scripts/install.sh
sh scripts/test-installer.sh
pnpm check
```

安装器隔离测试覆盖首次安装、`cat install.sh | sh`、重复安装、参数持久化、拉取失败、旧版保护、启动失败、就绪超时、端口冲突与非托管配置保护。Docker、网络和权限检查使用桩，不会安装真实服务。CI 在 Linux 上运行同一测试；发布流程另有 Docker 构建与数据卷集成验证。

官方参考：
- Docker 安装说明：https://docs.docker.com/engine/install/ubuntu/
- GHCR 可见性与认证：https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
