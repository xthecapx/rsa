#!/usr/bin/env bash
# Deploy backend + game to Cloud Run so the game can reach the API.
#
# Prerequisites (once per machine / project):
#   gcloud auth login
#   gcloud config set project hacking-rsa          # or your project
#   gcloud config set run/region us-east1          # free-tier region
#   gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
#   gcloud artifacts repositories create rsa --repository-format=docker --location=us-east1
#   gcloud auth configure-docker us-east1-docker.pkg.dev
#
# After that, this script alone builds, pushes, and deploys backend + game.
#
# Usage:
#   ./deploy-cloudrun.sh            # backend + game (default)
#   ./deploy-cloudrun.sh backend    # backend only
#   ./deploy-cloudrun.sh game       # game only (reuses the deployed backend URL)

set -euo pipefail

TARGET="${1:-all}"
case "${TARGET}" in
  all|backend|game) ;;
  *)
    echo "Usage: $0 [all|backend|game]"
    exit 1
    ;;
esac

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-$(gcloud config get-value run/region 2>/dev/null)}"
REGION="${REGION:-us-central1}"
REPO="${REPO:-rsa}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")" && pwd)"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
BACKEND_IMAGE="${REGISTRY}/backend:latest"
GAME_IMAGE="${REGISTRY}/game:latest"
# Each push can leave several digests (image index, platform manifest,
# attestation). KEEP_IMAGES is how many complete pushes to retain; we multiply
# by MANIFESTS_PER_PUSH so we never try to delete a child of a kept parent.
KEEP_IMAGES="${KEEP_IMAGES:-2}"
MANIFESTS_PER_PUSH="${MANIFESTS_PER_PUSH:-4}"

prune_old_digests() {
  local package="$1"
  local keep=$((KEEP_IMAGES * MANIFESTS_PER_PUSH))
  echo "==> Pruning old digests for ${package} (keeping ${KEEP_IMAGES} images ≈ ${keep} digests)"

  local -a newest_first=()
  while IFS= read -r digest; do
    [[ -n "${digest}" ]] && newest_first+=("${digest}")
  done < <(gcloud artifacts docker images list "${package}" \
    --sort-by=~CREATE_TIME \
    --format='value(version)' 2>/dev/null || true)

  local total=${#newest_first[@]}
  if (( total <= keep )); then
    echo "    nothing to prune (${total} digests)"
    return 0
  fi

  # Delete oldest first so an old index goes before its children.
  local -a oldest_first=()
  local i
  for ((i = total - 1; i >= keep; i--)); do
    oldest_first+=("${newest_first[i]}")
  done

  local digest err
  for digest in "${oldest_first[@]}"; do
    echo "    delete ${digest}"
    if err="$(gcloud artifacts docker images delete "${package}@${digest}" \
      --quiet --delete-tags 2>&1)"; then
      continue
    fi
    # Child digests of a kept parent fail until that parent is gone; skip them.
    if [[ "${err}" == *"referenced by parent"* || "${err}" == *"referenced parents"* ]]; then
      echo "    skip (still referenced by a kept parent)"
    else
      echo "    warning: ${err}" >&2
    fi
  done
}

echo "==> Project ${PROJECT_ID}  region ${REGION}  target ${TARGET}"
# Cloud Run only runs linux/amd64. On Apple Silicon, the default build is
# arm64 and the deploy fails with "must support amd64/linux".
PLATFORM="${PLATFORM:-linux/amd64}"

if [[ "${TARGET}" == "all" || "${TARGET}" == "backend" ]]; then
  echo "==> Building and pushing backend (${PLATFORM})"
  docker build --platform="${PLATFORM}" -t "${BACKEND_IMAGE}" "${ROOT}/backend"
  docker push "${BACKEND_IMAGE}"

  echo "==> Deploying rsa-backend"
  gcloud run deploy rsa-backend \
    --image="${BACKEND_IMAGE}" \
    --region="${REGION}" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=2 \
    --timeout=300 \
    --set-env-vars="PYTHONPATH=/app,IBM_MODE=auto"

  prune_old_digests "${REGISTRY}/backend"
fi

BACKEND_URL="$(gcloud run services describe rsa-backend --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"
if [[ -z "${BACKEND_URL}" ]]; then
  echo "rsa-backend is not deployed in ${REGION}; run: $0 backend"
  exit 1
fi
echo "==> Backend URL: ${BACKEND_URL}"

if [[ "${TARGET}" == "all" || "${TARGET}" == "game" ]]; then
  echo "==> Building and pushing game (${PLATFORM})"
  # BACKEND_URL must be present at `next build` — rewrites are not runtime-configurable.
  docker build --platform="${PLATFORM}" \
    --build-arg "BACKEND_URL=${BACKEND_URL}" \
    -t "${GAME_IMAGE}" "${ROOT}/game"
  docker push "${GAME_IMAGE}"

  echo "==> Deploying rsa-game (BACKEND_URL=${BACKEND_URL})"
  gcloud run deploy rsa-game \
    --image="${GAME_IMAGE}" \
    --region="${REGION}" \
    --platform=managed \
    --allow-unauthenticated \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=2 \
    --timeout=300 \
    --set-env-vars="BACKEND_URL=${BACKEND_URL}"

  prune_old_digests "${REGISTRY}/game"
fi

GAME_URL="$(gcloud run services describe rsa-game --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"

echo
echo "Done."
echo "  Backend: ${BACKEND_URL}"
echo "  Game:    ${GAME_URL:-<not deployed>}   ← open this in the browser"
echo
echo "Smoke tests:"
echo "  curl -s ${BACKEND_URL}/api/health"
echo "  curl -s ${BACKEND_URL}/api/ibm/mode"
if [[ -n "${GAME_URL}" ]]; then
  echo "  curl -s -o /dev/null -w '%{http_code}\\n' ${GAME_URL}/"
  echo "  curl -s ${GAME_URL}/api/health"
fi
