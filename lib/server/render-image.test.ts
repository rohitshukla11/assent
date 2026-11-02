/**
 * Revocation during a render: the licence is Active when the render starts and revoked between the
 * image generation and the payment. The payment step re-reads it inside its transaction and refuses with
 * LICENCE_REVOKED: nothing is charged, no render or receipt is stored, the stored files are removed, and
 * the render's cost is kept in blockedRenders. Firestore is an in-memory stand-in; KMS and storage are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LicenceDoc } from "@/lib/model";
import { nextId, store } from "./testing/memoryFirestore";

// Firestore in memory, shared with the code under test through these mocks.
vi.mock("./firebase-admin", async () => {
  const m = await import("./testing/memoryFirestore");
  return { firestore: () => m.fakeDb, adminAuth: () => ({}) };
});
vi.mock("firebase-admin/firestore", async () => ({ FieldValue: (await import("./testing/memoryFirestore")).fieldValue }));
const objects = new Set<string>();
vi.mock("./storage", () => ({
  putObject: async (p: string) => void objects.add(p),
  deleteObject: async (p: string) => void objects.delete(p),
  getObject: async () => null,
  signedUrl: async () => "",
}));
// The vault stand-in writes the access-log entry the real one writes (decryptions), so the store shows any opening.
const openFrames = vi.hoisted(() => vi.fn());
vi.mock("./vault", () => ({ openFrames }));
vi.mock("./receipts", () => ({ signPayload: async () => ({ payload: {}, canonical: "", signature: "sig", keyVersion: "1", alg: "EC_SIGN_P256_SHA256" }) }));

const { payOrBlock, blockedReason, isFixtureRecord, FIXTURE_REVERSAL_REASON, EVAL_REVERSAL_REASON, renderImage, renderAlternative, preflight, day } = await import("./render-image");

const now = Date.now();
const licence: LicenceDoc = {
  id: "L1", requestId: "R1", brandId: "brand", brandName: "Brew & Co.", creatorId: "creator", creatorName: "Demo", use: "advertising",
  start: now - 86_400_000, end: now + 7 * 86_400_000, maxRenders: 4, renderCount: 0, pricePerImage: 200, createdAt: now - 86_400_000,
};
const cost = { costUsd: 0.0127, estimate: true as const, complete: true, calls: [] };
const consent = { code: null, explanation: "ok", people: 1, faces: 1, similarity: 0.6, threshold: 0.35, segmenter: "test", figure: null };
const settleInput = () => ({ brandUid: "brand", licence, bytes: new Uint8Array([1, 2, 3]), mime: "image/jpeg", model: "gemini-test", brief: "café shot", renderId: "render1", previewObject: "renders/preview/render1.jpg", aspect: "1:1" as const, consent, cost });
const blocked = { id: "render1", licenceId: "L1", brandId: "brand", creatorId: "creator", brief: "café shot", model: "gemini-test", charged: 0 as const, consent, cost };

beforeEach(() => {
  store.clear();
  objects.clear();
  store.set("licences/L1", { ...licence });
  store.set("credits/brand", { uid: "brand", balance: 2000 });
  store.set("credits/creator", { uid: "creator", balance: 0 });
  objects.add("renders/preview/render1.jpg"); // written just before payment
});

describe("revocation during a render", () => {
  it("revoked between generate and payment: LICENCE_REVOKED, nothing charged, files removed, cost kept in blockedRenders", async () => {
    store.set("licences/L1", { ...licence, revokedAt: Date.now() }); // the creator revokes while the image is being made
    await expect(payOrBlock(settleInput(), blocked)).rejects.toMatchObject({ status: 409, code: "LICENCE_REVOKED", blockedAfterGeneration: true });
    expect(store.get("credits/brand")!.balance).toBe(2000);
    expect(store.get("credits/creator")!.balance).toBe(0);
    expect(store.get("licences/L1")!.renderCount).toBe(0);
    expect(store.has("renders/render1")).toBe(false);
    expect([...store.keys()].some((k) => k.startsWith("receipts/"))).toBe(false);
    expect([...store.keys()].some((k) => k.startsWith("ledger/"))).toBe(false);
    expect(objects.size).toBe(0);
    expect(store.get("blockedRenders/render1")).toMatchObject({ blockedBy: "payment", code: "LICENCE_REVOKED", charged: 0, cost: { costUsd: 0.0127 } });
  });

  it("an expired or used-up licence at payment is refused with its own code", async () => {
    store.set("licences/L1", { ...licence, end: Date.now() - 1 });
    await expect(payOrBlock(settleInput(), blocked)).rejects.toMatchObject({ code: "LICENCE_EXPIRED" });
    store.delete("blockedRenders/render1");
    store.set("licences/L1", { ...licence, renderCount: 4 });
    await expect(payOrBlock(settleInput(), blocked)).rejects.toMatchObject({ code: "OVER_CAP" });
  });

  it("still active at payment: paid and delivered once", async () => {
    const { render } = await payOrBlock(settleInput(), blocked);
    expect(render.price).toBe(200);
    expect(store.get("credits/brand")!.balance).toBe(1800);
    expect(store.get("credits/creator")!.balance).toBe(180);
    expect(store.get("licences/L1")!.renderCount).toBe(1);
    expect(store.has("renders/render1")).toBe(true);
    expect(store.has("blockedRenders/render1")).toBe(false);
    expect([...objects]).toContain(`renders/${render.sha256}.jpg`);
  });
});

describe("development (fixture) renders", () => {
  const ledger = (uid: string) => [...store.entries()].filter(([k, v]) => k.startsWith("ledger/") && v.uid === uid).map(([, v]) => v);
  it("paid: the creator's payout is reversed in the same transaction, so their ledger sums to 0 and their balance is unchanged", async () => {
    const { render } = await payOrBlock({ ...settleInput(), model: "fixture:maya.jpg" }, { ...blocked, model: "fixture:maya.jpg" });
    expect(render.fixture).toBe(true);
    const maya = ledger("creator");
    expect(maya.map((e) => e.delta)).toEqual([180, -180]);
    expect(maya[1]).toMatchObject({ reason: FIXTURE_REVERSAL_REASON, renderId: "render1", licenceId: "L1" });
    expect(FIXTURE_REVERSAL_REASON).toBe("Reversal of development test renders");
    expect(store.get("credits/creator")!.balance).toBe(0);
    expect(store.get("credits/brand")!.balance).toBe(1800); // the judge reset restores it
  });
  it("an eval-brand render: flagged, and the payout reversed the same way", async () => {
    const { render } = await payOrBlock({ ...settleInput(), evalRun: true }, blocked);
    expect(render.evalRun).toBe(true);
    expect(ledger("creator").map((e) => [e.delta, e.reason])).toEqual([[180, expect.stringMatching(/image render/)], [-180, EVAL_REVERSAL_REASON]]);
    expect(EVAL_REVERSAL_REASON).toBe("Reversal of evaluation run (automated test)");
    expect(store.get("credits/creator")!.balance).toBe(0);
  });
  it("a real render leaves the creator's payout alone", async () => {
    await payOrBlock(settleInput(), blocked);
    expect(ledger("creator").map((e) => e.delta)).toEqual([180]);
    expect(store.get("credits/creator")!.balance).toBe(180);
  });
  it("blocked: the record is flagged, so only the admin view lists it", async () => {
    store.set("licences/L1", { ...licence, revokedAt: Date.now() });
    await expect(payOrBlock({ ...settleInput(), model: "fixture:two-people.jpg" }, { ...blocked, model: "fixture:two-people.jpg" })).rejects.toMatchObject({ code: "LICENCE_REVOKED" });
    expect(store.get("blockedRenders/render1")).toMatchObject({ fixture: true });
    expect(isFixtureRecord({ model: "fixture:two-people.jpg" })).toBe(true);
    expect(isFixtureRecord({ model: "muse-image-1.0" })).toBe(false);
  });
});

describe("why a render was blocked", () => {
  it("names the check and its code in plain language", () => {
    expect(blockedReason({ blockedBy: "consent", consent: { ...consent, code: "MULTIPLE_PEOPLE", explanation: "2 people were found" } })).toEqual({ code: "MULTIPLE_PEOPLE", explanation: "2 people were found" });
    expect(blockedReason({ blockedBy: "payment", code: "LICENCE_REVOKED", consent })).toEqual({ code: "LICENCE_REVOKED", explanation: "Refused at payment after the image was made: the licence, the credits or a limit changed during the render." });
    expect(blockedReason({ blockedBy: "review", consent, review: { verdict: "block", reasons: ["Wrong product."], skipped: false } })).toEqual({ code: "REVIEW_BLOCKED", explanation: "Wrong product." });
  });
});

describe("a shape the provider can't make", () => {
  it("is refused before anything runs: no claim, no step log, no model call", async () => {
    const saved = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "meta";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await expect(renderImage("brand", "L1", "café shot", "16:9", { requestId: "4f1c2b8e-1111-4222-8333-944455556666" })).rejects.toMatchObject({ status: 422, code: "UNSUPPORTED_SIZE" });
      expect([...store.keys()].some((k) => k.startsWith("renderLogs/") || k.startsWith("renderRequests/"))).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      if (saved === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = saved;
    }
  });
});

describe("the creator's reference photos", () => {
  const openings = () => [...store.keys()].filter((k) => k.startsWith("decryptions/"));
  beforeEach(() => {
    openFrames.mockReset();
    openFrames.mockImplementation(async () => {
      store.set(`decryptions/${nextId()}`, { creatorId: "creator", at: Date.now() });
      return [];
    });
    store.set("creators/creator", { uid: "creator", displayName: "Demo", status: "live" });
  });
  const run = async (brief: string) => {
    const saved = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "fixture";
    try {
      return await renderImage("brand", "L1", brief, "1:1").then(
        () => null,
        (e: { code?: string }) => e.code,
      );
    } finally {
      if (saved === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = saved;
    }
  };
  it("are never opened when the policy check refuses: no access-log entry", async () => {
    expect(await run("The person at a campaign rally telling people to vote for a candidate")).toBe("BANNED_USE");
    expect(openFrames).not.toHaveBeenCalled();
    expect(openings()).toEqual([]);
  });
  it("are opened once the policy check has passed (control)", async () => {
    // With no usable reference face the render stops at the gate's preparation, after the opening.
    expect(await run("The person smiling in a sunlit café holding a ceramic coffee cup")).toBe("GATE_ERROR");
    expect(openFrames).toHaveBeenCalledTimes(1);
    expect(openings()).toHaveLength(1);
  });
});

describe("a plan the model refuses", () => {
  it("keeps the call's model, effort and cost in the step log", async () => {
    const saved = { provider: process.env.AI_PROVIDER, key: process.env.MODEL_API_KEY };
    process.env.AI_PROVIDER = "meta";
    process.env.MODEL_API_KEY = "test-key";
    const answer = { refused: true, refusalReason: "Political campaign content.", shots: [] };
    const res = { model: "muse-spark-1.3", status: "completed", reasoning: { effort: "high" }, usage: { input_tokens: 600, output_tokens: 1000, input_tokens_details: { cached_tokens: 0 } }, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(answer) }] }] };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(res), { status: 200 }));
    try {
      await expect(renderImage("brand", "L1", "The person at a town-hall podium urging neighbours to back Reyes on polling day", "1:1")).rejects.toMatchObject({ code: "MODEL_REFUSED" });
      const log = [...store.entries()].find(([k]) => k.startsWith("renderLogs/"))![1] as { steps: { step: string; status: string; costUsd?: number; model?: string; settings?: Record<string, unknown> }[] };
      const plan = log.steps.find((x) => x.step === "plan")!;
      // The plan sends its default effort, "low" (the eval's choice); the step records it.
      expect(plan).toMatchObject({ status: "refused", model: "muse-spark-1.3", settings: { reasoning_effort: "low" } });
      expect(plan.costUsd).toBeCloseTo((600 * 1.25 + 1000 * 4.25) / 1e6, 6);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
      for (const [k, v] of [["AI_PROVIDER", saved.provider], ["MODEL_API_KEY", saved.key]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe("asking for an alternative to a flagged image", () => {
  const flagged = { id: "flagged1", licenceId: "L1", brandId: "brand", creatorId: "creator", brief: "café shot", prompt: "café shot, medium close-up", aspect: "1:1", price: 200, review: { verdict: "flag", reasons: ["Hands cropped at the bottom edge."], skipped: false } };
  const fetchSpy = () => vi.spyOn(globalThis, "fetch");
  it("is refused, before any model call, for someone else's image, an image that wasn't flagged, or an alternative", async () => {
    const f = fetchSpy();
    try {
      store.set("renders/flagged1", { ...flagged, brandId: "other" });
      await expect(renderAlternative("brand", "flagged1", "4f1c2b8e-1111-4222-8333-944455556666")).rejects.toMatchObject({ code: "NO_RENDER" });
      store.set("renders/flagged1", { ...flagged, review: { verdict: "pass", reasons: [], skipped: false } });
      await expect(renderAlternative("brand", "flagged1", "4f1c2b8e-1111-4222-8333-944455556666")).rejects.toMatchObject({ code: "NOT_FLAGGED" });
      store.set("renders/flagged1", { ...flagged, alternativeOf: "earlier" });
      await expect(renderAlternative("brand", "flagged1", "4f1c2b8e-1111-4222-8333-944455556666")).rejects.toMatchObject({ code: "NOT_FLAGGED" });
      expect(f).not.toHaveBeenCalled();
    } finally {
      f.mockRestore();
    }
  });
  it("allows one per flagged image: the claim is made before anything is spent, and a second request is refused", async () => {
    const saved = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "google"; // no brand agent for alternatives: the proposal fails after the claim, at no cost
    const f = fetchSpy();
    try {
      store.set("renders/flagged1", { ...flagged });
      await expect(renderAlternative("brand", "flagged1", "4f1c2b8e-1111-4222-8333-944455556666")).rejects.toMatchObject({ code: "MODEL_REFUSED" });
      expect(store.get("renders/flagged1")!.alternativeId).toBeTruthy();
      await expect(renderAlternative("brand", "flagged1", "9a9a9a9a-1111-4222-8333-944455556666")).rejects.toMatchObject({ code: "ALTERNATIVE_USED" });
      expect(f).not.toHaveBeenCalled();
    } finally {
      f.mockRestore();
      if (saved === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = saved;
    }
  });
});

describe("the site-wide daily limit", () => {
  const site = () => `usage/${day()}`;
  const brandUsage = () => `usage/${day()}/brands/brand`;
  beforeEach(() => store.set(site(), { renders: 40 })); // the site's 40 used up by real renders
  it("refuses a real render once the site's 40 are used", async () => {
    await expect(payOrBlock(settleInput(), blocked)).rejects.toMatchObject({ code: "DAILY_LIMIT" });
  });
  it("doesn't count, or refuse, an eval-brand render; its brand still counts it", async () => {
    await payOrBlock({ ...settleInput(), evalRun: true }, blocked);
    expect(store.get(site())).toEqual({ renders: 40 });
    expect(store.get(brandUsage())).toMatchObject({ renders: 1 });
  });
  it("doesn't count, or refuse, a development (fixture) render", async () => {
    await payOrBlock({ ...settleInput(), model: "fixture:maya.jpg" }, { ...blocked, model: "fixture:maya.jpg" });
    expect(store.get(site())).toEqual({ renders: 40 });
    expect(store.get(brandUsage())).toMatchObject({ renders: 1 });
  });
  it("doesn't count a blocked test render toward the site, only toward its brand", async () => {
    store.set(site(), { renders: 3 });
    store.set("licences/L1", { ...licence, revokedAt: Date.now() });
    await expect(payOrBlock({ ...settleInput(), evalRun: true }, { ...blocked, evalRun: true })).rejects.toMatchObject({ code: "LICENCE_REVOKED" });
    expect(store.get(site())).toEqual({ renders: 3 });
    expect(store.get(brandUsage())).toMatchObject({ blocked: 1 });
    store.delete("blockedRenders/render1");
    await expect(payOrBlock(settleInput(), blocked)).rejects.toMatchObject({ code: "LICENCE_REVOKED" });
    expect(store.get(site())).toMatchObject({ renders: 3, blocked: 1 });
  });
  it("is checked before a render too: a development run passes it, a real one doesn't", async () => {
    const saved = process.env.AI_PROVIDER;
    try {
      process.env.AI_PROVIDER = "fixture";
      await expect(preflight("brand", "L1")).resolves.toMatchObject({ price: 200 });
      process.env.AI_PROVIDER = "meta";
      await expect(preflight("brand", "L1")).rejects.toMatchObject({ code: "DAILY_LIMIT" });
    } finally {
      if (saved === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = saved;
    }
  });
});

