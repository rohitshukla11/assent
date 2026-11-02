import { describe, expect, it } from "vitest";
import { startView } from "./startView";

const me = (role: "creator" | "brand" | null, status: "draft" | "live" | null = null) => ({ user: { role }, creator: status ? { status } : null });

describe("startView", () => {
  it("never shows the choice while the account is loading (a signed-in judge on a cold start)", () => {
    expect(startView({ loading: true, signedIn: true, me: null })).toEqual({ kind: "loading" });
  });
  it("sends a brand, such as the judge brand, to the dashboard", () => {
    expect(startView({ loading: false, signedIn: true, me: me("brand") })).toEqual({ kind: "redirect", to: "/dashboard" });
  });
  it("sends a creator to onboarding until they are live, then to the dashboard", () => {
    expect(startView({ loading: false, signedIn: true, me: me("creator", "draft") })).toEqual({ kind: "redirect", to: "/creator/onboard" });
    expect(startView({ loading: false, signedIn: true, me: me("creator", "live") })).toEqual({ kind: "redirect", to: "/dashboard" });
  });
  it("shows the choice only to a signed-in account without a role", () => {
    expect(startView({ loading: false, signedIn: true, me: me(null) })).toEqual({ kind: "choose" });
  });
  it("asks to sign in when signed out", () => {
    expect(startView({ loading: false, signedIn: false, me: null })).toEqual({ kind: "signin" });
  });
  it("reports a failed account load instead of showing the choice", () => {
    expect(startView({ loading: false, signedIn: true, me: null })).toEqual({ kind: "error" });
  });
});
