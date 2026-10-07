#!/bin/bash
# Deploy WebClaw Gateway to Cloud Run
set -euo pipefail

PROJECT_ID="${1:?Usage: ./deploy.sh <project-id> [region]}"
REGION="${2:-us-central1}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/webclaw/gateway:latest"

echo "==> Building gateway image..."
cd "$(dirname "$0")/../gateway"
docker build --platform linux/amd64 -t "${IMAGE}" .

echo "==> Pushing to Artifact Registry..."
docker push "${IMAGE}"

echo "==> Deploying to Cloud Run..."
gcloud run deploy webclaw-gateway \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --min-instances 0 \
  --max-instances 10 \
  --session-affinity \
  --memory 1Gi \
  --cpu 2 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=FALSE"

echo "==> Done! Gateway URL:"
gcloud run services describe webclaw-gateway --region "${REGION}" --format 'value(status.url)'
