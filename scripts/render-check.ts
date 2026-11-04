/**
 * One real end-to-end render with the eval brand and eval licence (demo/judges), as a wiring check of
 * Firestore, the consent gate, the label, C2PA, payment, the step log and the admin view. Billed: one
 * image and one policy check with the configured AI_PROVIDER (with google: Gemini, a few cents).
 * Refuses without --yes.
 *
 *   pnpm render:check --yes --max-usd <dollars>            a cold process (the first render pays for loading the face models)
 *   pnpm render:check --yes --warm --max-usd <dollars>     warm up first, as the server does at start (instrumentation.ts)
 *
 * Prints selected fields only: each step's status, latency, model and estimated cost; the reviewer's verdict
 * and the consent figure's labels; the verify verdict of the delivered file; the admin view's counts. The
 * file goes to .secrets/ai/e2e/render-check.<jpg|png>.
 */
import { budgetFromArgs, budgetSummary } from "@/lib/server/ai/budget";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { aiProvider } from "@/lib/server/ai";
import { warmUp } from "@/lib/server/startup";
import { adminOverview } from "@/lib/server/admin";
import { judgeRegistry } from "@/lib/server/demo";
import { firestore } from "@/lib/server/firebase-admin";
import { renderImage, type RenderDoc } from "@/lib/server/render-image";
import type { RenderLogDoc } from "@/lib/server/renderLog";
import { getObject } from "@/lib/server/storage";
import { verifyFile } from "@/lib/server/verify";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.argv.includes("--yes")) throw new Error(`this makes one billed render with AI_PROVIDER=${aiProvider()}; run with --yes`);
// Required for a paid run: no Meta call is made that could take this run past it (lib/server/ai/budget.ts).
budgetFromArgs(process.argv, aiProvider() !== "fixture");
const BRIEF = "Medium close-up of the person smiling in a sunlit café, holding a ceramic coffee cup at chest height, product shot for a spring campaign";

/** --ids <evalBrandUid>:<evalLicenceId> skips reading demo/judges first, so a cold run touches nothing before the render. */
const idsArg = process.argv[process.argv.indexOf("--ids") + 1];

async function main() {
  if (process.argv.includes("--warm")) {
    const w = await warmUp();
    console.log(`warm-up: face models ${w.faceModelsMs} ms, Firestore ${w.firestoreMs} ms`);
  }
  const fromArgs = process.argv.includes("--ids") && idsArg?.includes(":") ? { evalBrandUid: idsArg.split(":")[0], evalLicenceId: idsArg.split(":")[1] } : null;
  const r = fromArgs ?? (await judgeRegistry());
  if (!r) throw new Error("run pnpm seed:judges first");
  console.log(`AI_PROVIDER=${aiProvider()}; eval brand ${r.evalBrandUid}, licence ${r.evalLicenceId}`);
  const t = Date.now();
  let renderId: string | null = null;
  try {
    const out = await renderImage(r.evalBrandUid, r.evalLicenceId, BRIEF, "1:1", { requestId: randomUUID() });
    renderId = out.renderId;
    console.log(`result: delivered in ${((Date.now() - t) / 1000).toFixed(1)} s, render ${out.renderId}, price ${out.render.price}, model ${out.render.model}`);
  } catch (e) {
    console.log(`result: NOT delivered after ${((Date.now() - t) / 1000).toFixed(1)} s: ${(e as { code?: string }).code ?? "no code"} ${(e as Error).message.slice(0, 300)}`);
  }
  const logs = await firestore().collection("renderLogs").where("brandId", "==", r.evalBrandUid).get();
  const log = logs.docs.map((d) => d.data() as RenderLogDoc).sort((a, b) => b.startedAt - a.startedAt)[0];
  if (log) {
    console.log(`step log ${log.id}: ${log.status}${log.finishedAt ? `, ${((log.finishedAt - log.startedAt) / 1000).toFixed(1)} s` : ""}`);
    for (const s of log.steps) console.log(`  ${s.step.padEnd(10)} ${s.status.padEnd(8)} ${(s.ms / 1000).toFixed(1).padStart(5)} s  ${s.code ?? ""}${s.model ? ` ${s.model}` : ""}${typeof s.costUsd === "number" ? ` $${s.costUsd.toFixed(4)}` : ""}  ${s.detail.slice(0, 140)}`);
  }
  if (renderId) {
    const doc = (await firestore().collection("renders").doc(renderId).get()).data() as RenderDoc;
    const file = await getObject(doc.object);
    if (file) {
      mkdirSync(".secrets/ai/e2e", { recursive: true });
      writeFileSync(`.secrets/ai/e2e/render-check.${doc.mime === "image/png" ? "png" : "jpg"}`, file);
      const v = await verifyFile(new Uint8Array(file), doc.mime);
      console.log(`verify: ${v.verdict} | receipt valid ${v.receipt?.valid} | c2pa present ${v.manifest.present}, signature ${v.manifest.present ? v.manifest.signatureValid : "-"}`);
    }
    console.log(`render cost (estimate): $${doc.cost?.costUsd ?? "?"}${doc.cost?.complete ? "" : " (partial: no Gemini price pinned)"}; consent: ${doc.consent?.explanation}`);
    console.log(`consent figure: ${doc.consent?.figure?.people.map((p) => `${p.label} [${p.role}]`).join(" | ") ?? "none"}`);
    console.log(`reviewer: ${doc.review ? `${doc.review.verdict}${doc.review.skipped ? " (skipped)" : ""}: ${doc.review.reasons.join(" ").slice(0, 300)}` : "none"}`);
    console.log(`file: ${doc.mime}, ${file?.length ?? 0} bytes${doc.prompt ? `; rendered prompt: ${doc.prompt.slice(0, 200)}` : ""}`);
  }
  const o = await adminOverview(1);
  console.log(`admin view: ${o.totals.total.renders} renders today (${o.totals.total.delivered} delivered, ${o.totals.total.blocked} blocked), ${o.blocked.length} blocked records`);
}
main()
  .then(() => console.log(budgetSummary()))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
