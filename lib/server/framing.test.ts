/** Label placement: geometry only, no models needed. */
import { describe, expect, it } from "vitest";
import { labelSpot } from "./framing";

describe("label placement", () => {
  const label = { w: 300, h: 34 };
  it("goes bottom-left when that corner is clear", () => {
    expect(labelSpot(1280, 720, label, [{ x: 800, y: 150, w: 200, h: 260 }]).corner).toBe("bottom-left");
  });
  it("moves away from a face on the left, and from the area below it", () => {
    expect(labelSpot(1280, 720, label, [{ x: 80, y: 150, w: 200, h: 260 }]).corner).toBe("bottom-right");
  });
  it("never sits over a face", () => {
    const face = { x: 0, y: 0, w: 1280, h: 300 };
    const s = labelSpot(1280, 720, label, [face]);
    expect(s.y).toBeGreaterThanOrEqual(300);
  });
});
