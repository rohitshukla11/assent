/** The visible label: its text scaled to the image (2.5–3% of the shorter side, at least 16 px), never wider than the safe area. */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LABEL_MIN_TEXT_PX, labelRender, labelSize } from "./label";

describe("the visible AI label", () => {
  it("scales its text to 2.5–3% of the image's shorter side", () => {
    const s = labelSize(1600, 1600);
    expect(s.textPx / 1600).toBeGreaterThanOrEqual(0.025);
    expect(s.textPx / 1600).toBeLessThanOrEqual(0.03);
    expect(s).toEqual({ w: 512, h: 153, textPx: 44 });
    expect(labelSize(1536, 1024).textPx).toBe(28); // the shorter side decides
  });

  it("never goes below the minimum text height, and never wider than the image's safe area", () => {
    expect(labelSize(300, 300).textPx).toBe(LABEL_MIN_TEXT_PX);
    const narrow = labelSize(240, 1600);
    expect(narrow.w).toBeLessThanOrEqual(240 - 2 * Math.round(240 * 0.04));
  });

  it("composites it onto a render, keeping the image's size", async () => {
    const src = await sharp(readFileSync("eval/fixtures/maya.jpg")).resize(1600, 1600, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer();
    const out = await labelRender(new Uint8Array(src));
    const m = await sharp(out).metadata();
    expect([m.width, m.height]).toEqual([1600, 1600]);
    if (process.env.LABEL_SAMPLE) writeFileSync(process.env.LABEL_SAMPLE, out);
  });
});
