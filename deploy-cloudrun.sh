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
#   ./deploy-cloudrun.sh cleanup    # prune images without building or deploying
#   CLEANUP_DRY_RUN=1 ./deploy-cloudrun.sh cleanup  # preview only

set -euo pipefail

TARGET="${1:-all}"
case "${TARGET}" in
  all|backend|game|cleanup) ;;
  *)
    echo "Usage: $0 [all|backend|game|cleanup]"
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
# Retain complete image indexes and their children, not an estimated number
# of raw digests. Tagged releases are also protected.
KEEP_IMAGES="${KEEP_IMAGES:-2}"
if [[ ! "${KEEP_IMAGES}" =~ ^[1-9][0-9]*$ ]]; then
  echo "KEEP_IMAGES must be a positive integer" >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for Artifact Registry cleanup" >&2
  exit 1
fi

prune_old_digests() {
  local package="$1"
  local -a cleanup_args=("${ROOT}/scripts/prune-artifact-images.py" "${package}"
    "--project=${PROJECT_ID}" "--keep=${KEEP_IMAGES}")
  if [[ "${CLEANUP_DRY_RUN:-0}" == "1" ]]; then cleanup_args+=(--dry-run); fi
  if ! python3 "${cleanup_args[@]}"; then
    echo "Image cleanup did not complete for ${package}. Any completed deployment remains deployed." >&2
    return 1
  fi
}

echo "==> Project ${PROJECT_ID}  region ${REGION}  target ${TARGET}"
if [[ "${TARGET}" == "cleanup" ]]; then
  prune_old_digests "${REGISTRY}/backend"
  prune_old_digests "${REGISTRY}/game"
  exit 0
fi
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
