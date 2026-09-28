import { redirect } from "next/navigation";
import { Backdrop } from "@/components/backdrop";
import { HeroHeader } from "@/components/hero-header";
import { RaceTrack } from "@/components/track/race-track";
import { getTeamStatus, hasValidSession } from "@/lib/auth";
import { LoginForm, SetupForm } from "./auth-forms";

export default async function LoginPage() {
  if (await hasValidSession()) redirect("/dashboard");
  const status = await getTeamStatus();

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
      <Backdrop />
      <RaceTrack />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-16">
        <HeroHeader />

        <section
          className="animate-rise-in mx-auto mt-10 w-full max-w-md rounded-2xl bg-linear-to-br from-orange/60 via-white/10 to-maroon-bright/60 p-px shadow-2xl shadow-black/60"
          style={{ animationDelay: "650ms" }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-zinc-950/75 p-6 backdrop-blur-md sm:p-8">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
              <div className="animate-scan h-px w-1/2 bg-linear-to-r from-transparent via-orange to-transparent" />
            </div>
            {status === "ready" ? <LoginForm /> : <SetupForm />}
          </div>
        </section>

        <p
          className="animate-rise-in mt-8 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-500 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]"
          style={{ animationDelay: "800ms" }}
        >
          Authorized team members only
        </p>
      </div>
    </main>
  );
}
