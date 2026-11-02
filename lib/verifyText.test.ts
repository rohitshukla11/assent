import { describe, expect, it } from "vitest";
import { c2paLine } from "./verifyText";

describe("Verify page: the content credential line", () => {
  it("says 'not checked' when the render was looked up by its receipt, never 'none'", () => {
    expect(c2paLine({ checked: false, present: false })).toBe("not checked (looked up by receipt; upload the file to check its credential)");
  });

  it("says 'none' only when an uploaded file really has no credential", () => {
    expect(c2paLine({ checked: true, present: false })).toBe("none");
  });

  it("describes a credential that was read", () => {
    expect(c2paLine({ checked: true, present: true, signatureValid: true, trustedSigner: false, matchesReceipt: true })).toBe("intact, test certificate, matches the receipt");
    expect(c2paLine({ checked: true, present: true, signatureValid: false, trustedSigner: true })).toBe("broken");
  });
});
