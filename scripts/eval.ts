/**
 * The eval run (Phase 7): every case in eval/briefs.json, scored, written to a results file.
 *
 *   pnpm eval                       AI_PROVIDER=fixture: a free dry run → eval/results-dryrun.md
 *   pnpm eval                       a paid provider: prints the plan and the estimated cost, runs nothing
 *   pnpm eval --yes                 a paid provider: runs it → eval/results.md
 *   pnpm eval --yes --tag low-effort    … → eval/results-low-effort.md (runs at other settings side by side)
 *   pnpm eval --case gate-two-people   one case only
 *   pnpm eval --mode policy --yes --max-usd 0.06   only the banned briefs the word rules miss, straight
 *                                   through the policy check (no plan) → eval/results-policy.md
 * Paid runs need --max-usd <dollars>: no Meta call is made that could take the run past it (lib/server/ai/budget.ts);
 * a run stopped by it writes what it has, the rest marked not run.
 * --ignore-daily-limit lifts the eval brand's own daily render limit for this run's process only (the
 * site-wide limit still applies), e.g. after a day of test renders.
 *
 * Uses the eval brand and its own licence (demo/judges), reset before and after, never the judge accounts.
 * Before anything is spent it checks there is room: renders left on the eval licence, and today's
 * daily limits (blocked images count, as everywhere). Cases only a model can judge are skipped, and
 * listed, when the provider has none. The consent-gate and reviewer cases run on fixed images
 * (eval/fixtures), which the models never generate.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { markdown, summarise, type CaseResult, type EvalCase, type StepResult } from "@/lib/eval/score";
import { ai, aiProvider } from "@/lib/server/ai";
import { budgetFromArgs, budgetSummary } from "@/lib/server/ai/budget";
import { museImageConfig } from "@/lib/server/ai/meta/image";
import { sparkConfig } from "@/lib/server/ai/meta/spark";
import { runConsentGate } from "@/lib/server/consentGate";
import { getCreator } from "@/lib/server/creators";
import { dailyCapsFor, judgeRegistry, resetEvalLicence } from "@/lib/server/demo";
import { referenceEmbeddings } from "@/lib/server/facematch";
import { firestore } from "@/lib/server/firebase-admin";
import { renderIdFor } from "@/lib/server/idempotency";
import { ruleCheck } from "@/lib/server/rules";
import { getLicence } from "@/lib/server/licences";
import { checkPrompt } from "@/lib/server/filter";
import { dailyCaps, day, filterCode, renderImage } from "@/lib/server/render-image";
import type { RenderLogDoc } from "@/lib/server/renderLog";
import { openFrames } from "@/lib/server/vault";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const provider = aiProvider();
const paid = provider !== "fixture";
const only = process.argv.includes("--case") ? process.argv[process.argv.indexOf("--case") + 1] : null;
const tag = process.argv.includes("--tag") ? process.argv[process.argv.indexOf("--tag") + 1].replace(/[^a-z0-9-]/gi, "") : "";
const mode = process.argv.includes("--mode") && process.argv[process.argv.indexOf("--mode") + 1] === "policy" ? "policy" : "full";
// The eval brand's own daily limit, lifted for this process only; the site-wide limit still applies.
if (process.argv.includes("--ignore-daily-limit")) process.env.EVAL_BRAND_RENDERS_PER_DAY = "1000";
const cases = (JSON.parse(readFileSync("eval/briefs.json", "utf8")) as { cases: EvalCase[] }).cases;
/** Policy mode: the banned briefs only a model can refuse, judged by the policy check itself (its own codes). */
const adversarial = cases
  .filter((c) => c.kind === "render" && c.id.startsWith("banned-") && c.needsModel === "policy")
  .map((c) => ({ ...c, expect: { outcome: "refused" as const, code: ["BANNED_USE", "OUTSIDE_LICENSED_USE"] } }));
const all = (mode === "policy" ? adversarial : cases).filter((c) => !only || c.id === only);
const stoppedByBudget = (e: unknown) => (e as { code?: unknown })?.code === "BUDGET_EXCEEDED";
const fixturePath = (f?: string) => (f ? path.join("eval/fixtures", f) : "");
const mimeOf = (f: string) => (f.endsWith(".png") ? ("image/png" as const) : ("image/jpeg" as const));

