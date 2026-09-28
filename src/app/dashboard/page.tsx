import type { Metadata } from "next";
import { logout } from "@/app/actions/auth";
import { Backdrop } from "@/components/backdrop";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard — Gobbler Racing Consumables Tracker",
};

export default async function DashboardPage() {
  await requireSession();

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
      <Backdrop />

      <div className="relative z-10 flex justify-end px-5 py-5">
        <form action={logout}>
          <button
            type="submit"
            className="rounded-lg border border-white/10 bg-black/50 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-400 backdrop-blur transition hover:border-orange/60 hover:text-orange"
          >
            Log out
          </button>
        </form>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <div className="animate-rise-in mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-orange">
          <span className="h-1.5 w-1.5 rounded-full bg-orange shadow-[0_0_12px_rgba(229,117,31,0.9)]" />
          Access granted
        </div>
        <h1 className="animate-rise-in text-4xl font-black tracking-tight sm:text-5xl">
          <span className="block text-white">Gobbler Racing</span>
          <span className="block bg-linear-to-r from-orange-bright via-orange to-maroon-bright bg-clip-text text-transparent">
            Consumables Tracker
          </span>
        </h1>
        <p
          className="animate-rise-in mt-5 max-w-md text-zinc-400"
          style={{ animationDelay: "120ms" }}
        >
          You&apos;re logged in. This is where the dashboard goes next: the car
          view, fluids, brake pads, and system usage.
        </p>
      </div>
    </main>
  );
}
