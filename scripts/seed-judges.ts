/**
 * Judge mode: seed the accounts a judge uses from a fresh browser, with synthetic faces only.
 *
 *   pnpm seed:judges
 *
 * 1. Checks that Firebase allows email/password sign-in; if not, stops before changing anything.
 * 2. The judge creator: the synthetic demo creator copied from likeness-ai (demo-maya-okafor) under a
 *    likeness-meta-only uid, so the judge login can never act on likeness-ai's copy (Firebase Auth is
 *    shared by both apps). Its encrypted frames are opened and sealed again under the new uid; the
 *    copied doc is unlisted, not deleted. Pre-approved: no YouTube or liveness onboarding.
 * 3. Email/password sign-in for the judge brand and the judge creator. New passwords are generated and
 *    written to .secrets/judge-accounts.json (git-ignored, mode 0600), never printed.
 * 4. The judge brand: profile, its one demo top-up, and a licence through the normal request flow
 *    (the synthetic creator approves at once, within her terms). If the licence would end before
 *    16 Nov 2026 it is moved to 30 Nov 2026 and the script says so (record it in CHANGES.md).
 * 5. A separate eval brand and licence for scripts/eval (no login).
 * 6. demo/judges records it all; "Reset demo" restores the judge licence from it.
 * Safe to run again: whatever exists is kept.
 */
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { DEMO_TOPUP, type CreatorDoc } from "@/lib/model";
import { ensureUser, saveBrand, setRole, topUp } from "@/lib/server/accounts";
import { emailPasswordEnabled, judgeRegistry, type JudgeRegistry } from "@/lib/server/demo";
import { adminAuth, firestore } from "@/lib/server/firebase-admin";
import { gcp } from "@/lib/server/gcp";
import { fileRequest, getLicence } from "@/lib/server/licences";
import { getObject, putObject } from "@/lib/server/storage";
import { openFrames, sealFrames } from "@/lib/server/vault";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const SOURCE_CREATOR = process.env.DEMO_SOURCE_CREATOR || "demo-maya-okafor";
const CREATOR_UID = process.env.JUDGE_CREATOR_UID || "meta-demo-maya-okafor";
const BRAND_UID = process.env.JUDGE_BRAND_UID || "meta-judge-brand";
const EVAL_BRAND_UID = process.env.EVAL_BRAND_UID || "meta-eval-brand";
const BRAND_EMAIL = process.env.JUDGE_BRAND_EMAIL || "judge-brand@example.com";
const CREATOR_EMAIL = process.env.JUDGE_CREATOR_EMAIL || "judge-creator@example.com";
const MIN_END = Date.UTC(2026, 10, 16);
const MOVED_END = Date.UTC(2026, 10, 30, 23, 59, 59);
const log = (...a: unknown[]) => console.log(...a);
const db = firestore();

async function main() {
  log(`Judge mode seed → Firestore ${gcp.firestoreDb()}, bucket ${gcp.bucket()}`);
  if (!(await emailPasswordEnabled())) {
    console.error(
      [
        "STOP: email/password sign-in is not enabled in Firebase Authentication, so judges couldn't sign in.",
        `Enable it in the Firebase console: project ${gcp.project()} → Authentication → Sign-in method → Email/Password → Enable (leave "Email link" off).`,
        "Then run pnpm seed:judges again. Nothing was changed.",
      ].join("\n"),
    );
    process.exit(2);
  }
  const prior = await judgeRegistry();

  // 2. The judge creator under a likeness-meta-only uid.
  const creator = await rekeyCreator();

  // 3. Sign-in accounts.
  const secrets: Record<string, { email: string; password: string }> = {};
  for (const [uid, email, name] of [[BRAND_UID, BRAND_EMAIL, "Judge brand"], [CREATOR_UID, CREATOR_EMAIL, creator.displayName]] as const) {
    const exists = await adminAuth().getUser(uid).then(() => true, () => false);
    if (exists) {
      log(`- sign-in for ${uid} exists; password unchanged`);
      continue;
    }
    const password = randomBytes(15).toString("base64url");
    await adminAuth().createUser({ uid, email, password, displayName: name, emailVerified: true });
    secrets[uid] = { email, password };
    log(`- created sign-in for ${uid} (${email})`);
  }
  if (Object.keys(secrets).length) {
    mkdirSync(".secrets", { recursive: true });
    writeFileSync(".secrets/judge-accounts.json", JSON.stringify(secrets, null, 2) + "\n", { mode: 0o600 });
    chmodSync(".secrets/judge-accounts.json", 0o600);
    log("- new passwords written to .secrets/judge-accounts.json (git-ignored, not printed)");
  }
  await ensureUser(CREATOR_UID, creator.displayName, CREATOR_EMAIL);
  await setRole(CREATOR_UID, "creator");

  // 4. The judge brand and its licence (normal request flow).
  const judge = await brandWithLicence(BRAND_UID, BRAND_EMAIL, "Brew & Co. (judge demo)", "Spring launch of our oat latte: product ads in a sunlit café.", prior?.licenceId);
  // 5. The eval brand and its own licence.
  const evalB = await brandWithLicence(EVAL_BRAND_UID, null, "Assent eval brand", "Evaluation runs of the render pipeline, separate from the judge demo.", prior?.evalLicenceId);

  const registry: JudgeRegistry = {
    brandUid: BRAND_UID,
    creatorUid: CREATOR_UID,
    sourceCreatorUid: SOURCE_CREATOR,
    licenceId: judge.licenceId,
    licenceEnd: judge.end,
    brandCredits: prior?.brandCredits ?? DEMO_TOPUP,
    evalBrandUid: EVAL_BRAND_UID,
    evalLicenceId: evalB.licenceId,
    seededAt: prior?.seededAt ?? Date.now(),
  };
  await db.collection("demo").doc("judges").set(registry);
  log("- demo/judges recorded:", JSON.stringify({ ...registry, licenceEnd: new Date(registry.licenceEnd).toISOString() }));
}

