/** The consent figure's labels: never overlapping, never outside the frame, old stored labels included. */
import { describe, expect, it } from "vitest";
import { creatorName, labelText, layoutFigure, overlaps, type FigureInput } from "./figureLayout";

const W = 480;
const person = (x: number, y: number, w: number, h: number, role: string, similarity: number | null, label = "") => ({ box: { x, y, w, h }, role, similarity, label });

/** Every label inside the frame, and no two overlapping. */
function expectClean(f: FigureInput) {
  const { H, labels } = layoutFigure(f, W);
  for (const l of labels) {
    expect(l.label.x, l.text).toBeGreaterThanOrEqual(0);
    expect(l.label.y, l.text).toBeGreaterThanOrEqual(0);
    expect(l.label.x + l.label.w, l.text).toBeLessThanOrEqual(W);
    expect(l.label.y + l.label.h, l.text).toBeLessThanOrEqual(H);
  }
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) expect(overlaps(labels[i].label, labels[j].label), `${labels[i].text} / ${labels[j].text}`).toBe(false);
  return labels;
}

describe("consent figure labels", () => {
  it("two boxes close together: no overlap; the second is shortened or moved", () => {
    const labels = expectClean({ width: 1024, height: 512, people: [person(0.3, 0.3, 0.08, 0.3, "creator", 0.95, "1 · Maya · 0.95"), person(0.36, 0.3, 0.08, 0.3, "face only", 0.12, "2 · face outside any person · 0.12")] });
    expect(labels[0].text).toBe("1 · Maya · 0.95");
    expect(["2 · outside · 0.12", "2 · face outside any person · 0.12"]).toContain(labels[1].text);
    expect(labels[1].label.y === labels[0].label.y && labels[1].text.length > 20).toBe(false);
  });

  it("boxes at the left, right, top and bottom edges: labels shift inward", () => {
    const labels = expectClean({
      width: 1024,
      height: 1024,
      people: [person(0, 0, 0.1, 0.2, "not licensed", 0.12), person(0.95, 0.4, 0.05, 0.2, "extra person", 0.93), person(0.5, 0.92, 0.1, 0.08, "face not visible", null)],
    });
    expect(labels.map((l) => l.text)).toEqual(["1 · not licensed · 0.12", "2 · face not visible", "3 · extra person · 0.93"]);
    expect(labels[0].label).toMatchObject({ x: 0, y: 0 });
    expect(labels[2].label.x + labels[2].label.w).toBe(W);
  });

  it("many boxes in one place still never overlap", () => {
    const crowd = Array.from({ length: 10 }, (_, i) => person(0.4 + i * 0.005, 0.4, 0.1, 0.2, i ? "not licensed" : "creator", 0.5 - i * 0.04, "1 · Maya · 0.50"));
    expect(expectClean({ width: 1024, height: 512, people: crowd })).toHaveLength(10);
  });

  it("numbers left to right whatever order they were stored in", () => {
    const labels = layoutFigure({ width: 100, height: 100, people: [person(0.6, 0.2, 0.2, 0.5, "creator", 0.9, "1 · Maya · 0.90"), person(0.1, 0.2, 0.2, 0.5, "not licensed", 0.2)] }, W).labels;
    expect(labels.map((l) => l.text)).toEqual(["1 · not licensed · 0.20", "2 · Maya · 0.90"]);
  });

  it("old stored labels render through the same rules", () => {
    expect(creatorName("Person 1: Maya Okafor, match 0.81")).toBe("Maya");
    expect(creatorName("1 · Maya · 0.95")).toBe("Maya");
    expect(creatorName("")).toBe("creator");
    const old = { width: 1024, height: 512, people: [person(0.55, 0.2, 0.2, 0.6, "creator", 0.93, "Person 1: Maya Okafor, match 0.93"), person(0.1, 0.2, 0.2, 0.6, "creator", 0.93, "Person 2: Maya Okafor, match 0.93")] };
    expect(expectClean(old).map((l) => l.text)).toEqual(["1 · Maya · 0.93", "2 · Maya · 0.93"]);
    expect(labelText(3, person(0, 0, 0.1, 0.1, "face only", 0.1234), true)).toBe("3 · outside · 0.12");
  });
});
