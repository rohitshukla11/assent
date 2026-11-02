/**
 * A reviewer's block, through the whole pipeline in memory: the image is blocked by the output review, one
 * automatic alternative shot is proposed and rendered, and it is (a) delivered and charged once, or (b) blocked
 * too: nothing delivered, nothing charged, the cost of both images kept in blockedRenders. The AI services, the
 * consent gate, the policy check, C2PA, KMS and storage are stand-ins; Firestore is in memory; the payment
 * transaction, the ledger, the label and the step log are the real code.
 */
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewResult } from "./ai/types";
import { store } from "./testing/memoryFirestore";

vi.mock("./firebase-admin", async () => {
  const m = await import("./testing/memoryFirestore");
  return { firestore: () => m.fakeDb, adminAuth: () => ({}) };
});
vi.mock("firebase-admin/firestore", async () => ({ FieldValue: (await import("./testing/memoryFirestore")).fieldValue }));
const objects = new Set<string>();
vi.mock("./storage", () => ({ putObject: async (p: string) => void objects.add(p), deleteObject: async (p: string) => void objects.delete(p), getObject: async () => null, signedUrl: async () => "" }));
vi.mock("./receipts", () => ({ signPayload: async () => ({ payload: {}, canonical: "", signature: "sig", keyVersion: "1", alg: "EC_SIGN_P256_SHA256" }) }));
vi.mock("./c2pa", () => ({ embedManifest: async (b: Uint8Array) => b }));
vi.mock("./vault", () => ({ openFrames: async () => [new Uint8Array([1, 2, 3])] }));
vi.mock("./facematch", () => ({ referenceEmbeddings: async () => [new Float32Array(4).fill(0.5)] }));
vi.mock("./filter", () => ({ checkPrompt: async () => ({ allowed: true, reasons: [], layers: [{ name: "test policy", ran: true }] }) }));
vi.mock("./consentGate", () => ({
  runConsentGate: async () => ({ passed: true, code: null, explanation: "One person, the creator.", short: "1 person, face matches (0.90)", people: 1, faces: 1, similarity: 0.9, threshold: 0.35, segmenter: "test", figure: null, metrics: [] }),
}));

// The models: one image per call ($0.01), the reviewer's verdicts in turn, an alternative shot ($0.003).
const spark = (costUsd: number) => ({ provider: "meta" as const, model: "muse-spark-test", latencyMs: 5, cost: { costUsd, estimate: true as const, basis: "test" } });
const verdicts: ReviewResult[] = [];
const generated = vi.fn();
vi.mock("./ai", () => ({
  aiProvider: () => "google",
  assertAspect: () => undefined,
  ai: () => ({
    provider: "google",
    imageGenerator: { provider: "google", edit: generated, multiImage: generated },
    brandAgent: { label: "test" },
    reviewer: { review: async () => verdicts.shift()! },
  }),
}));
vi.mock("./ai/alternative", () => ({
  planWithAlternatives: async () => Promise.reject(new Error("not used: no plan step with this provider")),
  proposeAlternative: async () => ({
    decision: { shotId: "brief-alt", allowed: true, code: null, explanation: "Allowed." },
    shot: { id: "brief-alt", prompt: "The person holding the cup, a plain studio backdrop", aspect: "1:1", rationale: "Keeps the product, drops what the reviewer blocked." },
    metrics: spark(0.003),
  }),
}));

const { renderImage } = await import("./render-image");

