/** The shared face checks: "fully visible" and the best match against the creator's references. */
import { describe, expect, it } from "vitest";
import { bestSimilarity, consentThreshold, fullyVisible } from "./facecheck";

const unit = (v: number[]) => {
  const n = Math.hypot(...v);
  return new Float32Array(v.map((x) => x / n));
};

describe("face checks", () => {
  it("treats a face box past the frame edge, or without headroom, as not fully visible", () => {
    const lm: [number, number][] = [[600, 300], [680, 300], [640, 340], [610, 380], [670, 380]];
    expect(fullyVisible({ box: [560, 220, 160, 220], landmarks: lm }, 1280, 720)).toBe(true);
    expect(fullyVisible({ box: [1180, 220, 160, 220], landmarks: lm }, 1280, 720)).toBe(false);
    expect(fullyVisible({ box: [560, 5, 160, 220], landmarks: lm }, 1280, 720)).toBe(false);
  });

  it("takes the best similarity over the references", () => {
    const e = unit([1, 0, 0]);
    expect(bestSimilarity(e, [unit([0, 1, 0]), unit([1, 1, 0])])).toBeCloseTo(Math.SQRT1_2, 5);
  });

  it("has no similarity without a face or without references", () => {
    expect(bestSimilarity(null, [unit([1, 0, 0])])).toBeNull();
    expect(bestSimilarity(unit([1, 0, 0]), [])).toBeNull();
  });

  it("defaults the threshold to 0.35", () => {
    expect(consentThreshold()).toBe(0.35);
  });
});
