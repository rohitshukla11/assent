/**
 * Copy likeness-ai's synthetic demo creators (generated faces, no real person: see scripts/seed-demo.ts)
 * into likeness-meta's own Firestore database and bucket, so judges get pre-approved creators without
 * onboarding. Read-only on likeness-ai: its database and bucket are only read, never written.
 *
 *   pnpm copy:demo            dry run: lists what would be copied, with counts; writes nothing
 *   pnpm copy:demo --write    copies; never overwrites anything already in likeness-meta
 *
 * Per creator: creators/{uid} (demo: true only), vault/{uid}/{n}.bin (the frames, still encrypted:
 * same KMS key, the creator id is bound in, so they open unchanged) and public/{uid}.jpg. Video terms
 * from likeness-ai are dropped. Each copy is marked copiedFrom, as pre-existing synthetic data.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage";
import { firestore } from "@/lib/server/firebase-admin";
import { gcp } from "@/lib/server/gcp";
import type { CreatorDoc, Terms } from "@/lib/model";

const WRITE = process.argv.includes("--write");
const project = gcp.project();
if (!project) throw new Error("set GOOGLE_CLOUD_PROJECT");
const SOURCE_DB = "likeness";
const SOURCE_BUCKET = `${project}-likeness-private`;
const log = (...a: unknown[]) => console.log(...a);

// likeness-ai, read-only: only get() on documents and exists() / copy-from on objects are used.
const sourceApp = getApps().find((a) => a.name === "likeness-ai-readonly") ?? initializeApp({ projectId: project }, "likeness-ai-readonly");
const source = {
  demoCreators: async () => (await getFirestore(sourceApp, SOURCE_DB).collection("creators").where("demo", "==", true).get()).docs.map((d) => d.data() as CreatorDoc & { terms?: Terms & Record<string, unknown> }),
  file: (path: string) => new Storage().bucket(SOURCE_BUCKET).file(path),
};
const dest = { db: firestore(), bucket: new Storage().bucket(gcp.bucket()) };

/** Image-only terms: likeness-ai's video fields are not carried over. */
function imageTerms(t: (Terms & Record<string, unknown>) | undefined): Terms | undefined {
  if (!t) return undefined;
  return { uses: t.uses, pricePerImage: t.pricePerImage, maxRendersPerLicence: t.maxRendersPerLicence, maxDays: t.maxDays, approval: "manual" };
}

async function main() {
  log(`${WRITE ? "COPY" : "DRY RUN (nothing is written)"}: ${SOURCE_DB} / ${SOURCE_BUCKET} (likeness-ai, read-only) → ${gcp.firestoreDb()} / ${gcp.bucket()}`);
  const creators = await source.demoCreators();
  const counts = { creators: creators.length, docsCopied: 0, docsAlreadyThere: 0, objects: 0, objectsCopied: 0, objectsAlreadyThere: 0, objectsMissingInSource: 0 };
  for (const c of creators) {
    const objects = [...Array.from({ length: c.frames?.count ?? 0 }, (_, i) => `vault/${c.uid}/${i}.bin`), ...(c.publicPhoto ? [`public/${c.uid}.jpg`] : [])];
    counts.objects += objects.length;
    log(`- ${c.uid} (${c.displayName}): ${c.frames?.count ?? 0} sealed frames${c.publicPhoto ? " + public photo" : ""}`);
    for (const o of objects) {
      const [inSource] = await source.file(o).exists();
      if (!inSource) {
        counts.objectsMissingInSource++;
        log(`    missing in likeness-ai: ${o}`);
        continue;
      }
      if (!WRITE) continue;
      const [already] = await dest.bucket.file(o).exists();
      if (already) {
        counts.objectsAlreadyThere++;
        continue;
      }
      await source.file(o).copy(dest.bucket.file(o), { preconditionOpts: { ifGenerationMatch: 0 } });
      counts.objectsCopied++;
    }
    if (!WRITE) continue;
    const ref = dest.db.collection("creators").doc(c.uid);
    if ((await ref.get()).exists) {
      counts.docsAlreadyThere++;
      continue;
    }
    const { terms, ...rest } = c;
    const t = imageTerms(terms);
    await ref.create({ ...rest, ...(t ? { terms: t } : {}), demo: true, copiedFrom: { project, database: SOURCE_DB, at: Date.now(), note: "pre-existing synthetic demo creator from likeness-ai" } });
    counts.docsCopied++;
  }
  log("counts:", counts);
  if (counts.objectsMissingInSource) process.exitCode = 1;
}
main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
