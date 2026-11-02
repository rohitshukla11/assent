/**
 * The adapters against the real response shapes saved by the first paid calls (2026-10-29):
 * eval/fixtures/muse-image-response.json, sam-response.txt and spark-plan-response.json. Long base64,
 * mask payloads and encrypted reasoning were cut when saved; each test puts a valid stand-in back
 * where the adapter needs one, so the real structure around it is what is checked.
 */
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { estimateCost } from "../pricing";
import { museImageResult, type MuseImageResponse } from "./image";
import { readPeople } from "./sam";
import { encodeOneBit } from "./samFormat";
import { PLAN_SCHEMA, sparkAnswer } from "./spark";

const json = (f: string) => JSON.parse(readFileSync(`eval/fixtures/${f}`, "utf8"));

describe("Muse Image: the real response", () => {
  const saved = json("muse-image-response.json");
  it("is reasoning, an empty message, then image_generation_call with the image in result", () => {
    expect(saved.response.output.map((o: { type: string }) => o.type)).toEqual(["reasoning", "message", "image_generation_call"]);
    expect(saved.response).toMatchObject({ status: "completed", model: "muse-image-1.0" });
    expect(saved.request).toMatchObject({ store: false, stream: false });
  });
  it("gives the adapter its PNG", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).png().toBuffer();
    const res: MuseImageResponse = structuredClone(saved.response);
    res.output!.find((o) => o.type === "image_generation_call")!.result = png.toString("base64");
    const out = await museImageResult(res);
    expect(out.mime).toBe("image/png");
    expect(Buffer.from(out.bytes).equals(png)).toBe(true);
  });
  it("is priced per image; its token usage isn't added", () => {
    expect(estimateCost("meta", "muse-image-1.0", saved.response.usage, 1)?.costUsd).toBe(0.01);
  });
});

describe("SAM 3.1: the real stream", () => {
  it("reads one person on the 1600×1600 image, mask decoded, with store: false accepted", async () => {
    const raw = readFileSync("eval/fixtures/sam-response.txt", "utf8");
    expect(raw).toMatch(/"store":false/);
    const [H, W] = [1024, 802];
    const raster = new Uint8Array(W * H);
    for (let y = 100; y < 900; y++) for (let x = 150; x < 650; x++) raster[y * W + x] = 1;
    // encodeOneBit returns the whole one_bit payload, its "!" marker included.
    const filled = raw.replace(/(data=1024,802,)![^|"\\]*…\(cut\)/g, `$1${encodeOneBit(raster, W, H)}`);
    expect(filled).not.toMatch(/…\(cut\)/);
    const image = { bytes: new Uint8Array(await sharp({ create: { width: 1600, height: 1600, channels: 3, background: "#fff" } }).png().toBuffer()), mime: "image/png" as const };
    const p = await readPeople(filled, image);
    expect(p.count).toBe(1);
    expect(p.boxes[0]).toMatchObject({ x: 60 / 1600, y: 107 / 1600 });
    expect(p.masks[0]).toMatchObject({ width: W, height: H });
    expect(p.masks[0].bits.reduce((s, b) => s + b, 0)).toBe(800 * 500);
  });
});

describe("Muse Spark: the real planShots response", () => {
  const saved = json("spark-plan-response.json");
  it("is reasoning then a message whose output_text matches our schema", () => {
    expect(saved.response.output.map((o: { type: string }) => o.type)).toEqual(["reasoning", "message"]);
    const answer = sparkAnswer<{ refused: boolean; shots: unknown[] }>(saved.response, PLAN_SCHEMA, { provider: "meta", model: "muse-spark-1.3", latencyMs: 0, cost: null });
    expect(answer.refused).toBe(false);
    expect(answer.shots).toHaveLength(1);
    expect(saved.response).toMatchObject({ store: false, text: { format: { type: "json_schema", name: "shot_plan", strict: true } } });
  });
  it("counts reasoning tokens inside output_tokens, so the estimate adds no extra", () => {
    const u = saved.response.usage;
    expect(u.output_tokens_details.reasoning_tokens).toBeLessThanOrEqual(u.output_tokens);
    expect(u.total_tokens).toBe(u.input_tokens + u.output_tokens);
    const expected = ((u.input_tokens - u.input_tokens_details.cached_tokens) * 1.25 + u.input_tokens_details.cached_tokens * 0.15 + u.output_tokens * 4.25) / 1e6;
    expect(estimateCost("meta", "muse-spark-1.3", u)?.costUsd).toBeCloseTo(expected, 6);
  });
});
