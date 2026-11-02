import { describe, expect, it } from "vitest";
import { utcDateTime, utcDay } from "./dates";

describe("dates", () => {
  // 2026-11-01 23:30 UTC is 2 Nov in India: the app shows the UTC date and says so.
  const t = Date.UTC(2026, 10, 1, 23, 30);
  it("shows the UTC day, labelled", () => expect(utcDay(t)).toBe("1 Nov 2026 (UTC)"));
  it("shows the UTC date and time, labelled, on a 24-hour clock", () => {
    expect(utcDateTime(t)).toBe("1 Nov 2026, 23:30 (UTC)");
    expect(utcDateTime(Date.UTC(2026, 10, 1, 0, 5))).toBe("1 Nov 2026, 00:05 (UTC)");
  });
});
