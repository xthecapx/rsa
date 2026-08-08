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

set -euo pipefail

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
# Each buildx push leaves a few digests (index + amd64 + attestation). Keep 2
# so the live image stays intact; drop everything older to stay under the
# Artifact Registry free-tier storage cap (0.5 GB).
KEEP_DIGESTS="${KEEP_DIGESTS:-2}"

prune_old_digests() {
  local package="$1"
  echo "==> Pruning old digests for ${package} (keeping ${KEEP_DIGESTS})"
  local digests i=0
  digests="$(gcloud artifacts docker images list "${package}" \
    --sort-by=~CREATE_TIME \
    --format='value(version)' 2>/dev/null || true)"
  while IFS= read -r digest; do
    [[ -z "${digest}" ]] && continue
    i=$((i + 1))
    if (( i > KEEP_DIGESTS )); then
      echo "    delete ${digest}"
      gcloud artifacts docker images delete "${package}@${digest}" \
        --quiet --delete-tags >/dev/null || true
    fi
  done <<< "${digests}"
}

echo "==> Project ${PROJECT_ID}  region ${REGION}"
# Cloud Run only runs linux/amd64. On Apple Silicon, the default build is
# arm64 and the deploy fails with "must support amd64/linux".
PLATFORM="${PLATFORM:-linux/amd64}"

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

BACKEND_URL="$(gcloud run services describe rsa-backend --region="${REGION}" --format='value(status.url)')"
echo "==> Backend URL: ${BACKEND_URL}"

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

GAME_URL="$(gcloud run services describe rsa-game --region="${REGION}" --format='value(status.url)')"

echo
echo "Done."
echo "  Backend: ${BACKEND_URL}"
echo "  Game:    ${GAME_URL}   ← open this in the browser"
echo
echo "Smoke tests:"
echo "  curl -s ${BACKEND_URL}/api/health"
echo "  curl -s ${BACKEND_URL}/api/ibm/mode"
echo "  curl -s -o /dev/null -w '%{http_code}\\n' ${GAME_URL}/"
echo "  curl -s ${GAME_URL}/api/health"
