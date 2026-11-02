"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppPage, Card, pillClass } from "@/components/ds";
import { useAuth } from "@/components/auth/AuthProvider";
import { JudgeSignIn } from "@/components/auth/JudgeSignIn";
import { api, reason, signIn } from "@/lib/client/firebase";
import { startView } from "@/lib/startView";

/** After sign-in: choose to be a creator or a brand (you can do both later). */
export default function StartPage() {
  const { user, me, loading, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const view = startView({ loading, signedIn: !!user, me });
  const to = view.kind === "redirect" ? view.to : null;
  useEffect(() => {
    if (to) router.replace(to);
  }, [to, router]);

  async function choose(role: "creator" | "brand") {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/me", { method: "POST", body: JSON.stringify({ role }) });
      await refresh();
      router.push(role === "creator" ? "/creator/onboard" : "/dashboard");
    } catch (e) {
      setErr(reason(e));
    } finally {
      setBusy(false);
    }
  }

  if (view.kind === "loading" || view.kind === "redirect")
    return (
      <AppPage title={view.kind === "loading" ? "Signing you in…" : "Opening your dashboard…"} description="This can take a few seconds when the server has been idle.">
        {null}
      </AppPage>
    );
  if (view.kind === "error")
    return (
      <AppPage title="Couldn't load your account" description="You're signed in, but the server didn't answer. Try again.">
        <button type="button" onClick={() => refresh().catch((e) => setErr(reason(e)))} className={pillClass("lime", "self-start")}>
          Try again
        </button>
        {err && <p className="m-0 text-bad">{err}</p>}
      </AppPage>
    );
  if (view.kind === "signin")
    return (
      <AppPage title="Get started" description="Sign in with your Google account to continue.">
        <button type="button" onClick={() => signIn().catch((e) => setErr(reason(e)))} className={pillClass("lime", "self-start")}>
          Sign in with Google
        </button>
        {err && <p className="m-0 text-bad">{err}</p>}
        <JudgeSignIn />
      </AppPage>
    );

  return (
    <AppPage title="How will you use Assent?" description="Pick one to start. You can switch later.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="I'm a creator">
          <p className="m-0 text-[15px] text-grey">Connect your YouTube channel, take a quick live face check, and license your likeness for AI ads. You approve every brand and get paid per render.</p>
          <button type="button" disabled={busy} onClick={() => choose("creator")} className={pillClass("ink", "mt-2 self-start")}>
            Become a creator
          </button>
        </Card>
        <Card title="I'm a brand">
          <p className="m-0 text-[15px] text-grey">Request a licence from a verified creator, then make image ads in minutes, paid per render.</p>
          <button type="button" disabled={busy} onClick={() => choose("brand")} className={pillClass("lime", "mt-2 self-start")}>
            License a face
          </button>
        </Card>
      </div>
      {err && <p className="m-0 text-bad">{err}</p>}
    </AppPage>
  );
}
