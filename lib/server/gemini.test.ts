/** A Gemini call that doesn't answer in time is a 504 with the TIMEOUT reason code, and isn't retried. */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./gcp", () => ({ accessToken: async () => "token", requireProject: () => "p", gcp: { project: () => "p" } }));
const { generateContent } = await import("./gemini");

afterEach(() => vi.unstubAllGlobals());

describe("Gemini timeouts", () => {
  it("become 504 TIMEOUT, with no retry", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateContent("gemini-test", {}, 50)).rejects.toMatchObject({ httpStatus: 504, status: 504, code: "TIMEOUT", message: "Gemini gemini-test: no answer in 0 s" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
