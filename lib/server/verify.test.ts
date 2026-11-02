/**
 * Verify, with Firestore in memory and the KMS signature check and C2PA reader as stand-ins: what the result
 * says about the content credential (not checked by receipt), SynthID (Gemini renders only) and the creator's
 * verification (synthetic demo creators are pre-approved).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "./testing/memoryFirestore";

vi.mock("./firebase-admin", async () => {
  const m = await import("./testing/memoryFirestore");
  return { firestore: () => m.fakeDb, adminAuth: () => ({}) };
});
vi.mock("./receipts", () => ({ checkReceipt: async () => true }));
const manifest = vi.fn();
vi.mock("./c2pa", () => ({ readManifest: (...a: unknown[]) => manifest(...a) }));

const { verifyFile, verifyHash, NOTES } = await import("./verify");

const SHA = "a".repeat(64);
const later = Date.now() + 30 * 86400_000;
function seed(opts: { model: string; demo: boolean }) {
  store.clear();
  store.set(`receipts/${SHA}`, { payload: { licenceId: "L1", createdAt: Date.now(), model: opts.model, renderType: "image" }, signature: "sig", keyVersion: "1" });
  store.set("licences/L1", { id: "L1", use: "advertising", creatorId: "C1", brandName: "Judge Brand", start: Date.now() - 1000, end: later, renderCount: 1, maxRenders: 3 });
  store.set("creators/C1", { uid: "C1", displayName: opts.demo ? "Maya Okafor" : "Real Creator", status: "live", listed: true, demo: opts.demo });
}

describe("Verify: what the result says", () => {
  beforeEach(() => manifest.mockReset());

  it("by receipt only, the content credential is marked not checked (not 'none')", async () => {
    seed({ model: "muse-image-1.0", demo: true });
    const r = await verifyHash(SHA);
    expect(r.verdict).toBe("Licensed");
    expect(r.manifest).toEqual({ checked: false, present: false });
    expect(manifest).not.toHaveBeenCalled();
  });

  it("an uploaded file without a credential is checked and has none", async () => {
    seed({ model: "muse-image-1.0", demo: false });
    manifest.mockResolvedValue({ present: false });
    const r = await verifyFile(new Uint8Array([1, 2, 3]), "image/jpeg");
    expect(r.manifest).toEqual({ checked: true, present: false });
  });

  it("mentions SynthID only for a render made by Gemini", async () => {
    seed({ model: "muse-image-1.0", demo: false });
    expect((await verifyHash(SHA)).notes).not.toContain(NOTES.synthId);
    seed({ model: "gemini-nano-banana-2.1", demo: false });
    expect((await verifyHash(SHA)).notes).toContain(NOTES.synthId);
    store.clear();
    const unknown = await verifyHash(SHA);
    expect(unknown.verdict).toBe("Unknown");
    expect(unknown.notes).not.toContain(NOTES.synthId);
  });

  it("a synthetic demo creator is pre-approved instead of YouTube- and live-face-verified", async () => {
    seed({ model: "muse-image-1.0", demo: true });
    const demo = await verifyHash(SHA);
    expect(demo.notes).toContain(NOTES.demoCreator);
    expect(demo.notes).not.toContain(NOTES.realCreator);
    expect(demo.headline).toMatch(/\d{1,2} [A-Z][a-z]{2} \d{4} \(UTC\)/);
    // One line about the synthetic creator, not two.
    expect(demo.notes.filter((n) => /synthetic/i.test(n))).toEqual(["Synthetic demo creator: a generated face, not a real person, pre-approved; the YouTube and live-face checks apply to real creators."]);
    expect(demo.notes.join(" ")).not.toMatch(/YouTube account ownership/);
    seed({ model: "muse-image-1.0", demo: false });
    const real = await verifyHash(SHA);
    expect(real.notes).toContain(NOTES.realCreator);
    expect(real.notes).not.toContain(NOTES.demoCreator);
  });
});