/** Why a case can't run with this provider or these files, or null. */
function skipReason(c: EvalCase): string | null {
  if (c.needsModel === "policy" && provider === "fixture") return "needs a policy model; the fixture provider has none";
  if (c.needsModel === "review" && provider !== "meta") return "needs the Muse Spark reviewer (AI_PROVIDER=meta)";
  // A fixed image is needed for gate and review cases, and for a render with the fixture provider that should generate one.
  const needsImage = c.kind !== "render" || (provider === "fixture" && c.expect.outcome === "delivered");
  if (needsImage && !(c.image && existsSync(fixturePath(c.image)))) return `fixture image missing: ${fixturePath(c.image) || "(none given)"}`;
  return null;
}

// Estimated cost per case with Meta, from the first real render at Spark's default effort (2026-10-30): a render that
// generates (plan, policy, Muse Image $0.01, SAM $0.0025, review) about $0.039, more if the reviewer flags it and an
// alternative is rendered; a refusal by the plan model about $0.01 (nothing when the local rules refuse first); a review
// on a fixed image about $0.012; a gate case one SAM call, $0.0025. Gemini has no pinned price.
const ESTIMATE = { generate: 0.039, refuse: 0.01, review: 0.012, gate: 0.0025, policy: 0.007 };

/** The first line of a fixture run's file, so its numbers are never taken for results. */
const DRY_RUN_BANNER = "Dry run with the fixture provider; not results.";

