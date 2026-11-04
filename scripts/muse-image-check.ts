/**
 * One real Muse Image call through the adapter's own request builder, to record the response shape.
 * Billed: one generated image, $0.01 (https://dev.meta.ai/docs/pricing-rate-limits). Refuses without --yes.
 *
 *   pnpm meta:image-check --yes --max-usd <dollars>
 *   MUSE_IMAGE_REASONING_STRENGTH=low pnpm meta:image-check --yes --tag low --max-usd <dollars>    files named …-low
 *
 * Uses the synthetic demo creator's reference frames (demo-maya-okafor), opened like a render (the
 * opening is logged in decryptions). Writes:
 *   eval/fixtures/muse-image-response.json   the request and response shapes, every base64 cut short
 *   .data-demo/muse-image-check.png          the generated image (git-ignored)
 * then runs the consent gate on the image locally (free) and prints usage, cost and latency.
 */
import { budgetFromArgs, budgetSummary } from "@/lib/server/ai/budget";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { museImageConfig, museImageRequest, museImageResult, type MuseImageResponse } from "@/lib/server/ai/meta/image";
import { metaPost } from "@/lib/server/ai/meta/client";
import { estimateCost } from "@/lib/server/ai/pricing";
import { runConsentGate } from "@/lib/server/consentGate";
import { getCreator } from "@/lib/server/creators";
import { referenceEmbeddings } from "@/lib/server/facematch";
import { openFrames } from "@/lib/server/vault";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.argv.includes("--yes")) throw new Error("this makes one billed Muse Image call ($0.01); run with --yes");
// Required for a paid run: no Meta call is made that could take this run past it (lib/server/ai/budget.ts).
budgetFromArgs(process.argv, true);
const CREATOR = "demo-maya-okafor";
/** --tag <name>: a second run (e.g. reasoning "low") writes its own files instead of replacing the first. */
const TAG = process.argv.includes("--tag") ? `-${process.argv[process.argv.indexOf("--tag") + 1].replace(/[^a-z0-9-]/gi, "")}` : "";
const PROMPT = "Smiling in a sunlit café holding a ceramic coffee cup, product shot for a spring campaign";

/** Every long base64 string, wherever it is, cut to its first 48 characters plus its length. */
const cut = (v: unknown): unknown => {
  if (typeof v === "string") {
    const m = /^(data:[^;]+;base64,)?([A-Za-z0-9+/=]{200,})$/.exec(v);
    return m ? `${m[1] ?? ""}${m[2].slice(0, 48)}…(${m[2].length} base64 chars)` : v;
  }
  if (Array.isArray(v)) return v.map(cut);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cut(x)]));
  return v;
};

async function main() {
  const creator = await getCreator(CREATOR);
  if (!creator) throw new Error(`${CREATOR} is not in likeness-meta (run pnpm copy:demo --write)`);
  const frames = await openFrames(creator, { licenceId: "muse-image-check", renderId: `muse-image-check-${Date.now()}`, by: "scripts/muse-image-check.ts (first real Muse Image call)", label: "Test render (development)" });
  const refs = await referenceEmbeddings(frames);
  const cfg = museImageConfig();
  const body = museImageRequest(frames.map((bytes) => ({ bytes, mime: "image/jpeg" as const })), PROMPT, { aspectRatio: "1:1" }, cfg);
  const t = Date.now();
  let res: MuseImageResponse;
  try {
    res = await metaPost<MuseImageResponse>("/responses", body, { timeoutMs: 180_000, retries: 0 });
  } finally {
    frames.forEach((f) => f.fill(0));
  }
  const latencyMs = Date.now() - t;
  mkdirSync("eval/fixtures", { recursive: true });
  writeFileSync(
    `eval/fixtures/muse-image-response${TAG}.json`,
    JSON.stringify({ note: "One real Muse Image call (scripts/muse-image-check.ts). Every base64 string is cut short; the reference photos are the synthetic demo creator's.", at: new Date().toISOString(), latencyMs, request: cut(body), response: cut(res) }, null, 2) + "\n",
  );
  const image = await museImageResult(res);
  mkdirSync(".data-demo", { recursive: true });
  writeFileSync(`.data-demo/muse-image-check${TAG}.png`, image.bytes);
  const gate = await runConsentGate(image, refs);
  refs.forEach((r) => r.fill(0));
  console.log("status:", res.status, "| model:", res.model, "| latency:", `${latencyMs} ms`, "| reasoning_strength:", cfg.reasoningStrength);
  console.log("usage:", JSON.stringify(res.usage));
  console.log("cost estimate:", JSON.stringify(estimateCost("meta", cfg.model, res.usage, 1)));
  console.log("output items:", (res.output ?? []).map((o) => o.type).join(", "));
  console.log("image:", image.bytes.length, `bytes PNG → .data-demo/muse-image-check${TAG}.png`);
  console.log("consent gate:", gate.passed ? "PASS" : `BLOCK ${gate.code}`, "|", gate.explanation, "| segmenter:", gate.segmenter);
}
main()
  .then(() => console.log(budgetSummary()))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
