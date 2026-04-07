# TeamBoard 部署指南

## 前置条件

- Docker Desktop (支持 `--platform linux/amd64`)
- kubectl 并配置 kubeconfig (`~/Downloads/kube.conf` 或 `$KUBECONFIG`)
- 火山引擎容器镜像仓库登录权限

## 镜像仓库登录

部署前确保已登录 (token 有效期有限，过期需重新获取):

```bash
docker login nodesk-center-cn-beijing.cr.volces.com -u <用户名> -p <token>
```

获取 token: 登录火山引擎控制台 → 容器镜像服务 → 获取临时令牌。

## 日常部署 (一键脚本)

```bash
cd ~/githubProject/deskhub-skill-teamdashboard
./deploy.sh
```

脚本自动完成: 构建镜像 → 推送仓库 → 更新 K8s → 健康检查 → 更新本地 YAML。

### 脚本参数

```bash
./deploy.sh                        # 默认: 自动时间戳 tag
./deploy.sh 20260408120000         # 指定 tag
./deploy.sh --skip-build           # 镜像已存在，只更新 K8s
./deploy.sh --skip-push            # 本地测试，跳过推送

KUBECONFIG=~/other.conf ./deploy.sh  # 指定 kubeconfig
```

## 首次部署 (初始化集群资源)

如果是全新集群或 namespace 不存在，需要先初始化:

```bash
export KUBECONFIG=~/Downloads/kube.conf

# 1. 创建 Namespace
kubectl apply -f k8s/namespace.yaml

# 2. 创建 Secret (替换真实凭据)
kubectl create secret generic teamboard-secret -n teamboard \
  --from-literal=UMAMI_USERNAME='<Umami 账号>' \
  --from-literal=UMAMI_PASSWORD='<Umami 密码>'

# 3. 创建其他资源
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/pvc.yaml
kubectl apply -f k8s/service.yaml

# 4. 构建并部署 (此时 deployment.yaml 中的 image tag 需要有效)
./deploy.sh
```

## 架构概览

```
单容器: Express (:3001) 同时服务前端静态文件和后端 API
    ├── /          → Vite 构建的 React 前端
    ├── /api/*     → Express 后端路由
    └── /data/     → PVC 持久化 (SQLite DB + 上传文件)
```

| K8s 资源 | 名称 | 说明 |
|----------|------|------|
| Namespace | `teamboard` | 独立命名空间 |
| ConfigMap | `teamboard-config` | 环境变量 (非敏感) |
| Secret | `teamboard-secret` | Umami 凭据 |
| PVC | `teamboard-data` | 20Gi EBS-SSD 持久卷 |
| Deployment | `teamboard` | 单副本 (SQLite 限制) |
| Service | `teamboard` | NodePort 30082 |

## 环境变量

### ConfigMap (`teamboard-config`)

| 变量 | 值 | 说明 |
|------|-----|------|
| `NODE_ENV` | `production` | 启用静态文件服务 |
| `PORT` | `3001` | Express 监听端口 |
| `DESKHUB_BASE` | `http://skillshub-server.skillshub.svc:4000` | DeskHub API (集群内) |
| `UMAMI_BASE` | `http://skillshub-umami.skillshub.svc:3000` | Umami (集群内) |
| `UMAMI_WEBSITE_ID` | `149fb71c-...` | Umami 站点 ID |
| `MCP_ENDPOINT` | (空) | MCP JSON-RPC 端点，待配置 |
| `DB_DIR` | `/data/db` | SQLite 数据库目录 |
| `UPLOAD_DIR` | `/data/uploads` | 文件上传目录 |

修改 ConfigMap 后需重启 Pod 生效:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl rollout restart deployment/teamboard -n teamboard
```

### Secret (`teamboard-secret`)

| 变量 | 说明 |
|------|------|
| `UMAMI_USERNAME` | Umami 登录账号 |
| `UMAMI_PASSWORD` | Umami 登录密码 |

更新 Secret:

```bash
kubectl delete secret teamboard-secret -n teamboard
kubectl create secret generic teamboard-secret -n teamboard \
  --from-literal=UMAMI_USERNAME='新账号' \
  --from-literal=UMAMI_PASSWORD='新密码'
kubectl rollout restart deployment/teamboard -n teamboard
```

## 常用运维命令

```bash
export KUBECONFIG=~/Downloads/kube.conf

# 查看 Pod 状态
kubectl get pods -n teamboard

# 查看日志
kubectl logs -n teamboard -l app=teamboard --tail=50

# 查看上一次崩溃日志
kubectl logs -n teamboard -l app=teamboard --previous --tail=50

# 进入 Pod 调试
kubectl exec -it -n teamboard deploy/teamboard -- sh

# 手动健康检查
kubectl exec -n teamboard deploy/teamboard -- \
  node -e "fetch('http://localhost:3001/api/health').then(r=>r.json()).then(console.log)"

# 回滚到上一版本
kubectl rollout undo deployment/teamboard -n teamboard

# 配置 MCP 端点
kubectl set env deployment/teamboard -n teamboard MCP_ENDPOINT=http://mcp-host:port/path
```

## 注意事项

- **单副本限制**: SQLite 不支持多进程并发写，replicas 必须为 1
- **PVC 数据备份**: 建议定期备份 `/data/db/teamboard.db`
- **镜像仓库 token**: 火山引擎 CR token 有有效期，push 失败时先检查是否过期
- **跨命名空间**: 通过 `<service>.<namespace>.svc` DNS 访问 skillshub 命名空间的服务
