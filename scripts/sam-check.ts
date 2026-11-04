/**
 * The first real SAM 3.1 call, to record the stream's shape: the two-person fixture
 * (eval/fixtures/two-people.jpg, synthetic) through the adapter. Billed: one image, $0.0025. Refuses
 * without --yes. Writes eval/fixtures/sam-response.txt: the raw stream with every mask payload (data=)
 * and any other long string cut short; then parses it with the same code the consent gate uses.
 * The request sends store: false (not in the SAM docs). If Meta rejects it (HTTP 400 naming store), the
 * call is repeated once without it, a second billed image ($0.0025, $0.005 at most), and the script says
 * so: then drop store from samRequest and note it in the README.
 *
 *   pnpm meta:sam-check --yes --max-usd <dollars>                      the two-person fixture
 *   pnpm meta:sam-check --yes --max-usd <dollars> --image <path>       another JPEG or PNG (e.g. .data-demo/muse-image-check.png)
 */
import { budgetFromArgs, budgetSummary } from "@/lib/server/ai/budget";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { MetaApiError } from "@/lib/server/ai/meta/client";
import { samDetect } from "@/lib/server/ai/meta/sam";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.argv.includes("--yes")) throw new Error("this makes one billed SAM 3.1 call ($0.0025); run with --yes (at most $0.005 if store: false is rejected and the call is repeated)");
// Required for a paid run: no Meta call is made that could take this run past it (lib/server/ai/budget.ts).
budgetFromArgs(process.argv, true);

/** Mask payloads after data=H,W,<enc> and any other long run of payload characters, cut to 24 characters. */
const cut = (raw: string) =>
  raw
    .replace(/(data=\d+,\d+,.)([^|"\\]{24})[^|"\\]*/g, (_, head: string, keep: string) => `${head}${keep}…(cut)`)
    .replace(/[A-Za-z0-9+/=]{200,}/g, (m) => `${m.slice(0, 24)}…(${m.length} chars cut)`);

async function main() {
  const i = process.argv.indexOf("--image");
  const path = i > 0 ? process.argv[i + 1] : "eval/fixtures/two-people.jpg";
  const bytes = new Uint8Array(readFileSync(path));
  const image = { bytes, mime: bytes[0] === 0x89 ? ("image/png" as const) : ("image/jpeg" as const) };
  console.log(`image: ${path} (${bytes.length} bytes, ${image.mime})`);
  let raw = "";
  const t = Date.now();
  const detect = (sendStore: boolean) =>
    samDetect(image, { onRaw: (r) => void (raw = r), sendStore }).catch((e) => {
      if (raw) writeFileSync("eval/fixtures/sam-response.txt", cut(raw));
      throw e;
    });
  const storeRejected = (e: unknown) => e instanceof MetaApiError && e.httpStatus === 400 && /store/i.test(e.message);
  const p = await detect(true).catch(async (e) => {
    if (!storeRejected(e)) throw e;
    console.log(`store: false REJECTED (HTTP 400: ${e.message.slice(0, 160)}); repeating once without it. Drop store from samRequest and note it in the README.`);
    return detect(false);
  });
  writeFileSync("eval/fixtures/sam-response.txt", cut(raw));
  console.log(`SAM 3.1: ${p.count} people in ${((Date.now() - t) / 1000).toFixed(1)} s; boxes ${JSON.stringify(p.boxes.map((b) => [b.x, b.y, b.w, b.h].map((v) => Number(v.toFixed(3)))))}; masks ${p.masks.map((m) => `${m.height}×${m.width}`).join(", ")}`);
  console.log(`cost estimate: $${p.metrics.cost?.costUsd}; stream saved (payloads cut) to eval/fixtures/sam-response.txt`);
}
main()
  .then(() => console.log(budgetSummary()))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