async function main() {
  const r = await judgeRegistry();
  if (!r) throw new Error("run pnpm seed:judges first");
  const runnable = all.filter((c) => !skipReason(c));
  const generating = runnable.filter((c) => c.kind === "render" && c.expect.outcome === "delivered");
  // Briefs the local rules refuse never reach a model.
  const refusing = runnable.filter((c) => c.kind === "render" && c.expect.outcome !== "delivered" && !ruleCheck(c.brief ?? "").length);
  const gates = provider === "meta" ? runnable.filter((c) => c.kind === "gate").length : 0;
  const estimate =
    mode === "policy"
      ? runnable.length * ESTIMATE.policy
      : generating.length * ESTIMATE.generate + refusing.length * ESTIMATE.refuse + runnable.filter((c) => c.kind === "review").length * ESTIMATE.review + gates * ESTIMATE.gate;
  console.log(`AI_PROVIDER=${provider}; mode ${mode}; ${all.length} cases: ${runnable.length} can run, ${all.length - runnable.length} skipped; up to ${mode === "policy" ? 0 : generating.length} generated images`);
  console.log(paid ? `estimated cost: about $${estimate.toFixed(3)}${provider === "google" ? " plus Gemini calls (no pinned price)" : ""}` : "cost: $0 (fixture: no model calls)");
  if (paid && !process.argv.includes("--yes")) {
    console.log("Not run: this provider is billed. Run again with --yes and --max-usd <dollars>.");
    return;
  }
  const maxUsd = budgetFromArgs(process.argv, paid);
  if (maxUsd !== null) console.log(`--max-usd ${maxUsd}: no Meta call is made that could take the run past it`);
  if (mode === "policy") return policyOnly(r.evalLicenceId);

  // Room: the eval licence is reset; the eval brand's own daily limit is what it is (blocked images count). Eval
  // renders don't use the site-wide limit (lib/server/render-image.ts NOT_COUNTED), so judges keep all of it.
  const licence = (await getLicence(r.evalLicenceId))!;
  const usage = firestore().collection("usage").doc(day());
  const brand = await usage.collection("brands").doc(r.evalBrandUid).get();
  const used = (d: FirebaseFirestore.DocumentData | undefined) => Number(d?.renders ?? 0) + Number(d?.blocked ?? 0);
  const caps = dailyCapsFor(r.evalBrandUid, r, dailyCaps());
  const room = { licence: licence.maxRenders, brand: caps.brandRenders - used(brand.data()) };
  const need = generating.length;
  if (need > room.licence || need > room.brand) {
    console.log(`Not run: ${need} generated images needed; room: licence ${room.licence}, eval brand today ${room.brand} (limit ${caps.brandRenders}; --ignore-daily-limit lifts it). Nothing was spent.`);
    process.exitCode = 2;
    return;
  }
  await resetEvalLicence();

  // The licensed creator's reference faces, for the gate cases (the opening is logged and labelled).
  const creator = await getCreator(licence.creatorId);
  const frames = await openFrames(creator!, { licenceId: r.evalLicenceId, renderId: `eval-gate-${Date.now()}`, by: "scripts/eval.ts (consent gate cases)", label: "Evaluation run (automated test)" });
  const refs = await referenceEmbeddings(frames);
  frames.forEach((f) => f.fill(0));

  const results: CaseResult[] = [];
  // Set when --max-usd stops the run: the case that would have passed it, and every later one, is marked not run.
  let stopped: string | null = null;
  const order = (c: EvalCase) => (c.kind === "render" ? (c.expect.outcome === "delivered" ? 1 : 0) : c.kind === "gate" ? 2 : 3);
  for (const c of [...all].sort((a, b) => order(a) - order(b))) {
    const why = stopped ? `not run: ${stopped}` : skipReason(c);
    if (why) {
      results.push({ id: c.id, kind: c.kind, status: "skipped", note: why });
      continue;
    }
    const t = Date.now();
    try {
      if (c.kind === "render") {
        if (provider === "fixture") process.env.FIXTURE_IMAGE_PATH = fixturePath(c.image);
        const requestId = randomUUID();
        let outcome: CaseResult["outcome"] = "delivered";
        let code: string | null = null;
        let note: string | undefined;
        try {
          await renderImage(r.evalBrandUid, r.evalLicenceId, c.brief!, "1:1", { requestId });
        } catch (e) {
          if (stoppedByBudget(e)) throw e;
          code = typeof (e as { code?: unknown }).code === "string" ? (e as { code: string }).code : null;
          const status = (e as { status?: number }).status ?? 500;
          outcome = (e as { blockedAfterGeneration?: boolean }).blockedAfterGeneration || /blocked/.test((e as Error).message) ? "blocked" : status < 500 ? "refused" : "error";
          note = (e as Error).message.slice(0, 160);
        }
        const log = (await firestore().collection("renderLogs").doc(renderIdFor(r.evalBrandUid, requestId)).get()).data() as RenderLogDoc | undefined;
        const generated = !!log?.steps.some((s) => s.step === "generate" && s.status === "ok");
        const cost = log ? log.steps.reduce((s, x) => s + (typeof x.costUsd === "number" ? x.costUsd : 0), 0) : null;
        const steps: StepResult[] = (log?.steps ?? []).map((s) => ({ step: s.step, status: s.status, ms: s.ms, costUsd: typeof s.costUsd === "number" ? s.costUsd : null, model: s.model ?? null, effort: s.settings?.reasoning_effort != null ? String(s.settings.reasoning_effort) : null, attempt: s.attempt ?? 1 }));
        const review = log?.steps.find((s) => s.step === "review" && s.status !== "skipped");
        const reviewNote = review ? ` Review: ${review.status}${review.code ? ` ${review.code}` : ""}.` : "";
        results.push({ id: c.id, kind: c.kind, status: "ran", outcome, code, generated, latencyMs: log?.finishedAt ? log.finishedAt - log.startedAt : Date.now() - t, costUsd: cost, steps, ...(note || reviewNote ? { note: `${note ?? ""}${reviewNote}`.trim() } : {}) });
      } else if (c.kind === "gate") {
        const img = fixturePath(c.image);
        const g = await runConsentGate({ bytes: new Uint8Array(readFileSync(img)), mime: mimeOf(img) }, refs, undefined, licence.creatorName);
        const figure = g.figure?.people.map((p) => `${p.label} [${p.role}]`).join("; ");
        results.push({ id: c.id, kind: c.kind, status: "ran", outcome: g.passed ? "pass" : "blocked", code: g.code, latencyMs: Date.now() - t, costUsd: g.metrics.reduce((s, m) => s + (m.cost?.costUsd ?? 0), 0), note: `${g.short} (${g.segmenter}; people ${g.people}, faces ${g.faces})${figure ? `. Figure: ${figure}` : ""}` });
      } else {
        const img = fixturePath(c.image);
        const rv = await ai().reviewer.review({ bytes: new Uint8Array(readFileSync(img)), mime: mimeOf(img) }, { id: c.id, prompt: c.shot!, aspect: "1:1", rationale: "eval" }, licence);
        results.push({ id: c.id, kind: c.kind, status: "ran", outcome: rv.verdict, latencyMs: Date.now() - t, costUsd: rv.metrics?.cost?.costUsd ?? null, note: rv.reasons.join(" ").slice(0, 160) });
      }
    } catch (e) {
      if (!stoppedByBudget(e)) throw e;
      stopped = "--max-usd reached";
      console.log(`  stopped: ${(e as Error).message}`);
      results.push({ id: c.id, kind: c.kind, status: "skipped", note: `not run: ${stopped}` });
      continue;
    }
    const last = results[results.length - 1];
    console.log(`  ${c.id.padEnd(24)} ${String(last.outcome).padEnd(9)} ${(last.code ?? "").padEnd(22)} ${last.latencyMs != null ? `${(last.latencyMs / 1000).toFixed(1)} s` : ""}`);
  }
  refs.forEach((x) => x.fill(0));
  await resetEvalLicence();

  const dry = provider === "fixture";
  writeResults(results, { name: dry ? "dryrun" : tag, title: tag ? `Assent eval results: ${tag}` : "Assent eval results", noteExtra: stopped ? ` Stopped early: ${stopped}.` : "" });
  console.log(budgetSummary());
}

