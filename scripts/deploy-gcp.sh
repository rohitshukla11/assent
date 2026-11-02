#!/bin/sh
# Build and deploy Assent (formerly Likeness Meta) to Cloud Run as its own service "assent", separate from likeness-ai (billed:
# Cloud Build minutes beyond the free tier, Artifact Registry storage, Cloud Run requests). Run from
# the repository root:
#
#   sh scripts/deploy-gcp.sh PROJECT_ID
#
# Needs: gcloud signed in as a project owner; Firestore database "likeness-meta", the private bucket
# ${PROJECT}-likeness-meta-private, the KMS keys and service account likeness-run; .env.local with the
# public Firebase web config. The service is "assent"; the image repository, database, bucket and secrets it
# uses keep their likeness-meta names (not renamed), so likeness-ai's service, database, bucket, images and
# secrets are never touched. SERVICE=likeness-meta deploys the earlier service instead. Prints no secret: the C2PA test
# certificate goes to Secret Manager straight from .secrets/c2pa.
set -eu
# AI_PROVIDER=fixture (a stored image instead of a model) is for development only: never deployed.
if [ "${AI_PROVIDER:-}" = "fixture" ] || grep -qE '^AI_PROVIDER=fixture' .env.local 2>/dev/null; then
  echo "refusing to deploy with AI_PROVIDER=fixture (development only)" >&2
  exit 1
fi
PROJECT="${1:?usage: sh scripts/deploy-gcp.sh PROJECT_ID}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-assent}"
case "$SERVICE" in likeness | likeness-ai) echo "refusing to deploy over $SERVICE (likeness-ai's service)" >&2; exit 1 ;; esac
SA="likeness-run@${PROJECT}.iam.gserviceaccount.com"
REPO="${REGION}-docker.pkg.dev/${PROJECT}/likeness-meta"
GCLOUD="${GCLOUD:-gcloud}"
# IMAGE_TAG overrides the commit-based tag (e.g. when deploying uncommitted work).
TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"
PROVIDER="${AI_PROVIDER:-meta}"
# The Meta Model API key: a Secret Manager secret the owner creates; this script never creates it or reads its value.
MODEL_SECRET="likeness-meta-model-api-key"
# With meta, the key's secret must exist before anything else runs (describe reads its metadata, never its value).
if [ "$PROVIDER" = "meta" ] && ! $GCLOUD secrets describe "$MODEL_SECRET" --project="$PROJECT" >/dev/null 2>&1; then
  echo "AI_PROVIDER=meta needs the Secret Manager secret $MODEL_SECRET (the Meta Model API key) in $PROJECT: create it, then deploy again" >&2
  exit 1
fi
NUMBER="$($GCLOUD projects describe "$PROJECT" --format='value(projectNumber)')"
URL="${APP_URL:-https://${SERVICE}-${NUMBER}.${REGION}.run.app}"
val() { grep -E "^$1=" .env.local | tail -1 | cut -d= -f2-; }

echo "Project $PROJECT ($NUMBER), region $REGION, service $SERVICE → $URL (AI_PROVIDER=$PROVIDER, image tag $TAG)"


# 1. Artifact Registry repository for the image (once).
$GCLOUD artifacts repositories describe likeness-meta --location="$REGION" --project="$PROJECT" >/dev/null 2>&1 ||
  $GCLOUD artifacts repositories create likeness-meta --repository-format=docker --location="$REGION" --project="$PROJECT" --quiet
# Keep only the 3 most recent images (Artifact Registry applies cleanup policies about once a day).
cat > /tmp/likeness-meta-cleanup.json <<'JSON'
[
  { "name": "keep-last-3", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 3 } },
  { "name": "delete-the-rest", "action": { "type": "Delete" }, "condition": { "tagState": "any" } }
]
JSON
$GCLOUD artifacts repositories set-cleanup-policies likeness-meta --location="$REGION" --project="$PROJECT" --policy=/tmp/likeness-meta-cleanup.json --no-dry-run --quiet >/dev/null