const block: ReviewResult = { verdict: "block", findings: [{ kind: "licence", text: "The image shows a banned use (adult)." }], reasons: ["The image shows a banned use (adult)."], metrics: spark(0.004) };
const pass: ReviewResult = { verdict: "pass", findings: [], reasons: ["Matches the shot and the licence."], metrics: spark(0.004) };
const now = Date.now();
const licence = { id: "L1", requestId: "R1", brandId: "brand", brandName: "Brew & Co.", creatorId: "creator", creatorName: "Maya Okafor", use: "advertising", start: now - 86_400_000, end: now + 7 * 86_400_000, maxRenders: 4, renderCount: 0, pricePerImage: 200, createdAt: now - 86_400_000 };
const blocked = (id: string) => store.get(`blockedRenders/${id}`) as { blockedBy: string; charged: number; cost: { costUsd: number; calls: { step: string; costUsd: number | null }[] } } | undefined;
const renderLog = () => [...store.entries()].find(([k]) => k.startsWith("renderLogs/"))![1] as { id: string; status: string; steps: { step: string; status: string; attempt?: number }[] };

beforeEach(async () => {
  store.clear();
  objects.clear();
  verdicts.length = 0;
  const png = new Uint8Array(await sharp({ create: { width: 64, height: 64, channels: 3, background: "#8a6a4f" } }).png().toBuffer());
  generated.mockReset();
  generated.mockImplementation(async () => ({ bytes: png, mime: "image/png", metrics: { provider: "meta", model: "image-test", latencyMs: 5, cost: { costUsd: 0.01, estimate: true, basis: "test" } } }));
  store.set("licences/L1", { ...licence });
  store.set("creators/creator", { uid: "creator", displayName: "Maya Okafor", status: "live" });
  store.set("credits/brand", { uid: "brand", balance: 2000 });
  store.set("credits/creator", { uid: "creator", balance: 0 });
});

describe("a reviewer's block", () => {
  it("(a) gets one automatic alternative, which passes: delivered and charged once, both images' cost on the render", async () => {
    verdicts.push(block, pass);
    const out = await renderImage("brand", "L1", "The person holding the cup", "1:1");
    expect(generated).toHaveBeenCalledTimes(2);
    expect(store.get("credits/brand")!.balance).toBe(1800);
    expect(store.get("licences/L1")!.renderCount).toBe(1);
    expect(store.has(`renders/${out.renderId}`)).toBe(true);
    expect(blocked(out.renderId)).toBeUndefined();
    const cost = (store.get(`renders/${out.renderId}`) as { cost: { costUsd: number; calls: { step: string }[] } }).cost;
    expect(cost.calls.filter((c) => c.step === "generate")).toHaveLength(2);
    expect(cost.costUsd).toBeCloseTo(0.01 * 2 + 0.004 * 2 + 0.003, 6);
    const log = renderLog();
    expect(log.status).toBe("delivered");
    expect(log.steps.find((s) => s.step === "review" && (s.attempt ?? 1) === 1)?.status).toBe("blocked");
    expect(log.steps.find((s) => s.step === "alternative")).toMatchObject({ status: "ok", attempt: 2 });
    expect(log.steps.find((s) => s.step === "review" && s.attempt === 2)?.status).toBe("ok");
  });

  it("(b) the alternative is blocked too: nothing delivered, nothing charged, both images' cost kept in blockedRenders", async () => {
    verdicts.push(block, block);
    await expect(renderImage("brand", "L1", "The person holding the cup", "1:1")).rejects.toMatchObject({ status: 422, code: "REVIEW_BLOCKED" });
    expect(generated).toHaveBeenCalledTimes(2);
    expect(store.get("credits/brand")!.balance).toBe(2000);
    expect(store.get("credits/creator")!.balance).toBe(0);
    expect(store.get("licences/L1")!.renderCount).toBe(0);
    expect([...store.keys()].some((k) => k.startsWith("renders/") || k.startsWith("receipts/") || k.startsWith("ledger/"))).toBe(false);
    expect(objects.size).toBe(0);
    const id = renderLog().id;
    const b = blocked(id)!;
    expect(b).toMatchObject({ blockedBy: "review", charged: 0 });
    expect(b.cost.calls.filter((c) => c.step === "generate")).toHaveLength(2);
    expect(b.cost.costUsd).toBeCloseTo(0.01 * 2 + 0.004 * 2 + 0.003, 6);
    expect(renderLog().status).toBe("blocked");
  });
});
