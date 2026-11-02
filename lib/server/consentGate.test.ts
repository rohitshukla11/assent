/** The consent gate's decision for every reason code, and fail-closed on errors. */
import { existsSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { consentVerdict, runConsentGate } from "./consentGate";
import type { PersonSegmenter } from "./ai/types";

const person = { x: 0.2, y: 0.1, w: 0.6, h: 0.9 };
const face = { x: 0.4, y: 0.15, w: 0.2, h: 0.25, score: 0.98 };
const ok = { faces: [face], fullyVisible: true, similarity: 0.55, threshold: 0.35 };
const one = { count: 1, boxes: [person] };

describe("consent verdict", () => {
  it("passes one person whose visible face matches the creator", () => {
    expect(consentVerdict(one, ok)).toMatchObject({ code: null, explanation: expect.stringMatching(/matches the creator/) });
  });
  it("NO_PERSON when nobody is in the image", () => {
    expect(consentVerdict({ count: 0, boxes: [] }, { ...ok, faces: [] }).code).toBe("NO_PERSON");
  });
  it("MULTIPLE_PEOPLE when the segmenter finds two people", () => {
    expect(consentVerdict({ count: 2, boxes: [person, person] }, ok).code).toBe("MULTIPLE_PEOPLE");
  });
  it("MULTIPLE_PEOPLE when a second clear face appears that the segmenter missed", () => {
    expect(consentVerdict(one, { ...ok, faces: [face, { ...face, x: 0.05, score: 0.95 }] }).code).toBe("MULTIPLE_PEOPLE");
  });
  it("FACE_NOT_VISIBLE with no face, a face outside the person, or a face cut by the edge", () => {
    expect(consentVerdict(one, { ...ok, faces: [] }).code).toBe("FACE_NOT_VISIBLE");
    expect(consentVerdict(one, { ...ok, faces: [{ ...face, x: 0.85, w: 0.1 }] }).code).toBe("FACE_NOT_VISIBLE");
    expect(consentVerdict(one, { ...ok, fullyVisible: false }).code).toBe("FACE_NOT_VISIBLE");
  });
  it("FACE_MISMATCH below the threshold, or with no similarity", () => {
    expect(consentVerdict(one, { ...ok, similarity: 0.2 })).toMatchObject({ code: "FACE_MISMATCH", explanation: expect.stringMatching(/0\.20, needs 0\.35/) });
    expect(consentVerdict(one, { ...ok, similarity: null }).code).toBe("FACE_MISMATCH");
  });
});

describe("consent gate fails closed", () => {
  const jpeg = async () => ({ bytes: new Uint8Array(await sharp({ create: { width: 64, height: 64, channels: 3, background: "#888" } }).jpeg().toBuffer()), mime: "image/jpeg" as const });
  it("GATE_ERROR when the segmenter fails", async () => {
    const broken: PersonSegmenter = { detectPeople: async () => Promise.reject(new Error("HTTP 503")) };
    const r = await runConsentGate(await jpeg(), [new Float32Array([1])], broken);
    expect(r).toMatchObject({ passed: false, code: "GATE_ERROR" });
    expect(r.explanation).toMatch(/HTTP 503/);
  });
  it("GATE_ERROR without reference faces for the creator", async () => {
    const r = await runConsentGate(await jpeg(), []);
    expect(r).toMatchObject({ passed: false, code: "GATE_ERROR" });
  });
});

describe.skipIf(!existsSync(".models/auraface_glintr100.onnx"))("consent gate with the local models", () => {
  it("NO_PERSON on an image without anyone in it", async () => {
    const blank = new Uint8Array(await sharp({ create: { width: 512, height: 512, channels: 3, background: "#c9a27e" } }).jpeg().toBuffer());
    // The local face counter, named: the default (SAM with AI_PROVIDER=meta) would call Meta.
    const { localFaceSegmenter } = await import("./ai/local/segmenter");
    const r = await runConsentGate({ bytes: blank, mime: "image/jpeg" }, [new Float32Array(512).fill(1 / Math.sqrt(512))], localFaceSegmenter);
    expect(r).toMatchObject({ passed: false, code: "NO_PERSON", people: 0 });
  });
});

describe("consent figure (numbers and labels only)", () => {
  const W = { width: 1024, height: 1024, threshold: 0.35 };
  // Maya stands right of centre; a stranger on the left.
  const right = { x: 0.5, y: 0.1, w: 0.4, h: 0.9 };
  const left = { x: 0.0, y: 0.1, w: 0.3, h: 0.9 };
  const maya = { x: 0.6, y: 0.15, w: 0.2, h: 0.25, score: 0.98, similarity: 0.951, fullyVisible: true };
  const stranger = { x: 0.05, y: 0.2, w: 0.15, h: 0.2, score: 0.95, similarity: 0.12, fullyVisible: true };
  const figure = async (...a: Parameters<typeof import("./consentGate").consentFigure>) => (await import("./consentGate")).consentFigure(...a);

  it("a pass: the creator alone, green, labelled with her first name and match", async () => {
    const f = await figure({ boxes: [right] }, { ...W, faces: [maya] }, { code: null, explanation: "ok" }, "Maya Okafor");
    expect(f).toMatchObject({ width: 1024, height: 1024, verdict: { passed: true, code: null } });
    expect(f.people).toEqual([{ box: right, role: "creator", similarity: 0.951, label: "1 · Maya · 0.95" }]);
  });
  it("numbers people left to right; in a block the creator stays the creator and the other person is not licensed", async () => {
    const f = await figure({ boxes: [right, left] }, { ...W, faces: [maya, stranger] }, { code: "MULTIPLE_PEOPLE", explanation: "2 people" }, "Maya Okafor");
    expect(f.people.map((p) => [p.role, p.label])).toEqual([["not licensed", "1 · not licensed · 0.12"], ["creator", "2 · Maya · 0.95"]]);
    expect(f.verdict).toMatchObject({ passed: false, code: "MULTIPLE_PEOPLE" });
  });
  it("two people who both match: the better match is the creator, the other an extra person", async () => {
    const twin = { ...stranger, similarity: 0.9 };
    const f = await figure({ boxes: [right, left] }, { ...W, faces: [maya, twin] }, { code: "MULTIPLE_PEOPLE", explanation: "" }, "Maya Okafor");
    expect(f.people.map((p) => [p.role, p.label])).toEqual([["extra person", "1 · extra person · 0.90"], ["creator", "2 · Maya · 0.95"]]);
  });
  it("without a creator's name the label says \"the creator\"", async () => {
    const f = await figure({ boxes: [right] }, { ...W, faces: [maya] }, { code: null, explanation: "" }, "");
    expect(f.people[0].label).toBe("1 · the creator · 0.95");
  });
  it("a wrong face, no person, a face cut off", async () => {
    expect((await figure({ boxes: [right] }, { ...W, faces: [{ ...maya, similarity: 0.2 }] }, { code: "FACE_MISMATCH", explanation: "" }, "Maya")).people[0]).toMatchObject({ role: "not licensed", label: "1 · not licensed · 0.20" });
    expect((await figure({ boxes: [] }, { ...W, faces: [] }, { code: "NO_PERSON", explanation: "" }, "Maya")).people).toEqual([]);
    const cut = await figure({ boxes: [right] }, { ...W, faces: [{ ...maya, fullyVisible: false }] }, { code: "FACE_NOT_VISIBLE", explanation: "" }, "Maya");
    expect(cut.people[0]).toMatchObject({ role: "face not visible", label: "1 · face not visible" });
  });
  it("a clear face outside every person is shown on its own, in left-to-right order", async () => {
    const f = await figure({ boxes: [right] }, { ...W, faces: [maya, stranger] }, { code: "MULTIPLE_PEOPLE", explanation: "" }, "Maya");
    expect(f.people.map((p) => [p.role, p.label])).toEqual([["face only", "1 · face outside any person · 0.12"], ["creator", "2 · Maya · 0.95"]]);
  });
});

describe("the step line's short text", () => {
  it("is a few words; the full explanation is kept for the error card", async () => {
    const { consentVerdict } = await import("./consentGate");
    const face = { faces: [{ x: 0.4, y: 0.15, w: 0.2, h: 0.25, score: 0.98 }], fullyVisible: true, similarity: 0.9, threshold: 0.35 };
    expect(consentVerdict({ count: 2, boxes: [person, person] }, face)).toMatchObject({ code: "MULTIPLE_PEOPLE", short: "2 people found", explanation: expect.stringContaining("may show only the creator") });
    expect(consentVerdict({ count: 0, boxes: [] }, face).short).toBe("No person found");
    expect(consentVerdict({ count: 1, boxes: [person] }, { ...face, similarity: 0.2 }).short).toBe("Face doesn't match (0.20, needs 0.35)");
    expect(consentVerdict({ count: 1, boxes: [person] }, face).short).toBe("1 person, face matches (0.90)");
  });
});
