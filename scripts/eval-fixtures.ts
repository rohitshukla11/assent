/**
 * Build the consent-gate eval fixtures from the synthetic demo creator's public photo (no new faces):
 *   maya.jpg        the photo as stored (one person, the licensed creator)
 *   face-cut.jpg    the photo shifted up so the face is cut by the top edge
 *   no-person.jpg   a plain scene with nobody in it
 * wrong-face.jpg and two-people.jpg are not built here: they are made once with Muse Image
 * (scripts/synthetic-faces.ts, see eval/fixtures/README.md). Free: one Storage read.
 *
 *   pnpm eval:fixtures
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { judgeRegistry } from "@/lib/server/demo";
import { getObject } from "@/lib/server/storage";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

async function main() {
  const r = await judgeRegistry();
  if (!r) throw new Error("run pnpm seed:judges first");
  const photo = await getObject(`public/${r.creatorUid}.jpg`);
  if (!photo) throw new Error(`public/${r.creatorUid}.jpg is missing`);
  mkdirSync("eval/fixtures", { recursive: true });
  const { width = 512, height = 512 } = await sharp(photo).metadata();
  writeFileSync("eval/fixtures/maya.jpg", photo);
  const shift = Math.round(height * 0.35);
  const cut = await sharp({ create: { width, height, channels: 3, background: "#d9d4cc" } })
    .composite([{ input: await sharp(photo).extract({ left: 0, top: shift, width, height: height - shift }).toBuffer(), left: 0, top: 0 }])
    .jpeg({ quality: 90 })
    .toBuffer();
  writeFileSync("eval/fixtures/face-cut.jpg", cut);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3efe7"/><stop offset="1" stop-color="#c9b79c"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="${width * 0.35}" y="${height * 0.55}" width="${width * 0.3}" height="${height * 0.25}" rx="18" fill="#8a6a4f"/><ellipse cx="${width / 2}" cy="${height * 0.5}" rx="${width * 0.08}" ry="${height * 0.06}" fill="#f8f6f2"/></svg>`;
  writeFileSync("eval/fixtures/no-person.jpg", await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer());
  const made = ["wrong-face.jpg", "two-people.jpg"].map((f) => `${f} ${existsSync(`eval/fixtures/${f}`) ? "present" : "missing (pnpm eval:synthetic-faces)"}`).join("; ");
  console.log(`built eval/fixtures: maya.jpg, face-cut.jpg, no-person.jpg (from public/${r.creatorUid}.jpg); ${made}`);
}
main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
