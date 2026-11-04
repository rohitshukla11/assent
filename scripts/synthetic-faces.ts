/**
 * The eval's synthetic test faces (eval/fixtures/README.md), made once with Muse Image:
 *   wrong-face.jpg   a fully synthetic face, from text only (no reference images): someone who isn't the creator
 *   two-people.jpg   the synthetic creator (maya.jpg) and that face together, by multi-image edit
 * then the consent gate runs on each, locally and free (YuNet + AuraFace, the local face counter), against
 * the eval licence creator's reference photos. Billed: two images, $0.02. Refuses without --yes. An existing
 * wrong-face.jpg is reused (no new face) unless --new-face is given.
 *
 *   pnpm eval:synthetic-faces --yes --max-usd <dollars>
 *
 * Writes the two fixtures (1024 px JPEG), eval/fixtures/synthetic-faces.json (prompts, model, settings,
 * latency and usage; no image data) and the full-size originals to .data-demo/ (git-ignored).
 */
import { budgetFromArgs, budgetSummary } from "@/lib/server/ai/budget";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { localFaceSegmenter } from "@/lib/server/ai/local/segmenter";
import { metaPost } from "@/lib/server/ai/meta/client";
import { dataUrl, museImageBody, museImageConfig, museImageResult, type MuseImageResponse } from "@/lib/server/ai/meta/image";
import { runConsentGate } from "@/lib/server/consentGate";
import { getCreator } from "@/lib/server/creators";
import { judgeRegistry } from "@/lib/server/demo";
import { referenceEmbeddings } from "@/lib/server/facematch";
import { getLicence } from "@/lib/server/licences";
import { openFrames } from "@/lib/server/vault";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.argv.includes("--yes")) throw new Error("this makes up to two billed Muse Image calls ($0.02); run with --yes");
// Required for a paid run: no Meta call is made that could take this run past it (lib/server/ai/budget.ts).
budgetFromArgs(process.argv, true);

const FACE_PROMPT =
  "A photorealistic head-and-shoulders portrait of an invented adult man, about 45 years old, short dark hair with some grey, light stubble, " +
  "wearing a navy crew-neck sweater, calm expression, looking straight at the camera, plain light-grey studio background, soft even light. " +
  "A fictional person who does not resemble any real or famous person. One person only.";
const PAIR_PROMPT =
  "Make one new photo of exactly these two people standing side by side in a sunlit café, in a square photo: the woman from the first photo and the man from the second photo. " +
  "Keep each face as it is in their photo. Both face the camera, both faces fully visible and unobstructed, medium shot from the waist up, natural light. Two people only, nobody else.";

const FIXTURES = "eval/fixtures";
const jpeg = async (png: Uint8Array) => new Uint8Array(await sharp(png).resize({ width: 1024, height: 1024, fit: "inside" }).jpeg({ quality: 90 }).toBuffer());

async function generate(content: { type: string; text?: string; image_url?: string }[], aspect: "1:1") {
  const cfg = museImageConfig();
  const t = Date.now();
  const res = await metaPost<MuseImageResponse>("/responses", museImageBody(content, aspect, cfg), { timeoutMs: 180_000, retries: 0 });
  const latencyMs = Date.now() - t;
  const image = await museImageResult(res);
  return { image, record: { model: res.model ?? cfg.model, aspect, reasoningStrength: cfg.reasoningStrength, temperature: cfg.temperature, topP: cfg.topP, latencyMs, usage: res.usage, at: new Date().toISOString() } };
}

async function main() {
  const r = await judgeRegistry();
  const licence = r && (await getLicence(r.evalLicenceId));
  const creator = licence && (await getCreator(licence.creatorId));
  if (!licence || !creator) throw new Error("no eval licence or creator (run pnpm seed:judges)");
  mkdirSync(".data-demo", { recursive: true });
  const record: Record<string, unknown> = existsSync(`${FIXTURES}/synthetic-faces.json`) ? JSON.parse(readFileSync(`${FIXTURES}/synthetic-faces.json`, "utf8")) : {};
  // Written after each image, so a later failure never loses an earlier image's record.
  const save = () => writeFileSync(`${FIXTURES}/synthetic-faces.json`, JSON.stringify({ ...record, note: "Synthetic eval faces made with Muse Image (scripts/synthetic-faces.ts). No real person; no image data here." }, null, 2) + "\n");

  // 1. The stranger: text only, no reference images.
  let face: Uint8Array;
  if (existsSync(`${FIXTURES}/wrong-face.jpg`) && !process.argv.includes("--new-face")) {
    face = new Uint8Array(readFileSync(`${FIXTURES}/wrong-face.jpg`));
    console.log("wrong-face.jpg: reused (no call)");
  } else {
    const g = await generate([{ type: "input_text", text: FACE_PROMPT }], "1:1");
    writeFileSync(".data-demo/synthetic-face.png", g.image.bytes);
    face = await jpeg(g.image.bytes);
    writeFileSync(`${FIXTURES}/wrong-face.jpg`, face);
    record.wrongFace = { file: "wrong-face.jpg", prompt: FACE_PROMPT, references: "none (text only)", ...g.record };
    save();
    console.log(`wrong-face.jpg: generated in ${(g.record.latencyMs / 1000).toFixed(1)} s`);
  }

  // 2. The two people: the synthetic creator's photo and the stranger, by multi-image edit.
  const maya = new Uint8Array(readFileSync(`${FIXTURES}/maya.jpg`));
  const g2 = await generate(
    [
      { type: "input_text", text: "First photo:" },
      { type: "input_image", image_url: dataUrl({ bytes: maya, mime: "image/jpeg" }) },
      { type: "input_text", text: "Second photo:" },
      { type: "input_image", image_url: dataUrl({ bytes: face, mime: "image/jpeg" }) },
      { type: "input_text", text: PAIR_PROMPT },
    ],
    "1:1",
  );
  writeFileSync(".data-demo/synthetic-two-people.png", g2.image.bytes);
  const pair = await jpeg(g2.image.bytes);
  writeFileSync(`${FIXTURES}/two-people.jpg`, pair);
  record.twoPeople = { file: "two-people.jpg", prompt: PAIR_PROMPT, references: "maya.jpg (first) and wrong-face.jpg (second)", ...g2.record };
  console.log(`two-people.jpg: generated in ${(g2.record.latencyMs / 1000).toFixed(1)} s`);
  save();

  // 3. The consent gate on each, locally (free), against the eval creator's reference photos.
  const frames = await openFrames(creator, { licenceId: licence.id, renderId: `synthetic-faces-${Date.now()}`, by: "scripts/synthetic-faces.ts (eval fixtures)", label: "Evaluation run (automated test)" });
  const refs = await referenceEmbeddings(frames);
  frames.forEach((f) => f.fill(0));
  try {
    for (const [name, bytes] of [["wrong-face.jpg", face], ["two-people.jpg", pair]] as const) {
      const gate = await runConsentGate({ bytes, mime: "image/jpeg" }, refs, localFaceSegmenter, licence.creatorName);
      console.log(`${name}: ${gate.passed ? "PASS" : `BLOCK ${gate.code}`} | ${gate.short} | similarity ${gate.similarity} | figure: ${gate.figure?.people.map((p) => `${p.label} [${p.role}]`).join(" | ") ?? "none"}`);
    }
  } finally {
    refs.forEach((x) => x.fill(0));
  }
}
main()
  .then(() => console.log(budgetSummary()))
  .catch((e) => {
    console.error("FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
