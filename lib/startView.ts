/**
 * What /start shows, kept out of the component so it can be tested: the creator-or-brand choice only for a
 * signed-in account that has no role yet. While the account is loading (a cold start can take several
 * seconds) it says so instead; an account with a role goes to its place.
 */
type MeView = { user: { role: "creator" | "brand" | null }; creator: { status: "draft" | "live" } | null };

export type StartView = { kind: "signin" } | { kind: "loading" } | { kind: "error" } | { kind: "redirect"; to: string } | { kind: "choose" };

export function startView(s: { loading: boolean; signedIn: boolean; me: MeView | null }): StartView {
  if (s.loading) return { kind: "loading" };
  if (!s.signedIn) return { kind: "signin" };
  if (!s.me) return { kind: "error" };
  if (s.me.user.role === "creator") return { kind: "redirect", to: s.me.creator?.status === "live" ? "/dashboard" : "/creator/onboard" };
  if (s.me.user.role === "brand") return { kind: "redirect", to: "/dashboard" };
  return { kind: "choose" };
}
