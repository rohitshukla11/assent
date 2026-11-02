/**
 * Wording for the Verify page, kept out of the component so it can be tested: the content credential
 * line says "not checked" when the render was looked up by its receipt (no file, so nothing was read), and
 * "none" only when an uploaded file really has no credential.
 */
export type ManifestView = { checked?: boolean; present: boolean; signatureValid?: boolean; trustedSigner?: boolean; matchesReceipt?: boolean };

export function c2paLine(m: ManifestView): string {
  if (m.checked === false) return "not checked (looked up by receipt; upload the file to check its credential)";
  if (!m.present) return "none";
  return `${m.signatureValid ? "intact" : "broken"}${m.trustedSigner ? "" : ", test certificate"}${m.matchesReceipt ? ", matches the receipt" : ""}`;
}
