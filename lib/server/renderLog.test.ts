/** The render step log: ordered entries, refusals recorded, and never any image data. */
import { describe, expect, it } from "vitest";
import { HttpError } from "./http";
import { RenderLog, sanitise, type RenderLogDoc } from "./renderLog";

const memory = () => {
  const docs = new Map<string, Partial<RenderLogDoc>>();
  return { docs, write: async (id: string, d: Partial<RenderLogDoc>) => void docs.set(id, { ...docs.get(id), ...d }) };
};

describe("render step log", () => {
  it("records steps in order, with timings, and finishes with an outcome", async () => {
    const m = memory();
    const log = new RenderLog({ id: "r1", brandId: "b", licenceId: "L", provider: "google" }, m.write);
    await log.step("licence", async () => 1, () => ({ status: "ok", detail: "Licence active" }));
    log.add({ step: "generate", status: "ok", ms: 1200, detail: "Image generated", provider: "meta", model: "muse-image-1.0", costUsd: 0.01, settings: { reasoning_strength: "high" } });
    log.finish("delivered", "Delivered and paid");
    await log.flush();
    const d = m.docs.get("r1")!;
    expect(d.steps!.map((s) => [s.step, s.status])).toEqual([["licence", "ok"], ["generate", "ok"]]);
    expect(d.steps![1]).toMatchObject({ ms: 1200, costUsd: 0.01, settings: { reasoning_strength: "high" } });
    expect(d).toMatchObject({ status: "delivered", outcome: "Delivered and paid" });
  });

  it("records a refusal with its code, and rethrows it", async () => {
    const m = memory();
    const log = new RenderLog({ id: "r2", brandId: "b", licenceId: "L", provider: "google" }, m.write);
    const err = Object.assign(new HttpError(409, "render refused: the licence is revoked"), { code: "LICENCE_REVOKED" });
    await expect(log.step("licence", async () => Promise.reject(err), () => ({ status: "ok", detail: "" }))).rejects.toBe(err);
    await log.flush();
    expect(m.docs.get("r2")!.steps![0]).toMatchObject({ step: "licence", status: "refused", code: "LICENCE_REVOKED", detail: "render refused: the licence is revoked" });
  });

  it("records an unexpected failure as an error", async () => {
    const m = memory();
    const log = new RenderLog({ id: "r3", brandId: "b", licenceId: "L", provider: "google" }, m.write);
    await expect(log.step("generate", async () => Promise.reject(new Error("socket hang up")), () => ({ status: "ok", detail: "" }))).rejects.toThrow();
    await log.flush();
    expect(m.docs.get("r3")!.steps![0].status).toBe("error");
  });

  it("never stores image data, and keeps text short", () => {
    const b64 = "iVBORw0KGgo".padEnd(4000, "A");
    expect(sanitise({ step: "generate", status: "ok", at: 1, ms: 1, detail: `data:image/png;base64,${b64}` }).detail).toBe("[image data removed]");
    expect(sanitise({ step: "generate", status: "ok", at: 1, ms: 1, detail: b64 }).detail).toBe("[image data removed]");
    expect(sanitise({ step: "policy", status: "ok", at: 1, ms: 1, detail: "x ".repeat(600) }).detail.length).toBe(500);
  });

  it("a failed write never fails the render", async () => {
    const log = new RenderLog({ id: "r4", brandId: "b", licenceId: "L", provider: "google" }, async () => Promise.reject(new Error("firestore down")));
    const original = console.error;
    console.error = () => {};
    try {
      log.add({ step: "licence", status: "ok", ms: 1, detail: "ok" });
      await expect(log.flush()).resolves.toBeUndefined();
    } finally {
      console.error = original;
    }
  });
});

describe("the consent figure in the log", () => {
  it("keeps only numbers and short labels", () => {
    const e = sanitise({
      step: "consent", status: "blocked", at: 1, ms: 1, detail: "x",
      figure: { width: 1024.4, height: 768, verdict: { passed: false, code: "MULTIPLE_PEOPLE", text: "2 people were found" }, people: [{ box: { x: 0.123456, y: 0.2, w: 0.3, h: 0.4 }, role: "not licensed", similarity: 0.1234, label: `Person 2: ${"x".repeat(200)}` }] },
    });
    expect(e.figure).toMatchObject({ width: 1024, height: 768, verdict: { passed: false, code: "MULTIPLE_PEOPLE" } });
    expect(e.figure!.people[0].box.x).toBe(0.123);
    expect(e.figure!.people[0].similarity).toBe(0.123);
    expect(e.figure!.people[0].label.length).toBeLessThanOrEqual(80);
    expect(JSON.stringify(e.figure)).not.toMatch(/data:|base64/);
  });
});
