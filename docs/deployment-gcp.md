# GCP Deployment Guide

Deploy WebClaw to Google Cloud Platform using Cloud Run, Artifact Registry, and Firestore. Two deployment methods are available: a quick shell script for rapid iteration and Terraform for production infrastructure-as-code.

## Prerequisites

| Tool | Installation |
|:-----|:-------------|
| Google Cloud CLI (`gcloud`) | [Install Guide](https://cloud.google.com/sdk/docs/install) |
| Docker | [Install Guide](https://docs.docker.com/get-docker/) |
| Terraform (Option B only) | [Install Guide](https://developer.hashicorp.com/terraform/install) |
| A GCP project with billing enabled | [Console](https://console.cloud.google.com/) |

### Initial GCP Setup

```bash
# Authenticate
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

## Option A: Quick Deploy (Shell Script)

The fastest path from code to production. One command builds the Docker image, pushes to Artifact Registry, and deploys to Cloud Run.

```bash
cd infra
chmod +x deploy.sh
./deploy.sh YOUR_PROJECT_ID us-central1
```

### What `deploy.sh` Does

```bash
# 1. Create Artifact Registry repository (if needed)
gcloud artifacts repositories create webclaw \
  --repository-format=docker \
  --location=$REGION

# 2. Build Docker image
docker build -t $REGION-docker.pkg.dev/$PROJECT/webclaw/gateway:latest \
  ../gateway

# 3. Push to Artifact Registry
docker push $REGION-docker.pkg.dev/$PROJECT/webclaw/gateway:latest

# 4. Deploy to Cloud Run
gcloud run deploy webclaw-gateway \
  --image $REGION-docker.pkg.dev/$PROJECT/webclaw/gateway:latest \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --session-affinity \
  --set-env-vars GOOGLE_API_KEY=$GOOGLE_API_KEY
```

### After Deployment

The script outputs the Cloud Run service URL:

```
Service URL: https://webclaw-gateway-abc123-uc.a.run.app
```

Test it:

```bash
curl https://webclaw-gateway-abc123-uc.a.run.app/health
```

Update your embed script to use the production URL:

```html
<script src="https://webclaw-gateway-abc123-uc.a.run.app/embed.js"
        data-site-id="your_site_id"
        data-gateway="https://webclaw-gateway-abc123-uc.a.run.app">
</script>
```

## Option B: Terraform (Production)

Terraform provides reproducible, version-controlled infrastructure with full state management.

### Configuration

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
project_id     = "your-gcp-project-id"
region         = "us-central1"
gemini_api_key = "your-gemini-api-key"
```

### Deploy

```bash
terraform init
terraform plan    # Review changes
terraform apply   # Apply changes
```

### Resources Created

Terraform provisions the following resources:

| Resource | Type | Purpose |
|:---------|:-----|:--------|
| `google_artifact_registry_repository` | Artifact Registry | Container image storage |
| `google_cloud_run_v2_service` | Cloud Run | Gateway hosting |
| `google_firestore_database` | Firestore | Site configs, sessions (Native mode) |
| `google_cloud_run_v2_service_iam_member` | IAM | Public access (unauthenticated invocation) |
| `google_project_service` | API enablement | Required GCP APIs |

### Terraform Variables

| Variable | Type | Required | Default | Description |
|:---------|:-----|:--------:|:--------|:------------|
| `project_id` | string | ✅ | - | GCP project ID |
| `region` | string | | `"us-central1"` | GCP region |
| `gemini_api_key` | string | ✅ | - | Gemini API key |
| `service_name` | string | | `"webclaw-gateway"` | Cloud Run service name |
| `max_instances` | number | | `10` | Cloud Run max instance count |

### Updating the Deployment

After code changes:

```bash
# Rebuild and push the container
cd infra
./deploy.sh YOUR_PROJECT_ID us-central1

# Or with Terraform
terraform apply
```

### Destroying Resources

```bash
terraform destroy
```

This removes all provisioned resources. Firestore data is also deleted.

## Docker Image

The gateway's `Dockerfile` builds a production-ready container:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Copy embed script (pre-built)
COPY ../embed/dist/ /app/static/

# Cloud Run uses PORT env var
ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Build locally:**

```bash
cd gateway
docker build -t webclaw-gateway .
docker run -p 8081:8080 -e GOOGLE_API_KEY=your_key webclaw-gateway
```

## Cloud Run Configuration

### Session Affinity

WebSocket connections require session affinity so that all frames in a connection are routed to the same container instance. This is enabled in both deployment methods:

- **Shell script:** `--session-affinity` flag
- **Terraform:** `session_affinity = true` in the template

### Scaling

| Setting | Default | Description |
|:--------|:--------|:------------|
| Min instances | 0 | Scale to zero when idle (cost savings) |
| Max instances | 10 | Maximum concurrent containers |
| Concurrency | 80 | Requests per container (each WebSocket = 1) |
| CPU | 1 | vCPUs per instance |
| Memory | 512Mi | RAM per instance |
| Timeout | 300s | Maximum request duration (WebSocket connections) |

For production, consider:

```bash
gcloud run services update webclaw-gateway \
  --min-instances=1 \        # Avoid cold starts
  --max-instances=50 \       # Handle traffic spikes
  --concurrency=40 \         # Lower concurrency per instance for WebSocket
  --timeout=3600 \           # 1-hour WebSocket sessions
  --cpu=2 \                  # More CPU for audio processing
  --memory=1Gi
```

### Environment Variables

| Variable | Required | Description |
|:---------|:--------:|:------------|
| `GOOGLE_API_KEY` | ✅ | Gemini API key |
| `GOOGLE_CLOUD_PROJECT` | | GCP project (auto-set on Cloud Run) |
| `PORT` | | Server port (auto-set by Cloud Run, default 8080) |

### Custom Domain

Map your domain to the Cloud Run service:

```bash
gcloud run domain-mappings create \
  --service webclaw-gateway \
  --domain gateway.webclaw.dev \
  --region us-central1
```

Follow the DNS verification instructions output by the command.

## Cost Estimation

| Component | Free Tier | Estimated Cost (Low Traffic) |
|:----------|:----------|:-----------------------------|
| Cloud Run | 2M requests/mo, 360K vCPU-seconds | ~$0-5/mo |
| Artifact Registry | 500MB storage | ~$0/mo |
| Firestore | 1GB storage, 50K reads/day | ~$0/mo |
| Gemini API | Varies by model | Pay-per-use |

For a low-traffic deployment (< 1000 sessions/day), total GCP costs are typically under $10/month excluding Gemini API usage.

## Monitoring

### Cloud Run Logs

```bash
gcloud run services logs read webclaw-gateway --region us-central1 --limit 50
```

### Cloud Run Metrics

View in the [Cloud Console](https://console.cloud.google.com/run):

- Request count and latency
- Instance count over time
- Memory and CPU utilization
- Error rates (4xx, 5xx)

### Alerting

Set up alerts for:

- Error rate > 5% over 5 minutes
- Instance count at max (scaling limit reached)
- Latency p99 > 5 seconds
