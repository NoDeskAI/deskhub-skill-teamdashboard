#!/usr/bin/env bash
set -euo pipefail

# ─── 配置 ────────────────────────────────────────────────────
REGISTRY="nodesk-center-cn-beijing.cr.volces.com"
IMAGE="${REGISTRY}/infra/teamboard"
NAMESPACE="teamboard"
DEPLOYMENT="teamboard"
CONTAINER="teamboard"
KUBECONFIG_PATH="${KUBECONFIG:-$HOME/Downloads/kube.conf}"

# ─── 参数解析 ─────────────────────────────────────────────────
TAG="${1:-$(date +%Y%m%d%H%M%S)}"
SKIP_BUILD=false
SKIP_PUSH=false

for arg in "$@"; do
  case $arg in
    --skip-build) SKIP_BUILD=true ;;
    --skip-push)  SKIP_PUSH=true ;;
    --help|-h)
      echo "用法: ./deploy.sh [TAG] [选项]"
      echo ""
      echo "参数:"
      echo "  TAG              镜像标签 (默认: 时间戳 YYYYMMDDHHmmss)"
      echo ""
      echo "选项:"
      echo "  --skip-build     跳过 Docker 构建"
      echo "  --skip-push      跳过 Docker 推送"
      echo "  -h, --help       显示帮助"
      echo ""
      echo "环境变量:"
      echo "  KUBECONFIG       kubeconfig 路径 (默认: ~/Downloads/kube.conf)"
      echo ""
      echo "示例:"
      echo "  ./deploy.sh                    # 自动生成 tag, 完整流程"
      echo "  ./deploy.sh 20260408120000     # 指定 tag"
      echo "  ./deploy.sh --skip-build       # 只更新 K8s (镜像已存在)"
      exit 0
      ;;
  esac
done

echo "═══════════════════════════════════════════════"
echo "  TeamBoard 部署"
echo "  镜像: ${IMAGE}:${TAG}"
echo "═══════════════════════════════════════════════"

# ─── 1. 构建 ─────────────────────────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  echo ""
  echo "▸ [1/4] 构建 Docker 镜像..."
  docker build --platform linux/amd64 -t "${IMAGE}:${TAG}" .
  echo "  ✓ 构建完成"
else
  echo ""
  echo "▸ [1/4] 跳过构建"
fi

# ─── 2. 推送 ─────────────────────────────────────────────────
if [ "$SKIP_PUSH" = false ]; then
  echo ""
  echo "▸ [2/4] 推送镜像到 ${REGISTRY}..."
  docker push "${IMAGE}:${TAG}"
  echo "  ✓ 推送完成"
else
  echo ""
  echo "▸ [2/4] 跳过推送"
fi

# ─── 3. 更新 K8s 部署 ────────────────────────────────────────
echo ""
echo "▸ [3/4] 更新 K8s Deployment..."
export KUBECONFIG="${KUBECONFIG_PATH}"

kubectl set image "deployment/${DEPLOYMENT}" \
  "${CONTAINER}=${IMAGE}:${TAG}" \
  -n "${NAMESPACE}"

echo "  等待 rollout..."
if kubectl rollout status "deployment/${DEPLOYMENT}" -n "${NAMESPACE}" --timeout=120s; then
  echo "  ✓ Rollout 完成"
else
  echo "  ✗ Rollout 超时，检查 Pod 状态:"
  kubectl get pods -n "${NAMESPACE}"
  echo ""
  echo "  查看日志: kubectl logs -n ${NAMESPACE} -l app=${DEPLOYMENT} --tail=30"
  exit 1
fi

# ─── 4. 验证 ─────────────────────────────────────────────────
echo ""
echo "▸ [4/4] 验证健康检查..."
HEALTH=$(kubectl exec -n "${NAMESPACE}" "deploy/${DEPLOYMENT}" -- \
  node -e "fetch('http://localhost:3001/api/health').then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))" 2>&1)

if echo "$HEALTH" | grep -q '"ok"'; then
  echo "  ✓ 健康检查通过: ${HEALTH}"
else
  echo "  ✗ 健康检查异常: ${HEALTH}"
  exit 1
fi

# ─── 5. 更新本地 YAML ────────────────────────────────────────
if [ -f k8s/deployment.yaml ]; then
  if command -v sed &>/dev/null; then
    sed -i.bak "s|image: ${IMAGE}:.*|image: ${IMAGE}:${TAG}|" k8s/deployment.yaml
    rm -f k8s/deployment.yaml.bak
    echo ""
    echo "  ✓ k8s/deployment.yaml 已更新为 tag: ${TAG}"
  fi
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  部署完成!"
echo "  访问: http://<NodeIP>:30082"
echo "═══════════════════════════════════════════════"
