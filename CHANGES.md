# Changes from likeness-ai

## Summary

Assent (formerly "Likeness Meta") starts from the web app of likeness-ai, Rohit's earlier project
([rohitshukla11/likeness-ai](https://github.com/rohitshukla11/likeness-ai), built 10–18 Oct 2026), copied to
this repository's root for the Meta Global AI Developer Hackathon (27 Oct – 4 Nov 2026). likeness-ai itself is
not modified.

- **Files:** 57 copied unchanged, 70 modified, 115 new, 10 removed. The counts come from comparing each file byte for byte with
  `likeness-ai/web/<path>` (and `likeness-ai/LICENSE`), as of 2 Nov 2026.
- **AI:** Meta's models replace Gemini as the default. Muse Spark is the brand agent, the policy check, the
  output reviewer and the alternative shot; Muse Image does the generation; SAM 3.1 runs the consent gate.
  Gemini stays as the fallback (`AI_PROVIDER=google`).
- **Decisions in code:** a policy code decides on every model proposal, and a consent gate on every generated
  image allows only one person, who must be the licensed creator.
- **Render pipeline:** a step log with a live timeline and the consent figure; idempotent renders; daily limits,
  rate limits and a spending cap; reason codes with error cards.
- **Demo and admin tools:** judge mode, an admin view, a fixture provider for development and an evaluation
  harness with real results.
- **Rename:** the app is renamed Assent and runs as its own Cloud Run service, `assent`.
- **Removed:** video generation.

Paths are from this repository's root. Below, **Files by feature** lists every file; **Change log by
feature** says what changed, in order, with dates and model spend where there was any. A later entry
supersedes an earlier one.

## Files by feature

### Workspace, infrastructure, deploy and docs

- **New (10):** `.gcloudignore`, `CHANGES.md`, `README.md`, `app/api/health/route.ts`, `docs/OPERATIONS.md`, `instrumentation.ts`, `lib/server/gcp.test.ts`, `lib/server/startup.ts`, `lib/server/status.test.ts`, `lib/server/testing/memoryFirestore.ts`
- **Modified (16):** `.dockerignore`, `.env.example`, `.gitignore`, `Dockerfile`, `LICENSE`, `app/api/status/route.ts`, `lib/server/authn.ts`, `lib/server/gcp.ts`, `lib/server/http.ts`, `lib/server/secret.test.ts`, `lib/server/secret.ts`, `lib/server/status.ts`, `lib/server/storage.ts`, `package.json`, `scripts/deploy-gcp.sh`, `vitest.config.mts`
- **Copied unchanged (11):** `AGENTS.md`, `CLAUDE.md`, `lib/server/firebase-admin.ts`, `lib/server/route.ts`, `lib/server/test-server-only.ts`, `lib/server/util.ts`, `next.config.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `postcss.config.mjs`, `tsconfig.json`

### Meta AI layer (Muse Spark, Muse Image, SAM 3.1) and the Gemini fallback

- **New (36):** `lib/creative.test.ts`, `lib/server/ai/alternative.test.ts`, `lib/server/ai/alternative.ts`, `lib/server/ai/budget.test.ts`, `lib/server/ai/budget.ts`, `lib/server/ai/fixture/agent.ts`, `lib/server/ai/fixture/fixture.test.ts`, `lib/server/ai/fixture/image.ts`, `lib/server/ai/google/agent.ts`, `lib/server/ai/google/google.test.ts`, `lib/server/ai/google/image.ts`, `lib/server/ai/index.test.ts`, `lib/server/ai/index.ts`, `lib/server/ai/jsonSchema.test.ts`, `lib/server/ai/jsonSchema.ts`, `lib/server/ai/meta/client.ts`, `lib/server/ai/meta/image.ts`, `lib/server/ai/meta/meta.test.ts`, `lib/server/ai/meta/real-shapes.test.ts`, `lib/server/ai/meta/sam.test.ts`, `lib/server/ai/meta/sam.ts`, `lib/server/ai/meta/samFormat.ts`, `lib/server/ai/meta/spark.test.ts`, `lib/server/ai/meta/spark.ts`, `lib/server/ai/policy.test.ts`, `lib/server/ai/policy.ts`, `lib/server/ai/pricing.test.ts`, `lib/server/ai/pricing.ts`, `lib/server/ai/prompts.ts`, `lib/server/ai/types.ts`, `lib/server/filter.test.ts`, `lib/server/gemini.test.ts`, `lib/server/rules.ts`, `scripts/muse-image-check.ts`, `scripts/sam-check.ts`, `scripts/spark-check.ts`
- **Modified (11):** `app/api/assistant/route.ts`, `components/dashboard/CreativeAssistant.tsx`, `lib/categories.ts`, `lib/creative.ts`, `lib/policy.test.ts`, `lib/server/assistant.test.ts`, `lib/server/assistant.ts`, `lib/server/filter.ts`, `lib/server/gemini.ts`, `lib/server/render/gemini.ts`, `lib/server/render/types.ts`

### Consent gate

- **New (8):** `components/dashboard/ConsentFigure.tsx`, `lib/figureLayout.test.ts`, `lib/figureLayout.ts`, `lib/server/ai/local/segmenter.ts`, `lib/server/consentGate.test.ts`, `lib/server/consentGate.ts`, `lib/server/facecheck.test.ts`, `lib/server/facecheck.ts`
- **Modified (4):** `lib/server/facematch.ts`, `lib/server/facemodels.ts`, `lib/server/framing.test.ts`, `lib/server/framing.ts`
- **Copied unchanged (2):** `lib/server/facematch.test.ts`, `scripts/face-models.sh`

### Render pipeline: step log, idempotency, limits, errors, payment

- **New (15):** `app/api/render/alternative/route.ts`, `app/api/render/log/route.ts`, `components/dashboard/ErrorNotice.tsx`, `components/dashboard/RenderTimeline.tsx`, `lib/reasons.test.ts`, `lib/reasons.ts`, `lib/server/idempotency.test.ts`, `lib/server/idempotency.ts`, `lib/server/rateLimit.test.ts`, `lib/server/rateLimit.ts`, `lib/server/render-image.test.ts`, `lib/server/render-review.test.ts`, `lib/server/renderLog.test.ts`, `lib/server/renderLog.ts`, `lib/server/renders-routes.test.ts`
- **Modified (8):** `app/api/render/image/route.ts`, `app/api/renders/[id]/url/route.ts`, `app/api/renders/route.ts`, `components/dashboard/BrandDashboard.tsx`, `components/dashboard/RenderCard.tsx`, `components/dashboard/shared.tsx`, `lib/server/accounts.ts`, `lib/server/render-image.ts`
- **Copied unchanged (1):** `app/api/credits/topup/route.ts`

### Label, content credential, receipts and Verify

- **New (6):** `lib/server/c2pa.test.ts`, `lib/server/label.test.ts`, `lib/server/verify.test.ts`, `lib/verifyText.test.ts`, `lib/verifyText.ts`, `scripts/make-label.mts`
- **Modified (7):** `app/(app)/verify/page.tsx`, `app/api/verify/route.ts`, `lib/server/c2pa.ts`, `lib/server/label.ts`, `lib/server/verify.ts`, `lib/server/watermarks.ts`, `scripts/c2pa-testcert.sh`
- **Copied unchanged (3):** `lib/server/kms.ts`, `lib/server/receipts.test.ts`, `lib/server/receipts.ts`

### Creators, licences, judge mode, demo data and admin

- **New (12):** `app/(app)/admin/page.tsx`, `app/api/admin/overview/route.ts`, `app/api/demo/reset/route.ts`, `components/auth/JudgeSignIn.tsx`, `components/dashboard/ResetDemo.tsx`, `lib/server/admin.test.ts`, `lib/server/admin.ts`, `lib/server/demo.test.ts`, `lib/server/demo.ts`, `lib/server/licences-routes.test.ts`, `scripts/copy-demo-creators.ts`, `scripts/seed-judges.ts`
- **Modified (9):** `app/(app)/creator/onboard/page.tsx`, `app/(app)/creators/[id]/page.tsx`, `app/(app)/creators/page.tsx`, `app/api/creator/decryptions/route.ts`, `app/api/me/route.ts`, `components/dashboard/CreatorDashboard.tsx`, `lib/server/creators.ts`, `lib/server/licences.ts`, `lib/server/vault.ts`
- **Copied unchanged (15):** `app/api/brand/route.ts`, `app/api/creator/golive/route.ts`, `app/api/creator/match/route.ts`, `app/api/creator/terms/route.ts`, `app/api/creator/youtube/route.ts`, `app/api/creators/[id]/route.ts`, `app/api/creators/route.ts`, `app/api/licences/[id]/revoke/route.ts`, `app/api/licences/route.ts`, `app/api/media/creator/[id]/route.ts`, `app/api/requests/[id]/route.ts`, `app/api/requests/route.ts`, `components/creator/LivenessCapture.tsx`, `lib/server/youtube.ts`, `scripts/seed-demo.ts`

### Assent app: pages, rename, site and UI

- **New (4):** `lib/dates.test.ts`, `lib/dates.ts`, `lib/startView.test.ts`, `lib/startView.ts`
- **Modified (15):** `app/(app)/dashboard/page.tsx`, `app/(app)/start/page.tsx`, `app/globals.css`, `app/icon.svg`, `app/layout.tsx`, `components/auth/AuthProvider.tsx`, `components/ds/index.tsx`, `components/landing/Landing.tsx`, `components/site/AppHeader.tsx`, `components/site/SiteFooter.tsx`, `components/ui.tsx`, `lib/client/firebase.ts`, `lib/model.test.ts`, `lib/model.ts`, `lib/site-content.ts`
- **Copied unchanged (25):** `app/(app)/layout.tsx`, `app/(app)/loading.tsx`, `app/(site)/page.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/providers.tsx`, `components/ds/icons.tsx`, `components/ds/motion.tsx`, and the 17 images in `public/landing/`

### Evaluation

- **New (24):** `eval/briefs.json`, `eval/fixtures/README.md`, `eval/fixtures/face-cut.jpg`, `eval/fixtures/maya.jpg`, `eval/fixtures/muse-image-response-low.json`, `eval/fixtures/muse-image-response.json`, `eval/fixtures/no-person.jpg`, `eval/fixtures/sam-response.txt`, `eval/fixtures/spark-plan-response.json`, `eval/fixtures/synthetic-faces.json`, `eval/fixtures/two-people.jpg`, `eval/fixtures/wrong-face.jpg`, `eval/results-dryrun.md`, `eval/results-policy.md`, `eval/results-spark-default.md`, `eval/results-spark-low.md`, `eval/results.md`, `lib/eval/score.test.ts`, `lib/eval/score.ts`, `scripts/eval-fixtures.ts`, `scripts/eval.ts`, `scripts/render-check.ts`, `scripts/reset-eval.ts`, `scripts/synthetic-faces.ts`

### Removed from likeness-ai

- **Removed (10):** `.vercelignore`, `app/api/render/video/route.ts`, `lib/server/gate.test.ts`, `lib/server/gate.ts`, `lib/server/motion.test.ts`, `lib/server/motion.ts`, `lib/server/render-video.ts`, `lib/server/veo.ts`, `lib/video.test.ts`, `scripts/e2e-smoke.ts`

### Reused from likeness-ai inside new or moved files

Not new work: these were moved out of likeness-ai files into new files here.

- **The policy-check screening instruction** (`FILTER_INSTRUCTION`): likeness-ai `lib/server/filter.ts` → `lib/server/ai/prompts.ts`, text unchanged; used by both the Gemini and the Muse Spark policy checks.
- **The banned-use keyword rules** (`RULES`, `ruleCheck`): likeness-ai `lib/server/filter.ts` → `lib/server/rules.ts`, unchanged.
- **The Gemini prompt classifier request** (`geminiCheck`, its schema and settings): likeness-ai `lib/server/filter.ts` → `lib/server/ai/google/agent.ts` (`checkPolicy`), the same request.
- **The face checks** (`fullyVisible`, the best match against the references, the 0.35 threshold and its calibration): likeness-ai `lib/server/gate.ts` → `lib/server/facecheck.ts`, adapted from video frames to one image.
- **Identifiers**, unchanged so files made before the rename still read and verify: the C2PA licence assertion label `xyz.likeness.licence` and its protocol `likeness-ai/1`.
- **The synthetic demo creator** Maya Okafor (a generated face, not a real person) and her encrypted reference frames, copied from likeness-ai's database by `scripts/copy-demo-creators.ts`.

## Change log by feature

### Workspace, infrastructure, deploy and docs

#### Workspace: separate from likeness-ai

- `package.json` (modified): package name `likeness-meta`; dependencies unchanged.
- `.gitignore` (modified): also ignores `.secrets/` (local test certificate, keys) and `.data-demo/`.
- `lib/server/gcp.ts` (modified): defaults to Firestore database `likeness-meta` and bucket `<project>-likeness-meta-private`; refuses likeness-ai's database (`likeness`) and bucket.
- `lib/server/gcp.test.ts` (new): the defaults, and the refusal of likeness-ai's names.
- `scripts/deploy-gcp.sh` (modified): its own service, image repository, database, bucket and Secret Manager names (all `likeness-meta`); refuses to deploy to `likeness`; no video settings; runs from the repository root.
- `scripts/c2pa-testcert.sh` (modified): writes the TEST certificate to `.secrets/c2pa` in this repository.
- `lib/server/c2pa.ts`, `lib/server/status.ts`, `lib/server/secret.ts`, `lib/server/secret.test.ts` (modified): `.secrets/` paths for the repository root (were `../.secrets/` under `web/`); comments name Cloud Run instead of Vercel.
- `components/site/SiteFooter.tsx` (modified): the source link points to `rohitshukla11/likeness-meta`.

#### Submission readiness (2026-11-02, no model calls, no deploy)
- Secrets scan of every publishable file and of the git history: no key, token, password, private key,
  service-account file or Firebase hashing config. Each real secret value held locally (the Meta key, the judge
  passwords, the C2PA private keys, the Firebase web config) was compared with every file and found in none. The
  only matches were public configuration: the region, the project id and the database name. No creator reference
  photos or decrypted frames are in the repository; the eval fixtures are synthetic (`eval/fixtures/README.md`).
- `README.md` (rewritten for judges): a 5-minute test first; then the problem, how Meta's models are used, the
  architecture, results, consent and privacy, running it, what was built before and during the hackathon, known
  limitations, and the licence. The TODO list and ops notes moved out.
- `docs/OPERATIONS.md` (new): services and names, deploying, minimum instances during judging, judge accounts
  and Reset demo, daily limits, the free-credits note, and rotating the C2PA test certificate.
- `CHANGES.md` (restructured): a summary, every file by feature (computed against likeness-ai), and this log
  grouped by feature.
- `LICENSE` (modified): MIT, © 2026 Rohit Shukla (was "The Likeness contributors").
- `package.json` (modified): name `assent`, version 1.0.0, a description, licence and author; `e2e:smoke` removed.
- `scripts/e2e-smoke.ts` (removed): it made a billed render without `--yes` or `--max-usd` and created throwaway
  brands in the live database; `render:check` replaced it.
- `.gitignore` (modified): also ignores `*.key`, `*.onnx`, `*.log` and editor and tool folders.
- `.env.example` (modified): every variable the code reads, each with a safe placeholder or default and a
  one-line comment.
- Checked on a fresh copy of the publishable files (no `.env.local`, `.secrets/` or `.models/`, an empty
  environment): `pnpm install`, then 254 tests pass and 6 skip (they need the face models and the C2PA test
  chain); after `pnpm face:models` and `pnpm c2pa:testcert`, all 260 pass.

### Meta AI layer (Muse Spark, Muse Image, SAM 3.1) and the Gemini fallback

#### Provider-neutral AI layer (Phase 2)

- `lib/server/ai/types.ts` (new): the `ImageGenerator`, `PersonSegmenter`, `BrandAgent` and `OutputReviewer` interfaces, refusal codes, per-call latency and estimated cost; the reviewer returns pass, flag or block; the SAM mask type is a TODO until its format is confirmed (masks are never stored).
- `lib/server/ai/pricing.ts` (new): the one pricing table (Meta Model API prices from its pricing page, 2026-10-29; no Gemini price pinned), turning usage into a cost marked as an estimate, and summing a render's calls (policy check, generation, consent gate).
- `lib/server/ai/index.ts` (new): the `AI_PROVIDER=google|meta` switch (google by default).
- `lib/server/ai/policy.ts` (new): the model proposes, the code decides: licence status, render cap and keyword rules for each proposed shot, with plain-language explanations; the reviewer's verdict from its findings (a licence violation blocks, a brief mismatch flags).
- `lib/server/ai/google/image.ts` (new): likeness-ai's Gemini renderer as an `ImageGenerator`.
- `lib/server/ai/google/agent.ts` (new): likeness-ai's Gemini prompt classifier (moved from `filter.ts`) and creative assistant as a `BrandAgent`.
- `lib/server/ai/local/segmenter.ts` (new): YuNet face counting as the fallback `PersonSegmenter`.
- `lib/server/rules.ts` (new): the banned-use keyword rules, moved out of `filter.ts` unchanged.
- `lib/server/filter.ts` (modified): uses the `BrandAgent`'s model check; refuses when it fails or isn't configured, under both providers (likeness-ai ran rules only without a project); returns the check's metrics for the render's cost.
- `lib/server/render-image.ts` (modified): renders through `ImageGenerator` and records its provider and model.
- `lib/server/render/gemini.ts`, `lib/server/render/types.ts` (modified): an optional product image for multi-image; without it the request is unchanged.
- `lib/server/ai/index.test.ts`, `lib/server/ai/policy.test.ts`, `lib/server/ai/pricing.test.ts`, `lib/server/ai/google/google.test.ts`, `lib/server/filter.test.ts` (new): the switch, the policy decisions and review verdicts, the cost estimates, the Google adapters' requests, and the filter's fail-closed behaviour.

#### Meta adapters (Phase 3)

- `lib/server/ai/meta/client.ts` (new): the Meta Model API client: bearer `MODEL_API_KEY`, timeouts, retries on 429 and 5xx with exponential backoff, jitter and Retry-After; bodies never logged.
- `lib/server/ai/meta/image.ts` (new): `ImageGenerator` on Muse Image over `POST /v1/responses` with the `image_generation` tool: image search, web search and shell always off in code; `store: false`, `stream: false`, PNG; references (and the product photo, last) only as base64 data URLs; aspect mapped to the tool's `size` ("auto" when unset); temperature 0.6, top_p 0.9, max_output_tokens 2048 and reasoning_strength "high" configurable; reasoning strength and latency recorded per call.
- `lib/server/ai/meta/meta.test.ts` (new): fails if any search or shell switch is on; `store`/`stream`, data URLs only, product last, size mapping, configuration, response parsing, retries and backoff, cost, and nothing logged.
- `lib/server/ai/types.ts` (modified): calls record request settings (reasoning strength); the aspect is optional.
- `lib/server/ai/pricing.ts` (modified): notes that Muse Image's usage tokens aren't billed on top of the per-image price.
- `scripts/muse-image-check.ts` (new), `package.json` (modified, `meta:image-check`): one real, billed ($0.01) Muse Image call with the synthetic demo creator's references; saves the response shape, base64 cut short, to `eval/fixtures/muse-image-response.json`.
- `.env.example` (modified): the Muse Image settings.

#### Muse Spark brand agent and output reviewer (Phase 3)

- `lib/server/ai/meta/spark.ts` (new): `BrandAgent` and `OutputReviewer` on Muse Spark over `POST /v1/responses` with structured output (`text.format` json_schema, strict), `store: false`, `stream: false`; every answer is parsed and validated against its schema, and a refusal, invalid JSON or a schema miss is a reason-coded error (fail closed); the agent's shots are proposals decided by `policy.ts`, licence and banned-brief refusals happen before any model call; the reviewer's answer becomes findings and the code decides pass, flag or block; the creator's name is never sent.
- `lib/server/ai/meta/spark.test.ts` (new): the request, every fail-closed path, the code deciding after the model, no creator name, review verdicts, image as a data URL only.
- `lib/server/ai/jsonSchema.ts`, `lib/server/ai/jsonSchema.test.ts` (new): the validator for model answers; it rejects schema keywords it doesn't check.
- `lib/server/ai/prompts.ts` (new file, reused content): holds likeness-ai's policy-check screening instruction, unchanged (see "Reused from likeness-ai" above), shared by the Gemini and Muse Spark policy checks; the only new line is the list of banned-use keys.
- `lib/server/ai/google/agent.ts` (modified): uses the shared instruction (same text).
- `lib/server/ai/index.ts`, `lib/server/ai/index.test.ts` (modified): `AI_PROVIDER=meta` gives Muse Image, the Muse Spark agent and reviewer, and the local face counter until the SAM 3.1 adapter.
- `lib/server/ai/types.ts`, `lib/creative.ts` (modified): shots may carry their prompt details; drafts may come from Muse Spark.
- `lib/server/assistant.ts`, `app/api/assistant/route.ts` (modified): with meta, "Write it for me" plans one shot through the brand agent and returns the code's explanation on a refusal.
- `lib/server/ai/pricing.ts`, `lib/server/ai/pricing.test.ts` (modified): reasoning tokens are priced as output tokens (they are counted within `output_tokens`); `SHOW_MODEL_COST` (on by default).
- `lib/server/render-image.ts`, `app/api/render/log/route.ts` (modified): the model cost is left out of what brands see when `SHOW_MODEL_COST=0`.
- `components/dashboard/RenderCard.tsx`, `components/dashboard/RenderTimeline.tsx`, `components/dashboard/shared.tsx` (modified): model cost shown to brands, labelled as an estimate.
- `.env.example` (modified): Muse Spark settings and `SHOW_MODEL_COST`.
- `README.md` (new): a short README with the TODO list (the note on free credits and synthetic creators).

#### Alternative-shot step

- `lib/server/ai/alternative.ts` (new): when the policy code refuses a proposed shot, or the reviewer flags one, the brand agent gets at most one retry to propose a compliant alternative with the reason as input; the policy code checks it again and a second refusal is final; a revoked or expired licence, OVER_CAP, the daily limit, a failed policy check and a model refusal are never retried.
- `lib/server/ai/alternative.test.ts` (new): refused then approved, refused twice, no retry for LICENCE_REVOKED or OVER_CAP, a reviewer's flag, a model that declines, an agent without the step.
- `lib/server/ai/meta/spark.ts`, `lib/server/ai/meta/spark.test.ts` (modified): Muse Spark `reviseShot` (structured output, validated; a decline or bad answer gives no alternative).
- `lib/server/ai/types.ts` (modified): `BrandAgent.reviseShot` (optional), `AlternativeReason`, decisions name the shot an alternative replaces.
- `lib/server/render-image.ts` (modified): with meta, the brand agent plans the shot from the brief (one alternative if the policy refuses it); after a reviewer's flag, one alternative is checked, rendered and reviewed; the second image is delivered if it passes or is only flagged, otherwise the first (flagged) one; one charge, every call in the render's cost; the prompt actually rendered is stored and hashed into the C2PA manifest. Unchanged with google.
- `lib/server/renderLog.ts`, `lib/server/ai/pricing.ts` (modified): `plan` and `alternative` steps; second attempts are marked `attempt: 2`.
- `components/dashboard/RenderTimeline.tsx` (modified): shows the plan and alternative steps, and marks second attempts.

#### Fixture provider, warm-up, fewer round trips

- `lib/server/ai/fixture/image.ts` (new): `AI_PROVIDER=fixture`, development only: a stored image (`FIXTURE_IMAGE_PATH`) instead of a model call, cost 0, metrics marked "fixture"; the policy check stays real (Gemini).
- `lib/server/ai/fixture/fixture.test.ts` (new): allowed in development, refused in production, cost 0, needs the image, refused by the deploy script.
- `lib/server/ai/index.ts`, `lib/server/ai/types.ts`, `lib/server/ai/pricing.ts` (modified): the fixture provider; refused when `NODE_ENV=production`; the skipped-review note names the provider correctly.
- `instrumentation.ts` (new), `lib/server/startup.ts` (new): at server start, exit if `AI_PROVIDER=fixture` in production (checked: `next start` exits with code 1), then warm up the face models and Firestore before serving.
- `scripts/deploy-gcp.sh` (modified): refuses `AI_PROVIDER=fixture` (shell or `.env.local`) before running anything.
- `lib/server/render-image.ts`, `app/api/renders/route.ts` (modified): fixture renders are marked and left out of the brand's and creator's lists (never shown in the demo); the admin view still shows them.
- `lib/server/facematch.ts` (modified, was copied unchanged): `warmFaceModels`.
- `lib/server/vault.ts` (modified, was copied unchanged): the decryption is logged first, then the key is unwrapped while the encrypted frames download in parallel (was one after another).
- `lib/server/storage.ts` (modified): `getObject` is one request (the download; a 404 means absent) instead of an existence check and a download.
- `lib/server/render-image.ts` (modified): preflight reads credits, today's usage and the judge registry in parallel.
- `scripts/render-check.ts` (modified): `--warm` (warm up first, as the server does) and `--ids` (skip the registry read for a cold run).
- `scripts/reset-eval.ts` (new), `package.json` (modified, `reset:eval`): the eval licence and eval brand's credits back as seeded.
- Runs, 2026-10-29, fixture image = Maya's public photo, eval brand and licence, from a laptop (not representative of Cloud Run in us-central1): cold 21.1 s (licence 4.3 s, photos 8.1 s), warm 22.6 s (licence 3.8 s, photos 11.0 s: warm-up saved only the first Firestore read; the face models load in about 0.1 s), warm after fewer round trips 15.5 s (licence 3.2 s, photos 4.4 s); each: consent gate passed (one person, similarity 0.95), label, C2PA, payment and `/verify` Licensed (receipt valid, C2PA signature valid). Then `reset:eval`: eval licence 3 → 0 renders, eval brand 1,400 → 2,000 credits.

#### First real Meta calls (2026-10-29, about $0.02 estimated)

- `.env.local` (not in git): `MODEL_API_KEY` set.
- Muse Image (`pnpm meta:image-check --yes`): completed in 31.0 s; output items `reasoning`, `message` (empty text), `image_generation_call` (base64 PNG in `result`), as the adapter expects. Asked for 1024x1024, returned 1600×1600. The consent gate on the image passed: Maya's match 0.73 (threshold 0.35). Shape saved to `eval/fixtures/muse-image-response.json` (base64 cut).
- SAM 3.1 (`pnpm meta:sam-check --yes --image .data-demo/muse-image-check.png`): `store: false` accepted and echoed; one person, box 60,107 to 1229,1599 on 1600×1600, the real one_bit mask (1024×802) decoded and passed the canonical re-encode check; 4.0 s. Stream saved to `eval/fixtures/sam-response.txt` (mask payloads cut). `scripts/sam-check.ts` (modified) takes `--image <path>`.
- Muse Spark (`pnpm meta:spark-check --yes`; `scripts/spark-check.ts` new, `package.json` modified): planShots on the eval licence, 6.8 s; the answer matched the plan schema (one shot, allowed by the policy code); reasoning tokens (1,390) are inside output_tokens (1,668), so the estimate doesn't add them twice; Meta's default reasoning effort is "high". Shape saved to `eval/fixtures/spark-plan-response.json` (encrypted reasoning cut).
- `lib/server/ai/meta/real-shapes.test.ts` (new): the three adapters against the saved real shapes (with valid stand-ins where payloads were cut), and the cost estimates from the real usage. No adapter needed a change.
- `lib/server/ai/meta/sam.ts` (modified): comment notes store: false is accepted.

#### Meta by default; the first real end-to-end render; synthetic eval faces (2026-10-30, about $0.07 estimated)

- `lib/server/ai/index.ts`, `lib/server/ai/index.test.ts`, `.env.example`, `README.md` (modified), `.env.local` (not in git): `AI_PROVIDER=meta` is the default; `google` is the fallback. `scripts/deploy-gcp.sh` still deploys with `google` unless `AI_PROVIDER` is set: a meta deploy needs the key on Cloud Run first.
- `scripts/render-check.ts` (modified): also prints the reviewer's verdict, the consent figure's labels and the file type; verifies the delivered file with its own MIME type. First end-to-end render under meta (eval brand, eval licence): delivered in 61.7 s, about $0.039; plan (Muse Spark) 10.7 s $0.0095, policy (Muse Spark) 7.0 s $0.0056, Muse Image 18.0 s $0.01, consent gate (SAM 3.1) 3.5 s $0.0025 with Maya at 0.84, review (Muse Spark) 8.1 s $0.0114, pass; label, C2PA and payment 5.7 s; /verify on the file: Licensed, receipt and C2PA signature valid. Eval licence and credits reset after.
- `scripts/muse-image-check.ts` (modified): `--tag <name>` writes its own files. Muse Image with reasoning strength low on the same brief: 16.2 s, Maya 0.72 (high: 31.0 s, 0.73). Shape in `eval/fixtures/muse-image-response-low.json`. Meta's docs: reasoning strength doesn't change the price (billed per image).
- `lib/server/ai/meta/image.ts`, `lib/server/ai/meta/meta.test.ts` (modified): `museImageBody` (new, exported) holds the request body around any content (settings, store and stream off, image search, web search and shell off); licensed renders still go through `museImageRequest`. Sizes: the API refused "1792x1008" (our 16:9) and "1792x1024" (the docs' example) with HTTP 400 "unknown value", nothing charged; 16:9 is now "1792x1024" and 9:16 "1024x1792", both unconfirmed (README TODO).
- `scripts/synthetic-faces.ts` (new; `pnpm eval:synthetic-faces`), `package.json` (modified): `wrong-face.jpg`, a fully synthetic face from text only, and `two-people.jpg`, the synthetic creator with that face by multi-image edit (1:1); the consent gate on each, locally. `wrong-face.jpg` blocked FACE_MISMATCH at 0.16; `two-people.jpg` blocked MULTIPLE_PEOPLE with "1 · Maya · 0.78" (creator) and "2 · not licensed · 0.15". Prompts and settings in `eval/fixtures/README.md` and `eval/fixtures/synthetic-faces.json`; `two-people.jpg` replaces the interim Maya-twice image.
- `eval/briefs.json` (modified): the wrong-face case reads `wrong-face.jpg`. `scripts/eval-fixtures.ts` (modified): no longer builds `two-people.jpg`.
- `lib/server/consentGate.test.ts` (modified): the local-models test names the local face counter, since the default segmenter is now SAM. `vitest.config.mts` (modified): tests start with `MODEL_API_KEY` empty, so no test can make a real Meta call.

#### Image shapes, eval runs kept out of the creator's views, faster renders (2026-10-30, $0.02)

- Muse Image size probe (two billed images, $0.02; refused sizes are free): "1536x1024" accepted, output 1920×1280 (3:2), 11.8 s; "1024x1536" accepted, output 1280×1920 (2:3), 15.5 s. Earlier: "1024x1024" → 1600×1600; "1792x1008" and "1792x1024" refused. No accepted value gives 16:9 or 9:16.
- `lib/server/ai/meta/image.ts`, `lib/server/ai/meta/meta.test.ts` (modified): `MUSE_IMAGE_SIZES` lists only confirmed exact shapes (1:1); `museImageSize` refuses any other aspect instead of sending a guessed value. Reasoning strength is `low` by default (one pass, about half the time, same price); `.env.example` updated.
- `lib/server/ai/index.ts`, `lib/server/ai/index.test.ts` (modified): `supportedAspects()` (meta: 1:1; google and fixture: all three) and `assertAspect()`. `lib/server/render-image.ts` and `app/api/assistant/route.ts` (modified) refuse an unsupported shape first, with the new reason `UNSUPPORTED_SIZE` (`lib/reasons.ts`), so nothing is spent on planning or policy; tested (no claim, no step log, no fetch).
- `app/api/me/route.ts`, `components/auth/AuthProvider.tsx`, `components/dashboard/BrandDashboard.tsx`, `components/dashboard/CreativeAssistant.tsx` (modified): the brand sees the shapes the server can make; 16:9 and 9:16 are disabled with Meta, with the note "16:9 and 9:16 aren't available with Meta's image model yet."; a "Write it for me" draft in an unavailable shape falls back to 1:1. `components/dashboard/RenderTimeline.tsx` (modified): a live request refused before any step shows no timeline.
- `lib/server/render-image.ts` (modified): eval-brand renders are flagged `evalRun` (renders and blocked renders); the creator's payout is entered and reversed in the same transaction ("Reversal of evaluation run (automated test)"); the photo-access entry reads "Evaluation run (automated test)" (also in `scripts/eval.ts` and `scripts/synthetic-faces.ts`). `app/api/renders/route.ts` (modified) leaves them out of the creator's lists, by the flag or, for older records, by the eval brand's id. `lib/server/admin.ts`, `app/(app)/admin/page.tsx` (modified): marked "Evaluation run (automated test)". Tests in `lib/server/render-image.test.ts` and `lib/server/renders-routes.test.ts`.
- Data, 2026-10-30 (approved): −180 "Reversal of evaluation run (automated test)" on the judge creator's ledger for render `KblHWFy4nqGNdNE5WhoCBE` (the first meta render), which is now flagged `evalRun`. Balance 180 → 0; the ledger sums to 0.
- `lib/server/render-image.ts` (modified): the creator's reference photos are opened and prepared while the plan and policy calls run; if either refuses, the decrypted photos are zeroed unused (the opening stays in the creator's access log). The "frames" step's time is now what the render still waited; its detail gives the full preparation time. Checked with a free fixture render (eval brand; reset after).
- `lib/server/ai/meta/spark.ts`, `lib/server/ai/meta/spark.test.ts`, `.env.example` (modified): reasoning effort per kind of call, `MUSE_SPARK_REASONING_EFFORT_PLAN`, `_POLICY`, `_REVIEW`, each falling back to `MUSE_SPARK_REASONING_EFFORT`, then to none (Meta's default, "high"; unchanged). Each call's metrics record the effort used, Meta's echo included.

#### Shapes 3:2 and 2:3 with Meta, photos opened after policy, eval harness for the real runs (2026-10-30, no spend)

- `lib/creative.ts`, `lib/server/ai/index.ts`, `lib/server/ai/meta/image.ts`, `lib/server/render/types.ts`, `lib/server/render-image.ts`, `lib/server/assistant.ts`, `app/api/render/image/route.ts`, `components/dashboard/shared.tsx`, `components/dashboard/RenderCard.tsx`, `components/dashboard/BrandDashboard.tsx`, `components/dashboard/CreativeAssistant.tsx`, `lib/reasons.ts` (modified): shapes 3:2 and 2:3 added (framing guidance as 16:9 and 9:16). Each provider offers only what it can make: meta 1:1, 3:2 (`1536x1024`), 2:3 (`1024x1536`); google 1:1, 16:9, 9:16; the fixture all five. The brand sees only those buttons (no disabled ones). Tests updated.
- `lib/server/render-image.ts` (modified): the creator's reference photos are opened only after the policy check passes, in parallel with nothing before it (the earlier parallel version is removed). `lib/server/render-image.test.ts`: a policy refusal never calls the vault and leaves no access-log entry; a passing brief opens the photos once (control).
- `app/api/creator/decryptions/route.ts` (modified): stored "Evaluation render" entries are shown as "Evaluation run (automated test)"; the stored entries are not rewritten. Tested.
- `eval/briefs.json` (modified): four banned briefs that pass the local word rules, so only Muse Spark can refuse them (political, deception, impersonation of an official, minors); no adult one, since a miss would generate that image. Refusals accept `BANNED_USE` or `MODEL_REFUSED`; the outside-use case accepts `OUTSIDE_LICENSED_USE` or `MODEL_REFUSED` (the plan model's refusal). The four original banned briefs are refused by the local rules before any model call.
- `lib/eval/score.ts`, `lib/eval/score.test.ts`, `scripts/eval.ts` (modified): accepted-code lists; each render's steps from its log; a per-step table (mean time, mean cost, reasoning effort used) and the run's total cost; the gate cases' figure labels; the model settings in the file; `--tag` writes `eval/results-<tag>.md`; the cost estimate uses the first real render's numbers and leaves out briefs the local rules refuse. Fixture dry run rewritten.

### Consent gate

#### Consent gate for images (both providers)

- `lib/server/consentGate.ts` (new): after generation, before anything is labelled or charged: exactly one person (PersonSegmenter), that person's face inside their box and fully visible, and an AuraFace match at or above `CONSENT_FACE_MATCH_THRESHOLD`; reason codes NO_PERSON, MULTIPLE_PEOPLE, FACE_NOT_VISIBLE, FACE_MISMATCH, GATE_ERROR (fail closed).
- `lib/server/consentGate.test.ts` (new): every reason code, and fail-closed on errors.
- `lib/server/render-image.ts` (modified): the creator's reference faces are prepared before generation (no usable face: refused before any model call); a blocked image is refused and nothing is charged; the gate's result (counts and scores, no pixels or masks) and the render's estimated cost are stored on the render; an image the gate blocks after the paid call is kept in `blockedRenders/{id}` with its cost, charged 0 to the brand, and counted as `blocked` in the day's usage, so cost figures include blocked renders.
- `components/dashboard/RenderCard.tsx`, `components/dashboard/shared.tsx` (modified): show the consent check on each render.

#### SAM 3.1 segmenter

- `lib/server/ai/meta/samFormat.ts` (new): SAM 3.1's output read strictly: the Responses event stream (text deltas until `response.completed`; failed, incomplete, refused or truncated streams throw), the line grammar (frame, object id, box and mask tokens; unknown tokens or keys throw), Meta's base85 and the one_bit mask codec (an adaptive binary range coder; decoded, re-encoded and compared, so only canonical payloads pass). Written from the SAM docs, with the meta-sam-parser package on PyPI (SAM License) read as the format reference; no code copied from it.
- `lib/server/ai/meta/sam.ts` (new): `PersonSegmenter` on `sam-3.1`, as in the console snippet (concept "person", `stream: true`, `metadata.mask_encoding: "one_bit"`), with the image as a base64 data URL, which the SAM docs accept, so nothing goes through the Files API. `store: false` is sent (see the next section). Count, boxes normalised to the image, masks decoded in memory and never stored; a size mismatch, a parse error or a timeout throws, and the consent gate blocks with GATE_ERROR.
- `lib/server/ai/meta/sam.test.ts` (new): base85 and one_bit round trips and refusals; fixtures for 0, 1 and 2+ people, a truncated stream, a failed response and malformed records; the request; the segmenter with fetch mocked; GATE_ERROR on a broken stream.
- `lib/server/ai/meta/client.ts` (modified): `metaStream` for server-sent-events calls (same auth, retries and timeout).
- `lib/server/ai/types.ts` (modified): `Mask` defined (the person's box-sized raster, in memory only); the TODO removed.
- `lib/server/ai/index.ts`, `lib/server/ai/index.test.ts` (modified): with `AI_PROVIDER=meta` the segmenter is SAM 3.1.
- `scripts/sam-check.ts` (new), `package.json` (modified, `meta:sam-check`): the first real call, on the two-person fixture ($0.0025); saves the raw stream with mask payloads cut short to `eval/fixtures/sam-response.txt` and parses it with the gate's code.
- `README.md` (modified): SAM 3.1's row in the model table.

#### Eval brand limit, SAM store, dry-run label, the gate's figure in the timeline

- `lib/server/demo.ts`, `lib/server/demo.test.ts`, `.env.example` (modified): `EVAL_BRAND_RENDERS_PER_DAY` (default 20) for the eval brand only, checked on the server like the judge brand's 25; every other brand keeps 3 and the site-wide limit still applies. `scripts/eval.ts` uses it through `dailyCapsFor` when it checks for room before a run.
- `lib/server/ai/meta/sam.ts`, `lib/server/ai/meta/sam.test.ts` (modified): the SAM request sends `store: false`, as Muse Image does. The SAM docs don't list it, so `scripts/sam-check.ts` (modified) tests it on the first real call: if Meta rejects it (HTTP 400 naming store), the script repeats the call once without it ($0.005 at most) and says so; then `store` comes out of `samRequest` and the README says why.
- `eval/results-dryrun.md`, `scripts/eval.ts`, `lib/eval/score.ts`, `lib/eval/score.test.ts` (modified): a fixture run's file starts with "Dry run with the fixture provider; not results."; a real run's file has nothing above its title. The README says its numbers come only from a real Meta run.
- `lib/server/consentGate.ts`, `lib/server/consentGate.test.ts` (modified): the gate returns a figure of what it saw, numbers and short labels only: the image's size, each person's box (fractions of the image) with their role and match score ("Person 1: Maya Okafor, match 0.81", "Person 2: not licensed, match 0.12", "face not visible"), a clear face outside every person ("Face 2: outside any person"), and the verdict with its code. At most 10 people.
- `lib/server/facematch.ts`, `lib/server/facecheck.ts` (modified): every face found (up to 8) is matched against the creator, not only the best one, so each person in the figure has a score; all embeddings are zeroed after use.
- `lib/server/render-image.ts`, `lib/server/render-image.test.ts` (modified): the figure goes into the consent step of the render log and the render's consent record, for passed and blocked images alike.
- `lib/server/renderLog.ts`, `lib/server/renderLog.test.ts` (modified): the stored figure is cleaned like the rest of the log: numbers rounded, labels cut to 80 characters, at most 10 people, never image data.
- `components/dashboard/ConsentFigure.tsx` (new), `components/dashboard/RenderTimeline.tsx` (modified): the consent step draws the boxes on a blank frame of the image's shape (no pixels), coloured by role and numbered, with the labels and the verdict (Passed, or Blocked with the reason code) underneath.
- `lib/server/ai/fixture/image.ts`, `lib/server/ai/fixture/fixture.test.ts` (modified, development only): `FIXTURE_IMAGE_PATH` may list several images separated by commas, used in turn, one per render, so one dev server can show a passing and a blocked consent figure without a restart.
- `README.md` (modified): TODO: faces other than the licensed creator are compared once to block the image; their embeddings are never stored.

#### Consent figure colours and labels, shorter blocked wording, admin provider filter

- `lib/server/consentGate.ts`, `lib/server/consentGate.test.ts` (modified): the figure's roles: the best fully visible match at or above the threshold is the licensed creator (at most one); another person who also matches is an "extra person"; a lower match is "not licensed"; "face not visible" and "face only" as before. People are numbered left to right; labels read "1 · Maya · 0.95", "2 · not licensed · 0.12". The verdict also gives a short text for the step line ("2 people found", "Face doesn't match (0.20, needs 0.35)", "1 person, face matches (0.95)").
- `components/dashboard/ConsentFigure.tsx` (modified): 480 px wide (scales down on narrow screens), boxes with a light tinted fill: green for the licensed creator, red for whatever blocks the image; each box carries its label in 15 px type; the caption keeps the verdict and code.
- `lib/server/render-image.ts`, `lib/reasons.ts` (modified): a blocked render's consent step line is the short text; the timeline's last line is "Image blocked (CODE); not delivered."; the full reason ("Image blocked by the consent gate: …", capitalised) and what to do are in the red card only, with "Nothing was charged" once (in the next step). The payment-step block reason no longer repeats it either.
- `lib/server/ai/index.ts` (modified): the skipped output review reads "No reviewer for this provider."
- `lib/server/admin.ts`, `app/api/admin/overview/route.ts`, `app/(app)/admin/page.tsx`, `lib/server/admin.test.ts` (modified): provider filter (All, meta, google, fixture) for the totals and both lists; default All. A blocked render's provider comes from its step log, or for older records from its model.

#### Framing findings, the block path tested end to end, Meta deploy prep (2026-10-30, no spend)

- `lib/server/ai/meta/spark.ts`, `lib/server/ai/meta/spark.test.ts` (modified): the review schema has `framingIssues` (headroom, crop, gaze, pose), each with its own sentence for the brand ("The person isn't looking where the shot asks."); `settingMatches` is the place, background and lighting only, and the instruction says framing, crop, gaze and pose are not the setting. Tests: a gaze flag says so and never mentions the setting; the setting finding only when the setting differs; an unknown framing issue fails the schema (the image is blocked). No real reviewer response is saved as a fixture yet (only the plan); the next paid call records one.
- `lib/server/render-review.test.ts` (new): a reviewer's block through the whole pipeline in memory (real payment transaction, ledger, label and step log; models, gate, policy, C2PA, KMS and storage stand-ins): (a) the automatic alternative passes, delivered and charged once, both images' cost on the render; (b) it is blocked too: nothing delivered or charged, both images' cost in blockedRenders. `lib/server/testing/memoryFirestore.ts` (new): the in-memory Firestore, moved out of `lib/server/render-image.test.ts` (modified) so both files share it.
- `scripts/deploy-gcp.sh` (modified): deploys with `AI_PROVIDER=meta` by default; with meta it needs the Secret Manager secret `likeness-meta-model-api-key` (created by the owner; the script never creates it or reads its value, `describe` reads metadata only), checked before anything else runs, grants `likeness-run` `secretAccessor` on that one secret, and mounts it as `MODEL_API_KEY`. Tested: refuses without the secret.
- `lib/server/status.ts`, `lib/server/status.test.ts` (modified): a "Meta Model API" check (admin detail in `/api/status`): "key configured (not called by this check)" with the model names, from configuration only; no model call. Tested.
- `lib/server/render-image.ts` (modified): whether a plan made a model call is no longer judged by latency alone (`madeCall`: latency above 0 or a cost); a call answered within the same millisecond (a mocked one in tests) lost its model, effort and cost from the step log and the render's cost. Found as an intermittent test failure; the suite then passed five runs in a row.
- Deploy, 2026-10-30: Secret Manager `likeness-meta-model-api-key` created from `.env.local` (value never printed), readable only by `likeness-run`; revision `likeness-meta-00004-vcf` (image `meta-20261030a`) with `AI_PROVIDER=meta` and `MODEL_API_KEY` from that secret, `RENDERS_PER_DAY=40`; Ready, `/api/health` 200, `/api/status` ok. The admin view of `/api/status` couldn't be read from here (minting an admin sign-in token needs `iam.serviceAccounts.signBlob`, not granted); the key's presence was confirmed instead from the revision's secret reference, the secret's access policy and the revision starting. likeness-ai unchanged (`likeness-00013-vw6`, `web:6121f4c`, min instances 1). No model calls.

### Render pipeline: step log, idempotency, limits, errors, payment

#### Pipeline: step log, idempotent requests, reviewer, daily limit (Phase 4 and 5 items that need no key)

- `lib/server/renderLog.ts` (new): the render step log in `renderLogs/{renderId}`, one entry per step (licence, policy, frames, generate, consent, review, label, credential, payment) with status, time, reason code, model, estimated cost and settings, written as each step finishes; image-like data is dropped and text cut short whatever is passed in.
- `lib/server/renderLog.test.ts` (new): order, refusals and errors, no image data, a failed write never fails the render.
- `lib/server/idempotency.ts` (new): idempotent render requests in `renderRequests/{renderId}`: the render id comes from the brand and the browser's request id; a repeat returns the first result or refusal and never generates or charges again; a server error (5xx) may be retried; a stuck claim is taken over after 15 minutes.
- `lib/server/idempotency.test.ts` (new): replay, refusal, retry after 5xx, duplicates, reuse for another render.
- `lib/server/render-image.ts` (modified): every step goes through the step log; reason codes on every refusal; the output reviewer runs after the consent gate (a block refuses like the gate, cost kept, nothing charged; a flag delivers with the warning stored on the render); with a requestId the request is idempotent; returns the render id.
- `lib/model.ts`, `lib/policy.test.ts` (modified): blocked images count toward the daily limits, and the message says so.
- `app/api/render/image/route.ts` (modified): accepts `requestId`; 5-minute limit for slower Meta generation.
- `app/api/render/log/route.ts` (new): a render's step log, by `requestId` or `renderId`, for the brand or the creator only.
- `components/dashboard/RenderTimeline.tsx` (new): the step log as a live timeline (status, time, model, cost, reason codes).
- `components/dashboard/BrandDashboard.tsx` (modified): one request id per click; shows the timeline while and after rendering.
- `components/dashboard/RenderCard.tsx`, `components/dashboard/shared.tsx` (modified): show a reviewer's flag on the render.

#### Phase 5: error states, rate limiting, admin view

- `lib/reasons.ts` (new): every refusal and failure reason code in plain language with what to do next, by role (judges are told to press "Reset demo" for a revoked or used-up licence or no credits); falls back on the HTTP status (429, 504, 5xx) when there is no code.
- `lib/reasons.test.ts` (new): scans the server code and fails if any reason code it sends has no plain-language reason; judge next steps; status fallbacks.
- `lib/server/http.ts` (modified): errors carry their reason `code`, and `retryAfter` as a Retry-After header; `HttpError` takes a code.
- `lib/server/render-image.ts`, `lib/server/demo.ts` (modified): codes go through `HttpError`; NOT_JUDGE on a refused reset.
- `lib/client/firebase.ts` (modified): `ApiError` with the status, reason code and Retry-After.
- `components/dashboard/ErrorNotice.tsx` (new): the error, its plain-language reason, the next step and a button where it helps (Reset demo, Find a creator, Use demo top-up, Try again, Edit the brief).
- `components/dashboard/BrandDashboard.tsx`, `components/dashboard/CreativeAssistant.tsx` (modified): show errors with `ErrorNotice`.
- `lib/server/rateLimit.ts`, `lib/server/rateLimit.test.ts` (new): per-user, per-minute limits in Firestore (`rateLimits/{route}:{uid}:{minute}`, with `expiresAt` for a TTL policy): render 6, plan 12, reset 3 by default; over the limit, 429 RATE_LIMITED with Retry-After.
- `app/api/render/image/route.ts`, `app/api/assistant/route.ts`, `app/api/demo/reset/route.ts` (modified): rate limited.
- `lib/server/admin.ts`, `lib/server/admin.test.ts` (new): admins from `ADMIN_UIDS` or verified `ADMIN_EMAILS` (nobody by default); per-render steps with latency and estimated cost, totals per day and per provider, blocked renders with reasons.
- `app/api/admin/overview/route.ts` (new), `app/(app)/admin/page.tsx` (new): the admin view (last 1, 7 or 30 days).
- `lib/server/authn.ts` (modified): whether the caller's email is verified.
- `app/api/me/route.ts`, `components/auth/AuthProvider.tsx`, `components/site/AppHeader.tsx` (modified): `admin` on the account; an Admin link for admins.
- `.env.example` (modified): rate limits and admin lists.

#### Revocation during a render, a wiring check, README skeleton

- `lib/server/render-image.ts` (modified): the payment transaction re-reads the licence and refuses with LICENCE_REVOKED, LICENCE_EXPIRED or OVER_CAP if it changed during the render (also NO_CREDITS, DAILY_LIMIT, RENDER_CONFLICT); `payOrBlock` keeps the render's cost in `blockedRenders` (`blockedBy: "payment"`, with the code), charges nothing, and removes the stored file and preview; reformatted at 200 columns like the rest of the code.
- `lib/server/render-image.test.ts` (new): the licence revoked between generation and payment (refused, nothing charged, files removed, cost kept), expired or used up at payment, and a normal payment; an in-memory Firestore, KMS and storage mocked.
- `lib/server/storage.ts` (modified, was copied unchanged): `deleteObject`.
- `lib/server/admin.ts` (modified): blocked-at-payment records show their code.
- `lib/reasons.ts` (modified): RENDER_CONFLICT.
- `lib/server/gemini.ts` (modified, was copied unchanged): a Gemini call that doesn't answer in time is a 504 with the TIMEOUT code (it escaped as a 500 before), not retried.
- `lib/server/gemini.test.ts` (new): the timeout mapping.
- `scripts/render-check.ts` (new), `package.json` (modified, `render:check`): one real, billed render with the eval brand and licence, printing each step's status, latency and cost, the verify verdict and the admin counts.
- First real run, 2026-10-29 (AI_PROVIDER=google): licence 3.7 s, policy 1.7 s (gemini-3.5-flash-lite), frames 11.3 s, then the Gemini image call timed out at 120 s; nothing was charged; the steps after generation did not run.
- `README.md` (modified): the render pipeline as a Mermaid diagram and which Meta model each file uses; numbers left as TODO.
- Firestore: TTL policy on `rateLimits.expiresAt` (database likeness-meta), ACTIVE.
- `.env.local` (not committed): `ADMIN_EMAILS`.

#### Reopening past renders; development renders kept out of judge-visible views

- `components/dashboard/RenderTimeline.tsx` (modified): reads a past render's stored step log by `renderId` once (no polling), or polls a running one by `requestId` as before; a render made before step logs existed says so.
- `components/dashboard/RenderCard.tsx` (modified): "Steps and consent check" on every render card reopens its step log and consent figure; `BlockedCard` (new, same file): an image that was made but blocked (code, plain-language reason, brief; text only, the image was deleted), with the same button.
- `app/api/renders/route.ts` (modified): also returns blocked renders (`blockedAsBrand`, `blockedAsCreator`) for the brand and the creator in them; development renders, delivered or blocked, are left out of all four lists (by their flag, or for older records by their `fixture:` model name).
- `components/dashboard/BrandDashboard.tsx`, `components/dashboard/CreatorDashboard.tsx` (modified): Your renders and Ads made with your likeness show delivered and blocked renders together, newest first. A development render is never added to Your renders after the click (its message says it is listed in the admin view); the list reloads after a blocked render.
- `app/api/render/log/route.ts` (modified): `?renderId=` is readable by the brand and the creator in the render, and by admins; anyone else gets 404.
- `lib/server/render-image.ts` (modified): a development render that reaches payment pays the creator nothing: the payout and a reversal ("Reversal of development test renders") are entered in the same transaction, so the creator's ledger sums to 0 and their balance is unchanged (the brand's credits come back with the judge reset). Blocked development renders are flagged `fixture: true`. `blockedReason` (new) gives the code and plain-language reason for the dashboards and the admin view. The photo-access entry was already labelled "Test render (development)".
- `lib/server/admin.ts`, `app/(app)/admin/page.tsx` (modified): the admin view marks development renders "Test render (development)", and every render and blocked render has "Steps and consent figure", which reopens its stored step log.
- `lib/server/renders-routes.test.ts` (new), `lib/server/render-image.test.ts` (modified): lists for brand and creator with development renders left out; log access for brand, creator, admin and others; the reversal; the blocked flag; the blocked reasons.

#### Error-card wording, the same card for reopened blocked renders, a ledger correction

- `lib/reasons.ts`, `lib/reasons.test.ts` (modified): "What you can do" is the action only ("Remove other people from the brief and try again."); codes that never charge are marked `uncharged`, and `reasonSentence` ends the reason sentence with "Nothing was charged." once (not added when the server's message already says it). `blockedSentence` words a blocked image the same way live and reopened ("Image blocked by the consent gate: …").
- `components/dashboard/ErrorNotice.tsx` (modified): uses them; `uncharged` and `actions={false}` for a reopened blocked render (no buttons for a past render).
- `lib/server/render-image.ts` (modified): the live blocked message comes from `blockedSentence`.
- `app/api/render/log/route.ts`, `lib/server/renders-routes.test.ts` (modified): a blocked render's log comes with its stored reason (`blockedBy`, code, explanation).
- `components/dashboard/RenderTimeline.tsx`, `components/dashboard/RenderCard.tsx` (modified): a reopened blocked render ends with the same red card, built from the stored reason code, in Your renders, the creator's list and the admin view; the blocked card shows it in place of the separate red line, and "nothing charged" is no longer repeated in its header.
- Data, 2026-10-29 (approved): a one-off −1,080 "Reversal of development test renders" on the judge creator's ledger for the six eval dry-run (fixture) payouts made at 11:00 UTC, before payouts on development renders were reversed automatically; the entry lists the six render ids. Balance 1,080 → 0; the ledger sums to 0.
- `lib/figureLayout.ts`, `lib/figureLayout.test.ts` (new), `components/dashboard/ConsentFigure.tsx` (modified): the figure's labels are laid out by a pure function. Each label is built from the stored role and score ("N · who · score", numbered left to right), so figures stored with older labels ("Person 1: Maya Okafor, match 0.81") render by the same rules. A label sits above its box and shifts inward at the frame's edges; if it would overlap another, it is shortened ("2 · outside · 0.12"), then tried below its box, then at the nearest free height. Tests: two boxes close together, boxes at each edge, ten boxes in one place, old labels.

#### Test runs kept out of the site-wide daily limit (2026-10-30, no model calls)

- `lib/server/render-image.ts`, `lib/server/render-image.test.ts` (modified): eval-brand renders and development (fixture) renders, delivered or blocked, aren't counted toward the site-wide daily limit and aren't refused by it (checked before the render and again in the payment transaction); they still count toward their own brand's limit and stay in the admin view. Tests: at a full site limit a real render is refused, an eval or fixture render goes through without counting; a blocked test render counts only for its brand; the pre-render check.
- `scripts/eval.ts` (modified): its room check before a run no longer looks at the site-wide limit.
- Data, 2026-10-29 (UTC): today's site counter recounted under the rule from today's records: 37 renders and 2 blocked images, all test runs, so 0 and 0 (the counter had 37 and 2). Judges have the full 40. Deployed as revision `likeness-meta-00005-xmh` (image `meta-20261030b`, AI_PROVIDER=meta); likeness-ai unchanged.

### Label, content credential, receipts and Verify

#### "Built on" Meta first, Verify wording, a label scaled to the image, the Assent test certificate (2026-11-01, no model calls)

Why: the landing page and the render cards still described the earlier Gemini stack; Verify said "none" for a content credential it hadn't read, mentioned SynthID for Meta renders, and listed YouTube and live-face checks for a synthetic creator; the label's text was about 1% of the image's height.

- Identifiers reused from likeness-ai, unchanged so files made before the rename still read and verify: the C2PA licence assertion label `xyz.likeness.licence`, and the assertion's protocol `likeness-ai/1`.
- `lib/site-content.ts`, `components/landing/Landing.tsx` (modified): "Built on" is Meta Muse Spark, Meta Muse Image, Meta SAM 3.1, Firebase, Cloud Run, Cloud KMS, C2PA, YouTube, each with its role as a tooltip; Vertex AI Gemini is left out (the fallback provider, see the README).
- `components/dashboard/shared.tsx` (modified): a render card names the model that made it ("Meta Muse Image (muse-image-1.0)"; "Vertex AI Gemini (…), fallback provider"), not "Gemini" for every render. `components/dashboard/CreativeAssistant.tsx` (comment): the prompt comes from the brand agent.
- `lib/server/verify.ts`, `app/(app)/verify/page.tsx`, `lib/verifyText.ts` (new), `lib/server/verify.test.ts` (new), `lib/verifyText.test.ts` (new): a lookup by receipt marks the content credential "not checked (looked up by receipt; upload the file to check its credential)", "none" only for an uploaded file without one; the SynthID note only for renders made by Gemini; a synthetic demo creator reads "Synthetic demo creator, pre-approved; the YouTube and live-face checks apply to real creators." instead of the YouTube and live-face line (the "generated face, not a real person" note stays).
- `app/(app)/creators/[id]/page.tsx` (modified): Maya's profile says "Synthetic demo creator, not a real person. No YouTube channel." (no longer how her face was made).
- `lib/server/label.ts`, `lib/server/watermarks.ts`, `scripts/make-label.mts` (new), `lib/server/label.test.ts` (new): the label is two lines ("AI-generated" / "licensed likeness"), white on a near-black pill at 90% opacity (was 75%), its text 2.75% of the image's shorter side (at least 16 px), never wider than the safe area, in the corner clear of the face. On 1600×1600: 512×153 px with 44 px text per line (was one line, 384×44 px, about 16 px text). Renders made earlier keep their label.
- `scripts/c2pa-testcert.sh` (modified), `lib/server/c2pa.test.ts` (modified): the TEST certificate is "Assent render service (TEST)", organisation "Assent (test only)"; `--rotate` keeps the previous chain in `.secrets/c2pa/previous-<time>/`. Secret Manager: version 2 of `likeness-meta-c2pa-cert` and `likeness-meta-c2pa-key` (version 1 still enabled). Each file carries its chain, so files signed with the Likeness certificate still verify (tested).
- `README.md` (modified): Gemini on Vertex AI remains as a fallback provider (AI_PROVIDER=google); the submitted app runs on Meta. Maya Okafor is a synthetic demo creator reused from likeness-ai.
- Deployed: Cloud Run `assent` revision `assent-00004-h8m` (image `web:assent-20261101b`), 100% of traffic; `/api/health`, `/start`, `/` and `/verify` answer 200. Deleted the old Cloud Run service `likeness-meta` (revision `likeness-meta-00005-xmh`, image `web:meta-20261030b`); its URL now answers 404. likeness-ai's service `likeness` unchanged (`likeness-00013-vw6`, image `6121f4c`, min instances 1).

### Creators, licences, judge mode, demo data and admin

#### Demo data (pre-existing synthetic data)

- `scripts/copy-demo-creators.ts` (new): copies likeness-ai's synthetic demo creators (generated faces, no real person) into likeness-meta's database and bucket; read-only on likeness-ai; dry run by default; never overwrites; drops video terms; marks each copy `copiedFrom`. These creators are pre-existing synthetic data from likeness-ai, not new faces. Dry run, then copy, 2026-10-29: 1 creator (`demo-maya-okafor`), 4 objects (3 sealed frames, 1 public photo) copied, none missing; the frames open and match their hashes in likeness-meta; a second run copies nothing.
- Judge mode (`scripts/seed-judges.ts`): Maya's frames were re-sealed under the likeness-meta-only uid `meta-demo-maya-okafor` (opened with the KMS key and sealed again with a new data key; the same three synthetic photos, same hashes), with her public photo copied; the copied `demo-maya-okafor` is unlisted, not deleted. Firebase Auth is shared with likeness-ai, so the judge login must not match likeness-ai's creator id.

#### Judge mode: seed script and "Reset demo"

- `scripts/seed-judges.ts` (new), `package.json` (modified, `seed:judges`): checks that Firebase allows email/password sign-in and stops with a clear message, changing nothing, if not; then seeds the judge creator (the synthetic demo creator under the likeness-meta-only uid `meta-demo-maya-okafor`: frames opened and sealed again for the new uid, public photo copied, `demo-maya-okafor` unlisted, not deleted, because Firebase Auth is shared with likeness-ai and the judge login must not match likeness-ai's creator), email/password sign-in for the judge brand and judge creator (generated passwords written to `.secrets/judge-accounts.json`, never printed), the judge brand with its one demo top-up and a licence through the normal request flow (moved to 30 Nov 2026 only if it would end before 16 Nov, and said so), and a separate eval brand and licence; records them in `demo/judges`; safe to run again.
- `lib/server/demo.ts` (new): the judge registry, the email/password check (Identity Toolkit admin config, read-only), and the reset: the judge licence back to 0 renders, active again if revoked, never shortened; the judge brand's credits restored with a ledger entry; never the eval licence or the daily limits.
- `lib/server/demo.test.ts` (new): who may reset, what a reset changes, the email/password check.
- `app/api/demo/reset/route.ts` (new): "Reset demo", for the judge accounts only.
- `app/api/me/route.ts`, `components/auth/AuthProvider.tsx` (modified): `judge` on the signed-in account.
- `lib/client/firebase.ts` (modified): email/password sign-in, used only by the judge form.
- `components/auth/JudgeSignIn.tsx` (new), `app/(app)/start/page.tsx` (modified): the judge sign-in form under "Sign in with Google".
- `components/dashboard/ResetDemo.tsx` (new), `app/(app)/dashboard/page.tsx` (modified): the "Reset demo" button for judge accounts.
- First run, 2026-10-29: stopped at the check (email/password sign-in not enabled yet); nothing was changed.
- Seeded 2026-10-29 (pre-existing synthetic creator only): judge creator `meta-demo-maya-okafor` (`judge-creator@example.com`), judge brand `meta-judge-brand` (`judge-brand@example.com`), eval brand `meta-eval-brand` (no sign-in); judge licence `H0ToOi5i37ZhoBbn` and eval licence `6sM3pbqO3haoxt9h`, both through the request flow, 10 renders at 200 credits, ending 2026-11-28 (after 16 Nov, so not moved); 2,000 demo credits each.
- `lib/server/demo.ts`, `lib/server/demo.test.ts`, `lib/server/render-image.ts` (modified): the judge brand alone gets its own daily render limit, 25 (`JUDGE_BRAND_RENDERS_PER_DAY`), decided on the server from `demo/judges`; every other brand, the judge creator and the eval brand keep 3; the site-wide limit still applies; the limit is worked out once per render and used by both the check and the settlement.
- `.env.example` (modified): `JUDGE_BRAND_RENDERS_PER_DAY`.

#### Access-log labels, ledger reversal, first deploy

- `lib/server/vault.ts` (modified): each photo opening can carry a purpose label (`OpeningPurpose.label`) for anything that isn't a real render; real renders have none.
- `lib/server/render-image.ts` (modified): fixture renders are labelled "Test render (development)", the eval brand's renders "Evaluation render".
- `scripts/seed-judges.ts`, `scripts/muse-image-check.ts` (modified): their openings carry "Setup: re-key for judge mode" and "Test render (development)".
- `app/api/creator/decryptions/route.ts`, `components/dashboard/CreatorDashboard.tsx` (modified): the creator's "Who opened your photos" shows each label; nothing is filtered out.
- Data, 2026-10-29: the 9 earlier openings labelled ("Test render (development)" ×4, "Setup: latency profile" ×2, "Setup: seed verification", and on the unlisted copy "Setup: copy check", "Setup: re-key for judge mode"); Maya's ledger gets "Reversal of development test renders" (−540 credits, listing the three fixture renders), so it sums to 0 and her balance is 0.
- `.gcloudignore` (new), `.dockerignore` (modified): the deploy never uploads or bakes in `.secrets/` (test C2PA key, judge passwords), `.env*` files, local data, models, build output or git history (checked with `gcloud meta list-files-for-upload`: 191 files, none of those).
- `scripts/deploy-gcp.sh` (modified): sets `AI_PROVIDER` (google unless given) and `ADMIN_EMAILS` on the service; `IMAGE_TAG` overrides the commit-based image tag.
- `scripts/deploy-gcp.sh` (modified): the status link is `/api/status` (there is no `/status` page).
- First deploy, 2026-10-29: Cloud Run service `likeness-meta`, revision `likeness-meta-00001-8kb`, image `likeness-meta/web:meta-20261029a` (built on the default machine, face models baked in), AI_PROVIDER=google, no MODEL_API_KEY. Secrets `likeness-meta-c2pa-cert` / `likeness-meta-c2pa-key` created from the local TEST certificate. `/api/status`: all nine checks ok (project, Firebase Auth, Firestore `likeness-meta`, KMS, the likeness-meta bucket, Vertex config, YouTube, face models, C2PA). Judge email/password sign-in works against the deployed API (both accounts). No model calls. likeness-ai's service (`likeness`, revision `likeness-00013-vw6`, image `web:6121f4c`, min instances 1) unchanged.

### Assent app: pages, rename, site and UI

#### Renamed to Assent; the new Cloud Run service "assent" (2026-10-30, no model calls)

Why: the product's name now says what it is built on, the creator's assent to each licensed use; "likeness" stays the word for what is licensed. The name changes on screen and in new content credentials; the Google Cloud resources keep their names.

- `app/layout.tsx` (modified): title "Assent", tagline "Your face. Your terms. Your yes." (was "Get paid per ad."). `app/icon.svg` (modified): a text mark "A". `components/site/AppHeader.tsx`, `components/landing/Landing.tsx` (modified): the wordmark "ASSENT" (the header had a person icon). `components/site/SiteFooter.tsx`, `app/(app)/start/page.tsx`, `components/ds/index.tsx`, `lib/model.ts` (the daily-limit messages), `lib/server/creators.ts`, `lib/server/verify.ts` (modified): the product's name in copy and messages. `app/(app)/creator/onboard/page.tsx` (modified): the YouTube step no longer names the app (Google's consent screen, set for the whole project, which likeness-ai shares, isn't renamed).
- Kept: "likeness" for the concept ("AI-generated · licensed likeness", "THE FUTURE OF YOUR LIKENESS IS YOURS", "license their likeness"); the C2PA assertion label `xyz.likeness.licence`, the file title and the protocol `likeness-ai/1`, so files made before the rename read and verify the same way; the C2PA TEST certificate (its subject still names "Likeness (test only)"; renaming it means a new certificate and new secret versions).
- `lib/server/c2pa.ts`, `lib/server/render-image.ts`, `lib/server/c2pa.test.ts` (modified): new renders' content credentials name the generator "Assent render service" and add `receipt.issuer: "Assent"`; tested, with an older-style manifest still reading back valid. The KMS-signed receipt itself is unchanged (no issuer field), so older receipts verify as before.
- No emails are sent by the app; the public base URL (`NEXT_PUBLIC_APP_URL`, set at build from the service's URL) is the only source of the site's links and of the verify link inside the content credential.
- `scripts/deploy-gcp.sh`, `lib/server/ai/fixture/fixture.test.ts` (modified): deploys to the service "assent" by default (`SERVICE=likeness-meta` for the earlier one); still refuses `likeness` and `likeness-ai`; same project, region, service account, database `likeness-meta`, bucket, secrets (`likeness-meta-model-api-key` included), image repository, startup probe, CPU boost, min instances 0, `AI_PROVIDER=meta`. Tested.
- `app/api/status/route.ts`, `lib/server/status.test.ts` (modified): the public status names the service "assent".
- Comments (`app/globals.css`, `components/ui.tsx`, `components/auth/AuthProvider.tsx`, `lib/server/watermarks.ts`), `scripts/seed-judges.ts` (the eval brand's name on a re-seed: "Assent eval brand"; the stored name is unchanged), `scripts/eval.ts` and `eval/results*.md` (headings "Assent eval results"), `README.md` (modified).

#### Plan and policy stay in order; the start page waits for the account (2026-11-01, no model calls)
- Plan and policy are not run at the same time: on Meta the policy check reads the planned shot (`shot.prompt`, the text Muse Image receives), not the brief, so it can only start once the shot is planned.
- `components/auth/AuthProvider.tsx` (modified), `app/(app)/start/page.tsx` (modified), `lib/startView.ts` (new), `lib/startView.test.ts` (new): after a sign-in the app is loading until the account (`/api/me`) arrives, so a signed-in judge no longer sees "How will you use Assent?" (or the dashboard's "Sign in") while a cold start answers (17.7 s on 1 Nov). /start shows "Signing you in…", then sends a brand to the dashboard and a creator to onboarding or the dashboard; the creator-or-brand choice appears only for an account without a role; a failed load says so with "Try again".

#### Dates in UTC, one synthetic-creator line, the demo creator's card, the eval licence hidden (2026-11-02, no model calls)
- `lib/dates.ts` (new), `lib/dates.test.ts` (new), `components/dashboard/shared.tsx`, `components/ui.tsx`, `app/(app)/admin/page.tsx`, `components/dashboard/CreatorDashboard.tsx`, `components/dashboard/BrandDashboard.tsx`, `lib/server/verify.ts`, `lib/server/render-image.ts`, `lib/server/ai/policy.ts` (+ test) (modified): every date shown is in UTC and says so, e.g. "Made on 1 Nov 2026 (UTC)", render cards "1 Nov 2026, 16:57 (UTC)", licences "until 28 Nov 2026 (UTC)". UTC rather than local time because the server writes some of the text (the Verify headline, refusals, the render steps) and the daily limits reset at 00:00 UTC. The unused `fmtDate`/`fmtDay` are removed.
- `lib/server/verify.ts` (+ test): one line for a synthetic demo creator: "Synthetic demo creator: a generated face, not a real person, pre-approved; the YouTube and live-face checks apply to real creators."
- `lib/model.ts` (+ test), `components/dashboard/CreatorDashboard.tsx`, `app/(app)/creator/onboard/page.tsx`: a synthetic demo creator's account card reads "Synthetic demo creator · Pre-approved · Not YouTube-verified", with no "Verified" claim; real creators keep "Verified creator account · YouTube, … · Live face matched to the channel avatar · 18+ self-declared".
- `lib/server/licences.ts`, `lib/reasons.ts`, `lib/server/licences-routes.test.ts` (new): the eval brand's licence and request are left out of the creator's lists (so out of "Active licences"), like the eval renders; revoking it is refused on the server (403, `EVAL_LICENCE`). The eval brand still sees its licence; the admin view lists it.
- Judge licence reset (the "Reset demo" transaction): renders 2 → 0, revoked → active, judge brand credits 1,600 → 2,000.
- Deployed: Cloud Run `assent` revision `assent-00005-6mp` (image `web:assent-20261102a`, also carrying the start-page fix above), 100% of traffic; `/api/health`, `/`, `/start`, `/verify`, `/creators` and `/dashboard` answer 200; Verify by receipt reads "Licensed. Made on 1 Nov 2026 (UTC) …" with the one synthetic-creator line. likeness-ai's service `likeness` unchanged (`likeness-00013-vw6`, image `6121f4c`, min instances 1).

### Evaluation

#### Cold starts, status detail for admins, the eval harness (Phase 7)

- `app/api/health/route.ts` (new), `lib/server/startup.ts`, `instrumentation.ts` (modified): the warm-up runs once per process; `/api/health` waits for it, and Cloud Run's startup probe calls it, so an instance takes traffic only when the face models and Firestore are ready (a warm-up failure is logged and still answers ok).
- `scripts/deploy-gcp.sh` (modified): `--cpu-boost` and an HTTP startup probe on `/api/health`.
- Redeploy, 2026-10-29: revision `likeness-meta-00002-8tj` (image `meta-20261029b`): CPU boost on, startup probe on `/api/health`; warm-up 9.6 s (face models) and 9.8 s (Firestore) finished before the probe passed. likeness-ai unchanged.
- `app/api/status/route.ts` (modified), `lib/server/status.test.ts` (new): everyone gets the overall ok/failed; admins also get each check's detail.
- `README.md` (modified): TODO: minimum 1 instance from 4 Nov until a few days after the 9 Nov finals, then back to 0.
- `eval/briefs.json` (new): 18 cases: 6 valid briefs, 4 banned (political, adult, minors, impersonation), 1 outside the licence (needs a policy model), 5 consent-gate images (valid, two people, wrong face, no person, face cut off), 2 reviewer images (wrong product, matching).
- `eval/fixtures/` (new): `maya.jpg`, `two-people.jpg` (interim: Maya twice), `face-cut.jpg`, `no-person.jpg`, built from the synthetic creator's public photo by `scripts/eval-fixtures.ts` (new; `pnpm eval:fixtures`); `README.md` says they're synthetic and how each was made; `wrong-face.png` pending (Muse Image, text only).
- `scripts/eval.ts` (new; `pnpm eval`): runs every case; refuses a paid provider without `--yes` and prints the estimated cost; checks the eval licence and today's daily limits before spending anything; resets the eval licence before and after; skips (and lists) what the provider can't judge; writes `eval/results.md`, or `eval/results-dryrun.md` with the fixture provider.
- `lib/eval/score.ts`, `lib/eval/score.test.ts` (new): judging each case, the rates (correct refusals, gate and reviewer catch rates, average latency and estimated cost per image with blocked images included), failures and skips, and the results file.
- `lib/server/ai/fixture/agent.ts` (new), `lib/server/ai/index.ts` (modified): with `AI_PROVIDER=fixture`, an offline policy stand-in replaces the Gemini check, so the fixture provider makes no model calls at all.
- `lib/server/demo.ts`, `scripts/reset-eval.ts` (modified): `resetEvalLicence`, shared by the reset script and the eval.
- `eval/results-dryrun.md` (new): the dry run, 2026-10-29, fixture provider, with the brand daily limit raised in the local process only: 4/4 correct refusals, 6/6 valid delivered, consent gate 3/3 caught and the creator passed, 4 skipped (needs a model, or the wrong-face fixture), $0; eval licence reset after.
- `scripts/deploy-gcp.sh` (modified): the startup probe tries every 3 s with a 3 s timeout (up to 3 minutes); the first version (60 s period) made the first request after a cold start wait about 61 s for the second probe attempt. Redeployed as revision `likeness-meta-00003-nx8`: after 21 idle minutes the first request took 10.0 s (second 0.6 s); the warm-up (face models 5.0 s, Firestore 5.2 s with CPU boost) finished one second before the probe passed. Before: 13 s with no probe, 61 s with the 60 s probe period. likeness-ai unchanged.

#### The real eval runs (2026-10-30, about $0.60 estimated of $0.65 approved)

- `eval/results-spark-default.md` (run 1: Muse Spark at Meta's default effort, "high") and `eval/results-spark-low.md` (run 2: plan and review "low", policy "medium"); Muse Image at "low" in both. 22 cases each; both 22/22: 9/9 refusals (4 by the local rules, 4 banned and 1 outside-use by the plan model), 6/6 valid briefs delivered, consent gate 5/5 (Maya 0.95 passed; two people, wrong face 0.16, no person, face cut off blocked), reviewer 2/2. One valid brief per run was flagged by the reviewer and re-rendered once (about 95 s). Mean per image 62.7 s and $0.0443 (run 1), 57.0 s and $0.0390 (run 2). Both runs used `EVAL_BRAND_RENDERS_PER_DAY=40` in their own process only (the day's earlier fixture renders had used the eval brand's 20). Each file has a note on two harness gaps found after the run.
- `lib/server/render-image.ts`, `lib/server/render-image.test.ts` (modified): a plan the model refuses before proposing a shot now keeps the call's model, effort and cost in the step log (the runs show those refusals at $0).
- `lib/server/consentGate.ts`, `lib/server/consentGate.test.ts`, `scripts/eval.ts` (modified): the eval passes the creator's name to the gate; without a name the figure says "the creator", not "the".

#### Eval settings as defaults, a spending cap, the policy check alone, reviewer flags, the final eval (2026-10-30, about $0.25 estimated)

- `lib/server/ai/meta/spark.ts`, `lib/server/ai/meta/spark.test.ts`, `.env.example` (modified): built-in reasoning effort "low" for the plan (and alternative) and the review; the policy check keeps Meta's default. The per-call and shared settings still override.
- `lib/server/ai/budget.ts`, `lib/server/ai/budget.test.ts` (new), `lib/server/ai/meta/client.ts` (modified): `--max-usd`, required for every paid run of `scripts/eval.ts` and the check scripts (`muse-image-check`, `sam-check`, `spark-check`, `render-check`, `synthetic-faces`, all modified). Each Meta call is priced before it is sent (Muse Image $0.01, SAM $0.0025, Muse Spark by its input and a 2,000-token output allowance) and refused if it could take the run past the cap; its cost from the reported usage replaces the estimate; a 4xx costs nothing. The pipeline's fail-closed handlers (`lib/server/filter.ts`, `lib/server/consentGate.ts`, the plan and review steps in `lib/server/render-image.ts`) pass a cap stop through instead of turning it into a refusal or a block. The eval writes what it has when stopped, the rest marked not run.
- `scripts/eval.ts` (modified): `--mode policy` sends the banned briefs the word rules miss straight through the policy check (`checkPrompt`, no plan) → `eval/results-policy.md`; `--ignore-daily-limit` lifts the eval brand's own daily limit for the run's process (the site-wide limit still applies); both in the README. Policy-only run, default effort, `--max-usd 0.06`: 4/4 refused with BANNED_USE, about $0.027.
- `lib/server/render-image.ts`, `lib/server/ai/alternative.ts`, `lib/server/ai/types.ts`, `lib/reasons.ts` (modified), `app/api/render/alternative/route.ts` (new), `components/dashboard/RenderCard.tsx`, `components/dashboard/BrandDashboard.tsx`, `components/dashboard/shared.tsx` (modified): a reviewer's flag delivers the image with its warning (no automatic re-render); the brand may "Ask for an alternative", one per flagged image, claimed in a transaction before anything is spent, proposed by the brand agent under the same rules and rendered and charged as a new render (linked both ways: `alternativeOf`, `alternativeId`). A reviewer's block now gets one automatic alternative (policy, gate and review again); if that is blocked too, the image stays blocked. New reasons NO_RENDER, NOT_FLAGGED, ALTERNATIVE_USED. Tests: the request rules (owner, flagged, one only, claimed before any call) and the codes that get an alternative.
- `README.md` (modified): the render diagram and model table for the new review flow; "Running the eval"; the Results table from the final run only (22 cases, 6 images), the earlier runs as supporting files.
- `eval/results.md` (new): the final run at the chosen settings, `--max-usd 0.35 --ignore-daily-limit`: 22/22; 9/9 refusals, 6/6 delivered, gate 5/5, reviewer 2/2; 50.3 s and $0.0315 per image; about $0.22. One valid brief (unboxing) was flagged and delivered with its warning.

### Removed from likeness-ai

#### Video removed (Veo, the ffmpeg fallback, the video quality gate)

- `lib/server/render-video.ts`, `lib/server/veo.ts`, `lib/server/motion.ts`, `lib/server/gate.ts` (removed): the video pipeline, Veo client, ffmpeg tools and video quality gate.
- `app/api/render/video/route.ts` (removed): the video render endpoint.
- `lib/video.test.ts`, `lib/server/motion.test.ts`, `lib/server/gate.test.ts` (removed): video-only tests; the image-relevant checks moved to `lib/creative.test.ts`, `lib/server/c2pa.test.ts` and `lib/server/facecheck.test.ts`.
- `lib/server/facecheck.ts` (new): the face checks extracted from the video gate before it was removed (fully visible face, best match against the creator's references, the consent threshold), for the image consent gate.
- `lib/server/facecheck.test.ts` (new): those checks.
- `lib/model.ts` (modified): video fields, video pricing and video caps removed from terms, licences, receipts and daily caps; image rules unchanged; consent text says "image".
- `lib/model.test.ts`, `lib/policy.test.ts` (modified): image-only prices and caps.
- `lib/creative.ts` (modified): motion rules, the Veo prompt and the image/video format removed.
- `lib/creative.test.ts` (new): the still-prompt framing rules (moved from the video test).
- `lib/server/render-image.ts` (modified): no unlabelled still kept for video, no video branches in the checks or the settlement.
- `lib/server/framing.ts`, `lib/server/framing.test.ts` (modified): only label placement and face boxes kept; the video crop and fit removed.
- `lib/server/assistant.ts`, `lib/server/assistant.test.ts` (modified): no video format or motion prompt.
- `lib/server/licences.ts`, `lib/server/creators.ts` (modified): no video terms on licences or creator terms.
- `lib/server/c2pa.ts` (modified): images only (no MP4).
- `lib/server/c2pa.test.ts` (new): C2PA on an image, signed and read back (replaces the MP4 test).
- `lib/server/status.ts`, `lib/server/verify.ts`, `lib/server/accounts.ts`, `lib/server/facematch.ts`, `lib/server/label.ts` (modified): video mentions and the Veo status check removed.
- `components/dashboard/BrandDashboard.tsx`, `RenderCard.tsx`, `shared.tsx`, `CreativeAssistant.tsx`, `CreatorDashboard.tsx` (modified): the video maker, video player, gate line and video terms removed.
- `app/(app)/creators/page.tsx`, `app/(app)/creators/[id]/page.tsx`, `app/(app)/start/page.tsx`, `app/(app)/verify/page.tsx`, `app/layout.tsx`, `components/landing/Landing.tsx`, `lib/site-content.ts` (modified): image-only wording; Veo removed from "built on".
- `app/api/verify/route.ts`, `app/api/renders/[id]/url/route.ts` (modified): no MP4.
- `scripts/e2e-smoke.ts` (modified): image only; outputs to `.secrets/ai/e2e`.
- `package.json` (modified): `copy:demo` script (see "Demo data" below).
- `Dockerfile` (modified): no ffmpeg or fonts; builds from the repository root.
- `.env.example` (modified): video settings removed; `likeness-meta` names; `AI_PROVIDER`, `MODEL_API_KEY` and `CONSENT_FACE_MATCH_THRESHOLD` added (placeholders only).

#### Dead code removed (approved in the Phase 1 audit)

- `lib/server/watermarks.ts` (modified): the unused `WATERMARK_SAMPLE` and `WATERMARK_PROFILE_AI` images removed.
- `lib/server/c2pa.ts` (modified): the unused `embedPreviewManifest` removed (reading preview manifests stays).
- `lib/categories.ts` (modified): the unused `categoryLabels`, `categoryByKey`, `regionLabels` and `isLicensable` removed; then the helpers they left without callers: `isAllowedSet`, `REGIONS`, `ALL_REGIONS`, `BANNED_MASK`, `ALLOWED_MASK`; and the unused `CategoryKey` type.
- `lib/server/facemodels.ts` (modified): the Vercel-only model-download path removed (an opt-in download with `FACE_MODELS_FETCH=1` stays).
- `.vercelignore` (removed).