/** The synthetic creator under CREATOR_UID: frames re-sealed for the new uid, public photo copied, the source unlisted. */
async function rekeyCreator(): Promise<CreatorDoc> {
  const ref = db.collection("creators").doc(CREATOR_UID);
  const have = await ref.get();
  if (have.exists) {
    log(`- judge creator ${CREATOR_UID} exists`);
    return have.data() as CreatorDoc;
  }
  const src = (await db.collection("creators").doc(SOURCE_CREATOR).get()).data() as CreatorDoc | undefined;
  if (!src?.demo) throw new Error(`${SOURCE_CREATOR} isn't a synthetic demo creator in ${gcp.firestoreDb()} (run pnpm copy:demo --write first)`);
  const frames = await openFrames(src, { licenceId: "judge-seed", renderId: `judge-seed-${Date.now()}`, by: `scripts/seed-judges.ts (re-key ${SOURCE_CREATOR} → ${CREATOR_UID})`, label: "Setup: re-key for judge mode" });
  let sealed;
  try {
    sealed = await sealFrames(CREATOR_UID, frames);
  } finally {
    frames.forEach((f) => f.fill(0));
  }
  const photo = await getObject(`public/${SOURCE_CREATOR}.jpg`);
  if (photo) await putObject(`public/${CREATOR_UID}.jpg`, photo, "image/jpeg");
  const now = Date.now();
  const doc: CreatorDoc & { rekeyedFrom: string } = { ...src, uid: CREATOR_UID, wrappedKey: sealed.wrappedKey, frames: { count: frames.length, sealedAt: now, sha256: sealed.sha256 }, listed: true, updatedAt: now, rekeyedFrom: SOURCE_CREATOR };
  await ref.create(doc);
  await db.collection("creators").doc(SOURCE_CREATOR).update({ listed: false, updatedAt: now });
  log(`- judge creator ${CREATOR_UID} created from ${SOURCE_CREATOR} (${frames.length} frames re-sealed; ${SOURCE_CREATOR} unlisted)`);
  return doc;
}

/** A brand profile, its one demo top-up, and a licence through fileRequest (auto-approved by the synthetic creator). */
async function brandWithLicence(uid: string, email: string | null, name: string, brief: string, existingLicenceId: string | undefined): Promise<{ licenceId: string; end: number }> {
  await ensureUser(uid, name, email);
  await setRole(uid, "brand");
  await saveBrand(uid, name, "example.com");
  await topUp(uid).then(
    (b) => log(`- ${uid}: demo top-up, balance ${b}`),
    () => log(`- ${uid}: already topped up`),
  );
  const existing = existingLicenceId ? await getLicence(existingLicenceId) : null;
  if (existing) {
    log(`- ${uid}: licence ${existing.id} exists`);
    return { licenceId: existing.id, end: existing.end };
  }
  const creator = (await db.collection("creators").doc(CREATOR_UID).get()).data() as CreatorDoc;
  const days = creator.terms!.maxDays;
  const req = await fileRequest(uid, { creatorId: CREATOR_UID, use: "advertising", days, maxRenders: creator.terms!.maxRendersPerLicence, brief });
  if (req.state !== "approved" || !req.licenceId) throw new Error(`the licence request for ${uid} wasn't approved (${req.state})`);
  let end = (await getLicence(req.licenceId))!.end;
  if (end < MIN_END) {
    await db.collection("licences").doc(req.licenceId).update({ end: MOVED_END });
    log(`NOTE: ${uid}'s licence ${req.licenceId} would have ended ${new Date(end).toISOString()}; moved to ${new Date(MOVED_END).toISOString()}. Record this in CHANGES.md.`);
    end = MOVED_END;
  }
  log(`- ${uid}: licence ${req.licenceId} approved through the request flow, ${creator.terms!.maxRendersPerLicence} renders, until ${new Date(end).toISOString()}`);
  return { licenceId: req.licenceId, end };
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
