import { redirect } from "next/navigation";
import { Backdrop } from "@/components/backdrop";
import { getTeamStatus, hasValidSession } from "@/lib/auth";
import { LoginForm, SetupForm } from "./auth-forms";

export default async function LoginPage() {
  if (await hasValidSession()) redirect("/dashboard");
  const status = await getTeamStatus();

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
      <Backdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-16">
        <header className="animate-rise-in text-center">
          <div className="mb-6 flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-orange shadow-[0_0_12px_rgba(229,117,31,0.9)]" />
            Secure team access
          </div>

          <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            <span className="block text-white">Gobbler Racing</span>
            <span className="block bg-linear-to-r from-orange-bright via-orange to-maroon-bright bg-clip-text text-transparent">
              Consumables Tracker
            </span>
          </h1>

          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-linear-to-r from-transparent to-maroon-bright" />
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-zinc-300">
              Virginia Tech
            </p>
            <span className="h-px w-10 bg-linear-to-l from-transparent to-maroon-bright" />
          </div>
        </header>

        <section
          className="animate-rise-in mx-auto mt-10 w-full max-w-md rounded-2xl bg-linear-to-br from-orange/60 via-white/10 to-maroon-bright/60 p-px"
          style={{ animationDelay: "120ms" }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-zinc-950/85 p-6 backdrop-blur-xl sm:p-8">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
              <div className="animate-scan h-px w-1/2 bg-linear-to-r from-transparent via-orange to-transparent" />
            </div>
            {status === "ready" ? <LoginForm /> : <SetupForm />}
          </div>
        </section>

        <p
          className="animate-rise-in mt-8 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600"
          style={{ animationDelay: "240ms" }}
        >
          Authorized team members only
        </p>
      </div>
    </main>
  );
}
