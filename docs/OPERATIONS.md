# Operations

Notes for running the live demo. Judges don't need this page; the [README](../README.md) is for them.

## What runs where

| Piece | Name | Notes |
|---|---|---|
| Cloud Run service | `assent` (us-central1) | 2 vCPU, 2 GiB, concurrency 10, 0–3 instances, startup probe on `/api/health` |
| Container images | Artifact Registry `likeness-meta` | the last 3 images are kept |
| Database | Firestore database `likeness-meta` | likeness-ai's database `likeness` is refused in code (`lib/server/gcp.ts`) |
| Files | bucket `<project>-likeness-meta-private` | encrypted reference photos, renders, previews; likeness-ai's bucket is refused |
| Keys | Cloud KMS key ring `likeness`: `photos` (wraps each creator's photo key), `receipts` (signs receipts) | shared with likeness-ai, so the copied synthetic creators' frames open unchanged |
| Secrets | Secret Manager `likeness-meta-model-api-key`, `likeness-meta-c2pa-cert`, `likeness-meta-c2pa-key` | mounted at `:latest` as `MODEL_API_KEY`, `C2PA_CERT_PEM`, `C2PA_KEY_PEM` |
| Sign-in | Firebase Authentication (Google; email and password for the two judge accounts) | the Cloud Run domain must be an authorised domain |
| Service account | `likeness-run` | |

The image repository, database, bucket and secrets keep their earlier `likeness-meta` names; only the
service was renamed to `assent`. likeness-ai's service (`likeness`) and its data are never touched.

## Deploying

```sh
IMAGE_TAG=assent-YYYYMMDDx sh scripts/deploy-gcp.sh PROJECT_ID
```

- Builds with Cloud Build (`CLOUD_BUILD_MACHINE` picks a larger machine; the default is fine) and deploys to `assent`.
- Refuses `AI_PROVIDER=fixture`. `SERVICE`, `REGION` and `APP_URL` override the defaults.
- `--set-env-vars` replaces the whole environment on every deploy, and secrets are read at `:latest`.
- It sets `--min-instances=0`: during judging, set 1 again after any deploy (below).
- After a deploy: `/api/health` answers `{"ok":true,"warm":true}`, the start page loads, and likeness-ai's
  service is still on its own revision.

## During judging

- **Minimum instances.** Set 1 instance from the submission deadline (4 Nov 2026) until a few days after the
  9 Nov finals, so judges never wait for a cold start (about 12–18 s); then back to 0. Roughly $0.9 a day at
  Cloud Run's idle rate for 2 vCPU and 2 GiB.
  ```sh
  gcloud run services update assent --min-instances=1 --region=us-central1 --project=PROJECT_ID   # judging
  gcloud run services update assent --min-instances=0 --region=us-central1 --project=PROJECT_ID   # afterwards
  ```
- **Judge accounts.** `pnpm seed:judges` creates the judge brand (Brew & Co.) and the judge creator (Maya
  Okafor, synthetic) with generated passwords in `.secrets/judge-accounts.json` (git-ignored, mode 0600). The
  credentials go in the submission form only, never in the repository.
- **Reset demo.** The judge accounts see a "Reset demo" button: the judge licence goes back to 0 renders and
  active, and the judge brand's credits back to 2,000. Reset it before judging starts.
- **Eval brand.** `pnpm reset:eval` restores the eval licence and credits (never the judge accounts).
- **Daily limits.** 40 renders a day site-wide, 25 for the judge brand, 3 for any other brand, 20 for the eval
  brand (UTC days). At about $0.03–0.04 a render, a full day costs at most about $1.60 in model calls.

## Meta API terms on free credits

On free credits, Meta may use inputs for product improvement. Only synthetic creators (generated faces, no real
person) are sent to the Meta API in this demo. A production deployment would use paid billing with that
turned off before any real creator's photos were sent.

## Rotating the C2PA test certificate

```sh
sh scripts/c2pa-testcert.sh --rotate     # the current chain moves to .secrets/c2pa/previous-<time>/
gcloud secrets versions add likeness-meta-c2pa-cert --data-file=.secrets/c2pa/signer.pem --project=PROJECT_ID
gcloud secrets versions add likeness-meta-c2pa-key  --data-file=.secrets/c2pa/signer.key --project=PROJECT_ID
```

Leave the old secret versions enabled. Each signed file carries its own chain, so files signed with an
earlier certificate keep verifying (tested in `lib/server/c2pa.test.ts`). The service picks up the new
versions on its next deploy.
