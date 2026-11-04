/**
 * The first real Muse Spark call, to record the response shape: the brand agent's planShots on one valid
 * brief under the eval licence, with structured output (text.format json_schema, strict). Billed by tokens
 * ($1.25 / $0.15 cached / $4.25 per 1M input / cached / output; a plan is about a cent). Refuses without --yes.
 *
 *   pnpm meta:spark-check --yes --max-usd <dollars>
 *
 * Goes through the adapter itself (sparkBrandAgent.planShots); fetch is wrapped only to keep a copy of the
 * request body and the response. Writes eval/fixtures/spark-plan-response.json (no headers, so no key; the
 * reasoning item's encrypted_content cut short).
 */
import { budgetFromArgs, budgetSummary } from "@/lib/server/ai/budget";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { sparkBrandAgent } from "@/lib/server/ai/meta/spark";
import { judgeRegistry } from "@/lib/server/demo";
import { getLicence } from "@/lib/server/licences";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.argv.includes("--yes")) throw new Error("this makes one billed Muse Spark call (about $0.01); run with --yes");
// Required for a paid run: no Meta call is made that could take this run past it (lib/server/ai/budget.ts).
budgetFromArgs(process.argv, true);

/** Any string over 200 characters that isn't the answer itself (the reasoning's encrypted_content), cut short. */
const cut = (v: unknown, key = ""): unknown => {
  if (typeof v === "string") return v.length > 200 && key !== "text" && key !== "instructions" ? `${v.slice(0, 48)}…(${v.length} chars cut)` : v;
  if (Array.isArray(v)) return v.map((x) => cut(x));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cut(x, k)]));
  return v;
};

const BRIEF = { text: "Smiling in a sunlit café holding a ceramic coffee cup, product shot for a spring campaign", idea: "", product: "ceramic coffee cup", setting: "sunlit café", mood: "warm" as const, aspect: "1:1" as const, shots: 1 };

async function main() {
  const r = await judgeRegistry();
  const licence = r && (await getLicence(r.evalLicenceId));
  if (!licence) throw new Error("no eval licence (run pnpm seed:judges)");

  const seen: { request?: unknown; status?: number; response?: unknown } = {};
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const res = await realFetch(input, init);
    if (String(input).endsWith("/responses")) {
      seen.request = JSON.parse(String(init?.body ?? "null"));
      seen.status = res.status;
      seen.response = await res
        .clone()
        .json()
        .catch(() => null);
    }
    return res;
  };

  const t = Date.now();
  const plan = await sparkBrandAgent.planShots(BRIEF, licence);
  const latencyMs = Date.now() - t;
  globalThis.fetch = realFetch;

  mkdirSync("eval/fixtures", { recursive: true });
  writeFileSync(
    "eval/fixtures/spark-plan-response.json",
    JSON.stringify({ note: "One real Muse Spark call (scripts/spark-check.ts): planShots on the eval licence. Request body and response as sent and received; no headers.", at: new Date().toISOString(), latencyMs, httpStatus: seen.status, request: seen.request, response: cut(seen.response) }, null, 2) + "\n",
  );

  const usage = (plan.metrics.usage ?? {}) as { input_tokens?: number; output_tokens?: number; total_tokens?: number; output_tokens_details?: { reasoning_tokens?: number }; input_tokens_details?: { cached_tokens?: number } };
  const reasoning = usage.output_tokens_details?.reasoning_tokens;
  const inside = usage.total_tokens === (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
  const failed = plan.decisions.find((d) => d.code === "POLICY_CHECK_FAILED" || d.code === "MODEL_REFUSED");
  console.log(`HTTP ${seen.status} | model ${plan.metrics.model} | latency ${latencyMs} ms (adapter ${plan.metrics.latencyMs} ms)`);
  console.log("schema:", failed ? `NOT MATCHED or refused: ${failed.code}: ${failed.explanation}` : `matched (${plan.shots.length} shot(s))`);
  console.log("usage:", JSON.stringify(usage));
  console.log(`reasoning tokens: ${reasoning ?? "not reported"}; total = input + output: ${inside} (so reasoning ${inside && reasoning !== undefined && reasoning <= (usage.output_tokens ?? 0) ? "sits inside output_tokens" : "is not clearly inside output_tokens"})`);
  console.log("cost estimate:", JSON.stringify(plan.metrics.cost));
  console.log("decisions:", JSON.stringify(plan.decisions.map((d) => ({ shot: d.shotId, allowed: d.allowed, code: d.code }))));
  if (plan.shots[0]) console.log("shot 1 prompt:", plan.shots[0].prompt.slice(0, 300));
  console.log("saved: eval/fixtures/spark-plan-response.json");
}
main()
  .then(() => console.log(budgetSummary()))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