# 2. C2PA test certificate in Secret Manager (once), readable only by the service account.
for pair in "likeness-meta-c2pa-cert:.secrets/c2pa/signer.pem" "likeness-meta-c2pa-key:.secrets/c2pa/signer.key"; do
  name="${pair%%:*}"; file="${pair#*:}"
  if ! $GCLOUD secrets describe "$name" --project="$PROJECT" >/dev/null 2>&1; then
    $GCLOUD secrets create "$name" --replication-policy=automatic --data-file="$file" --project="$PROJECT" --quiet >/dev/null
    echo "created secret $name"
  fi
  $GCLOUD secrets add-iam-policy-binding "$name" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --project="$PROJECT" --quiet >/dev/null
done
SECRETS="C2PA_CERT_PEM=likeness-meta-c2pa-cert:latest,C2PA_KEY_PEM=likeness-meta-c2pa-key:latest"
if [ "$PROVIDER" = "meta" ]; then
  # The service account may read this one secret; nothing else gets access.
  $GCLOUD secrets add-iam-policy-binding "$MODEL_SECRET" --member="serviceAccount:$SA" --role=roles/secretmanager.secretAccessor --project="$PROJECT" --quiet >/dev/null
  SECRETS="${SECRETS},MODEL_API_KEY=${MODEL_SECRET}:latest"
fi

# 3. Build with Cloud Build (public Firebase config compiled in).
cat > /tmp/likeness-meta-cloudbuild.yaml <<YAML
steps:
  - name: gcr.io/cloud-builders/docker
    args: [build, -t, "${REPO}/web:${TAG}",
      --build-arg, "NEXT_PUBLIC_FIREBASE_API_KEY=$(val NEXT_PUBLIC_FIREBASE_API_KEY)",
      --build-arg, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$(val NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN)",
      --build-arg, "NEXT_PUBLIC_FIREBASE_PROJECT_ID=$(val NEXT_PUBLIC_FIREBASE_PROJECT_ID)",
      --build-arg, "NEXT_PUBLIC_FIREBASE_APP_ID=$(val NEXT_PUBLIC_FIREBASE_APP_ID)",
      --build-arg, "NEXT_PUBLIC_APP_URL=${URL}",
      "."]
images: ["${REPO}/web:${TAG}"]
timeout: 1800s
YAML
# The default build machine (e2-standard-2) is in Cloud Build's free tier. Only if a build runs out of
# memory, run that one build with CLOUD_BUILD_MACHINE=E2_HIGHCPU_8.
if [ -n "${CLOUD_BUILD_MACHINE:-}" ]; then
  printf 'options:\n  machineType: %s\n' "$CLOUD_BUILD_MACHINE" >> /tmp/likeness-meta-cloudbuild.yaml
fi
$GCLOUD builds submit . --config=/tmp/likeness-meta-cloudbuild.yaml --project="$PROJECT" --quiet

# 4. Deploy to Cloud Run as the least-privilege service account.
# Startup probe: short, frequent attempts on /api/health (it answers once the warm-up is done; an attempt that
# times out doesn't stop the warm-up), so an instance takes traffic within a few seconds of being ready.
$GCLOUD run deploy "$SERVICE" --image="${REPO}/web:${TAG}" --region="$REGION" --project="$PROJECT" \
  --service-account="$SA" --allow-unauthenticated \
  --cpu=2 --memory=2Gi --timeout=600 --concurrency=10 --min-instances=0 --max-instances=3 --cpu-boost \
  --startup-probe=httpGet.path=/api/health,httpGet.port=8080,initialDelaySeconds=0,timeoutSeconds=3,periodSeconds=3,failureThreshold=60 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT},GCP_REGION=${REGION},FIRESTORE_DATABASE=likeness-meta,GCS_BUCKET=${PROJECT}-likeness-meta-private,KMS_KEYRING=likeness,NEXT_PUBLIC_APP_URL=${URL},FACE_MATCH_THRESHOLD=${FACE_MATCH_THRESHOLD:-0.5},RENDERS_PER_DAY=${RENDERS_PER_DAY:-40},AI_PROVIDER=${PROVIDER},ADMIN_EMAILS=$(val ADMIN_EMAILS)" \
  --set-secrets="$SECRETS" \
  --quiet

echo "Live: $URL   (status: $URL/api/status)"
echo "Add this domain to Firebase → Authentication → Settings → Authorized domains: ${URL#https://}"