/** Write the results file: eval/results-<name>.md, or eval/results.md (dry runs: eval/results-dryrun.md, labelled). */
function writeResults(results: CaseResult[], o: { name: string; title: string; noteExtra?: string }) {
  const s = summarise(all, results);
  const dry = provider === "fixture";
  const out = `eval/results${o.name ? `-${o.name}` : ""}.md`;
  // The model settings of this run, so runs at different settings can be told apart.
  const settings =
    provider === "meta"
      ? ` Settings: Muse Image reasoning strength ${museImageConfig().reasoningStrength}; Muse Spark reasoning effort plan ${sparkConfig("plan").effort ?? "default"}, policy ${sparkConfig("policy").effort ?? "default"}, review ${sparkConfig("review").effort ?? "default"} ("default" sends none: Meta uses "high").`
      : "";
  writeFileSync(
    out,
    markdown(
      {
        banner: dry ? DRY_RUN_BANNER : undefined,
        title: dry ? "Assent eval results: dry run (fixture provider, not real results)" : o.title,
        provider,
        at: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
        note: dry
          ? "The fixture provider returns a stored image and has no policy model or reviewer: it checks the harness, the pipeline wiring and the consent gate, not the models."
          : `Costs are estimates from published prices (lib/server/ai/pricing.ts), blocked images included.${settings} ${budgetSummary()}.${o.noteExtra ?? ""}`,
      },
      all,
      results,
      s,
    ),
  );
  console.log(`wrote ${out}: refusals ${s.correctRefusals.hit}/${s.correctRefusals.total}, gate ${s.gateCatch.hit}/${s.gateCatch.total}, reviewer ${s.reviewerCatch.hit}/${s.reviewerCatch.total}, ${s.failures.length} failures, ${s.skipped.length} skipped`);
}

/**
 * Policy mode: each banned brief the word rules miss goes straight through the policy check (checkPrompt:
 * the local rules, then Muse Spark's policy check), with no plan before it. Every one must be refused by
 * the check itself (BANNED_USE or OUTSIDE_LICENSED_USE); a failed call isn't a refusal.
 */
async function policyOnly(licenceId: string) {
  const licence = (await getLicence(licenceId))!;
  const results: CaseResult[] = [];
  let stopped: string | null = null;
  for (const c of all) {
    if (stopped) {
      results.push({ id: c.id, kind: c.kind, status: "skipped", note: `not run: ${stopped}` });
      continue;
    }
    const t = Date.now();
    try {
      const f = await checkPrompt(c.brief!, licence);
      const code = f.allowed ? null : filterCode(f);
      const effort = f.metrics?.settings?.reasoning_effort ?? null;
      results.push({ id: c.id, kind: c.kind, status: "ran", outcome: f.allowed ? "delivered" : "refused", code, latencyMs: f.metrics?.latencyMs ?? Date.now() - t, costUsd: f.metrics?.cost?.costUsd ?? null, note: `${f.allowed ? "Allowed by the policy check." : f.reasons.join("; ").slice(0, 200)} (effort ${effort ?? "–"})` });
    } catch (e) {
      if (!stoppedByBudget(e)) throw e;
      stopped = "--max-usd reached";
      results.push({ id: c.id, kind: c.kind, status: "skipped", note: `not run: ${stopped}` });
      continue;
    }
    const last = results[results.length - 1];
    console.log(`  ${c.id.padEnd(28)} ${String(last.outcome).padEnd(9)} ${(last.code ?? "").padEnd(22)} ${((last.latencyMs ?? 0) / 1000).toFixed(1)} s`);
  }
  writeResults(results, { name: tag ? `policy-${tag}` : "policy", title: "Assent eval results: the policy check alone, on banned briefs the word rules miss", noteExtra: stopped ? ` Stopped early: ${stopped}.` : "" });
  console.log(budgetSummary());
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
